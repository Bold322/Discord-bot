import 'dotenv/config';
import { migrate, claimNextRequest, completeRequest, failRequest, requeueStale, recentMessages } from './db.js';
import { runClaude } from './claude.js';
import { handleSpreadsheets } from './spreadsheet.js';
import { driveAccess } from './drive.js';

const POLL_MS = Number(process.env.BRIDGE_POLL_INTERVAL_MS ?? 3000);
const CONTEXT_MESSAGES = Number(process.env.CONTEXT_MESSAGES ?? 15);
const STALE_MINUTES = Number(process.env.STALE_MINUTES ?? 20);
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS ?? 3);

// Чатын хариултын урт: анхдагчаар 2 өгүүлбэр, хэрэглэгч дэлгэрэнгүй хүсвэл урт.
const BRIEF_PROMPT = `
Answer length: by default reply in at most two short sentences. Give a longer answer only when the user's message asks for one (for example "илүү дэлгэрэнгүй тайлбарла", "дэлгэрэнгүй", "explain in detail", "step by step"), or when a required report (such as what you changed in a Drive file and its link) cannot fit in two sentences.`;

// Дуут зурвасын хариултыг чангаар уншуулна.
const VOICE_PROMPT = `
The user's message is a speech-to-text transcript of a Mongolian voice message, so it may contain recognition errors: infer the intended words from context.
Your reply will be read aloud by a text-to-speech voice and also shown as text: write natural spoken Mongolian in Cyrillic, with no markdown, lists, code, emoji or URLs.`;

function buildPrompt(req, history) {
  const m = req.message;
  const lines = history.map((h) => `[${h.author_name}]: ${h.content}`).join('\n');
  return [
    lines ? `Recent conversation in the channel (oldest first):\n${lines}\n` : '',
    `User "${m.author_name}" ${req.voice ? 'sent you a voice message (transcript)' : 'mentioned you and asked'}:\n${req.prompt}`,
  ].join('\n');
}

async function processOne() {
  const req = await claimNextRequest();
  if (!req) return false;

  const started = Date.now();
  console.log(`[bridge] #${req.id} from ${req.message.author_name}: ${req.prompt.slice(0, 80)}`);
  try {
    let result;
    if (req.attachments?.length) {
      // Spreadsheet хавсаргасан бол: тайлбарлах, асуултад хариулах эсвэл засаж шинэ файл буцаах.
      result = await handleSpreadsheets(req.attachments, req.prompt);
    } else {
      const history = await recentMessages(req.message.channel_id, CONTEXT_MESSAGES, req.message_id);
      // Google Drive дээрх файлыг нэрээр нь хайж, уншиж, зөвшөөрөгдсөн хэрэглэгчид газар дээр нь засна.
      const drive = driveAccess(req.message.author_id);
      const extraSystemPrompt = (drive?.systemPrompt ?? '') + BRIEF_PROMPT + (req.voice ? VOICE_PROMPT : '');
      result = await runClaude(buildPrompt(req, history), { extraTools: drive?.tools ?? [], extraSystemPrompt });
    }
    const { text, costUsd, files = [] } = result;
    await completeRequest(req.id, text.trim() || '(Claude хоосон хариулт буцаалаа)', files, {
      costUsd: costUsd ?? null,
      durationMs: Date.now() - started,
    });
    if (files.length) console.log(`[bridge] #${req.id} returning ${files.length} file(s): ${files.map((f) => f.name).join(', ')}`);
    console.log(`[bridge] #${req.id} answered in ${((Date.now() - started) / 1000).toFixed(1)}s${costUsd != null ? ` ($${costUsd.toFixed(3)})` : ''}`);
  } catch (err) {
    const retry = req.attempts < MAX_ATTEMPTS && !/timed out/.test(err.message);
    console.error(`[bridge] #${req.id} failed (attempt ${req.attempts}, retry=${retry}):`, err.message);
    await failRequest(req.id, err.message, { retry });
  }
  return true;
}

async function loop() {
  for (;;) {
    try {
      const requeued = await requeueStale(STALE_MINUTES, MAX_ATTEMPTS);
      if (requeued) console.log(`[bridge] requeued ${requeued} stale request(s)`);
      // Дарааллыг хоосортол дараалан боловсруулна
      while (await processOne()) {}
    } catch (err) {
      console.error('[bridge] loop error:', err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

await migrate();
console.log(`🌉 bridge started — workdir: ${process.env.CLAUDE_WORKDIR || process.cwd()}, poll ${POLL_MS}ms`);
await loop();
