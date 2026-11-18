import 'dotenv/config';
import { Client, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import { migrate, saveMessage, createRequest, pendingReplies, markReplied, requestFiles } from './db.js';
import { storageEnabled, objectKey, putFile, storeDiscordAttachment } from './storage.js';
import { startApi } from './api.js';
import { sttEnabled, transcribeAttachment } from './transcribe.js';
import { ttsEnabled, synthesize } from './speech.js';

const WATCH_CHANNEL_IDS = (process.env.WATCH_CHANNEL_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const TRIGGER_USER_IDS = (process.env.TRIGGER_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const POLL_MS = Number(process.env.BOT_POLL_INTERVAL_MS ?? 3000);
const DISCORD_LIMIT = 2000;
// Дуут зурвасын текстийг Claude-д асуулт болгон өгөх эсэх (off бол зөвхөн текст болгоно).
const VOICE_TO_CLAUDE = (process.env.VOICE_TO_CLAUDE ?? 'on').toLowerCase() !== 'off';
const SPREADSHEET_EXT = /\.(xlsx|xlsm|xlsb|xls|csv|tsv)$/i;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel, Partials.Message],
});

function isWatched(channelId) {
  return WATCH_CHANNEL_IDS.length === 0 || WATCH_CHANNEL_IDS.includes(channelId);
}

function triggerIds() {
  return TRIGGER_USER_IDS.length ? TRIGGER_USER_IDS : [client.user.id];
}

function mentionsTrigger(message) {
  return triggerIds().some((id) => message.mentions.users.has(id));
}

function stripMentions(content) {
  const ids = triggerIds();
  let out = content;
  for (const id of ids) out = out.replaceAll(`<@${id}>`, '').replaceAll(`<@!${id}>`, '');
  return out.trim();
}

/** Мессежид хавсаргасан spreadsheet файлууд (bridge татаж авахад хэрэгтэй мэдээлэл). */
function spreadsheetAttachments(message) {
  return [...message.attachments.values()]
    .filter((a) => SPREADSHEET_EXT.test(a.name ?? ''))
    .map((a) => ({ name: a.name, url: a.url, size: a.size }));
}

/** Discord-ийн 2000 тэмдэгтийн хязгаарт багтаан хэсэглэнэ. */
function chunk(text, size = DISCORD_LIMIT) {
  const parts = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n', size);
    if (cut < size * 0.5) cut = size;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  parts.push(rest);
  return parts;
}

/** Дуут зурвасыг (Record Voice Message) бүтнээр нь текст болгож, тухайн зурвас дээр reply хийнэ. */
async function handleVoiceMessage(message, record, saved) {
  const attachment = message.attachments.first();
  if (!attachment) return;
  if (!sttEnabled) {
    console.warn('[voice] ELEVENLABS_API_KEY тохируулаагүй тул дуут зурвасыг алгаслаа');
    return;
  }
  await message.react('🎙️').catch(() => {});
  try {
    const started = Date.now();
    const { text } = await transcribeAttachment(attachment);
    console.log(`[voice] ${message.author.username}: ${attachment.duration ?? '?'}s → ${text.length} тэмдэгт (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    if (!text) {
      await message.reply({ content: '🎙️ Яриа танигдсангүй.', allowedMentions: { repliedUser: false } });
      return;
    }
    // Текстийг чатын түүхэнд хадгална: дараа нь mention хийхэд Claude дуут зурвасыг context болгон харна.
    await saveMessage({ ...record, content: `[дуут зурвас] ${text}` });
    const parts = chunk(`🎙️ **${record.authorName}:** ${text}`);
    for (let i = 0; i < parts.length; i++) {
      const payload = { content: parts[i], allowedMentions: { parse: [], repliedUser: false } };
      if (i === 0) await message.reply(payload);
      else await message.channel.send(payload);
    }
    // Дуут зурваст mention хийх боломжгүй тул текстийг шууд Claude-ийн дараалалд оруулна (bridge хариулна).
    if (VOICE_TO_CLAUDE) {
      await createRequest(saved.id, text, [], { voice: true });
      await message.react('👀').catch(() => {});
      console.log(`[queue] voice request from ${message.author.username}: ${text.slice(0, 80)}`);
    }
  } catch (err) {
    console.error('[voice] failed:', err.message);
    await message.reply({ content: '🎙️ Дуут зурвасыг текст болгож чадсангүй.', allowedMentions: { repliedUser: false } }).catch(() => {});
  }
}

// ---------- 1. Шинэ чат хадгалах ----------
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (!isWatched(message.channelId)) {
      console.log(`[skip] message in unwatched channel ${message.channelId} (#${message.channel?.name ?? '?'}) from ${message.author.username}`);
      return;
    }
    const isVoice = message.flags.has(MessageFlags.IsVoiceMessage);
    console.log(`[msg] #${message.channel?.name ?? message.channelId} ${message.author.username}: ${isVoice ? '(дуут зурвас)' : message.content.slice(0, 60) || '(empty — MESSAGE CONTENT INTENT асаагүй байж магадгүй)'}`);

    const triggered = mentionsTrigger(message);
    const record = {
      discordMessageId: message.id,
      guildId: message.guildId,
      channelId: message.channelId,
      authorId: message.author.id,
      authorName: message.member?.displayName ?? message.author.username,
      content: message.content,
      mentionsTrigger: triggered,
    };
    const saved = await saveMessage(record);

    // Дуут зурвас текст, mention агуулдаггүй тул Claude-ийн дараалалд оруулахгүй.
    if (isVoice) {
      await handleVoiceMessage(message, record, saved);
      return;
    }

    if (!triggered) return;

    const prompt = stripMentions(message.content);
    const files = spreadsheetAttachments(message);
    if (!prompt && !files.length) {
      await message.reply('Асуултаа mention-ийн хамт бичнэ үү 🙂');
      return;
    }
    await createRequest(saved.id, prompt, files);
    // Хавсаргасан эх файлуудыг bucket-д хадгална (хариултыг саатуулахгүй, алдааг зөвхөн логт бичнэ).
    if (storageEnabled) {
      for (const f of files) {
        const key = objectKey({ channelId: message.channelId, messageId: message.id, kind: 'input', name: f.name });
        storeDiscordAttachment(f, key)
          .then(() => console.log(`[bucket] saved ${key}`))
          .catch((err) => console.error(`[bucket] failed ${key}:`, err.message));
      }
    }
    await message.react('👀').catch(() => {});
    console.log(`[queue] request from ${message.author.username}: ${prompt.slice(0, 80)}${files.length ? ` (+${files.length} spreadsheet)` : ''}`);
  } catch (err) {
    console.error('[messageCreate]', err);
  }
});

// ---------- 2. Бэлэн хариултыг Discord руу илгээх ----------
let polling = false;
async function deliverReplies() {
  if (polling) return;
  polling = true;
  try {
    for (const r of await pendingReplies()) {
      try {
        const channel = await client.channels.fetch(r.channel_id);
        const body =
          r.status === 'answered'
            ? r.answer || '(хоосон хариулт)'
            : `Уучлаарай, хариулт боловсруулахад алдаа гарлаа.\n\`\`\`\n${(r.error ?? 'unknown').slice(0, 500)}\n\`\`\``;

        const parts = chunk(`<@${r.author_id}> ${body}`);
        const original = await channel.messages.fetch(r.discord_message_id).catch(() => null);
        // Зассан файлуудыг сүүлийн хэсэгт хавсаргана.
        const files = r.status === 'answered' ? (await requestFiles(r.id)).map((f) => ({ attachment: f.data, name: f.name })) : [];
        // Зассан файлуудыг bucket-д хадгална (DB-ээс устахаас өмнө).
        if (storageEnabled) {
          for (const f of files) {
            const key = objectKey({ channelId: r.channel_id, messageId: r.discord_message_id, kind: 'output', name: f.name });
            await putFile(key, f.attachment, f.name)
              .then(() => console.log(`[bucket] saved ${key}`))
              .catch((err) => console.error(`[bucket] failed ${key}:`, err.message));
          }
        }
        // Дуут зурвасын хариултыг текстийн хамт дуугаар илгээнэ. Дуу болгож чадахгүй бол зөвхөн текст.
        if (r.voice && r.status === 'answered' && ttsEnabled) {
          const audio = await synthesize(body).catch((err) => { console.error(`[tts] request #${r.id} failed:`, err.message); return null; });
          if (audio) files.unshift({ attachment: audio, name: 'hariult.mp3' });
          else console.log(`[tts] request #${r.id}: дуугүй (хэт урт эсвэл алдаа)`);
        }
        for (let i = 0; i < parts.length; i++) {
          const payload = { content: parts[i], allowedMentions: { users: [r.author_id] } };
          if (i === parts.length - 1 && files.length) payload.files = files;
          if (i === 0 && original) await original.reply(payload);
          else await channel.send(payload);
        }
        await markReplied(r.id);
        console.log(`[reply] request #${r.id} → delivered (${r.status})`);
      } catch (err) {
        console.error(`[reply] request #${r.id} failed:`, err.message);
      }
    }
  } finally {
    polling = false;
  }
}

client.once('clientReady', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`   watching channels: ${WATCH_CHANNEL_IDS.join(', ') || '(all)'}`);
  console.log(`   trigger users: ${triggerIds().join(', ')}`);
  console.log(`   bucket storage: ${storageEnabled ? 'on' : 'off (BUCKET_* хувьсагч тохируулаагүй)'}`);
  console.log(`   voice → text: ${sttEnabled ? `on (Claude руу дамжуулах: ${VOICE_TO_CLAUDE ? 'on' : 'off'})` : 'off (ELEVENLABS_API_KEY тохируулаагүй)'}`);
  console.log(`   text → voice: ${ttsEnabled ? 'on' : 'off'}`);
  for (const g of client.guilds.cache.values()) {
    const chans = g.channels.cache.filter((c) => c.isTextBased()).map((c) => `#${c.name}=${c.id}`).join(', ');
    console.log(`   in server "${g.name}" (${g.id}) text channels: ${chans}`);
  }
  if (client.guilds.cache.size === 0) console.warn('⚠️  Bot ямар ч серверт нэмэгдээгүй байна. OAuth2 invite URL-ээр нэмнэ үү.');
  for (const id of WATCH_CHANNEL_IDS) {
    if (!client.channels.cache.has(id)) console.warn(`⚠️  WATCH_CHANNEL_IDS доторх ${id} channel bot-д харагдахгүй байна (ID буруу эсвэл эрх хүрэхгүй).`);
  }
  setInterval(deliverReplies, POLL_MS);
});

// Railway private network deploy-ийн эхний секундүүдэд бэлэн болоогүй байж болзошгүй → retry
for (let i = 1; ; i++) {
  try { await migrate(); break; }
  catch (err) {
    if (i >= 10) throw err;
    console.warn(`[db] connect failed (${err.code ?? err.message}), retry ${i}/10 in 3s`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
startApi();
await client.login(process.env.DISCORD_TOKEN);
