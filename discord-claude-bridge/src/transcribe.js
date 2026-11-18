// Discord-ийн дуут зурвасыг (Record Voice Message) ElevenLabs Scribe-ээр текст болгоно.
// ELEVENLABS_API_KEY тохируулаагүй бол унтраалттай.

const API_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const DISCORD_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const MAX_BYTES = Number(process.env.VOICE_MAX_MB ?? 25) * 1024 * 1024;

export const sttEnabled = Boolean(process.env.ELEVENLABS_API_KEY);

/**
 * Дуут зурвасын хавсралтыг татаж, бүтэн яриаг текст болгон буцаана.
 * @param {{url: string, name?: string, size?: number, contentType?: string}} attachment
 * @returns {Promise<{text: string, languageCode: string | null}>}
 */
export async function transcribeAttachment(attachment, env = process.env) {
  const url = new URL(attachment.url);
  if (url.protocol !== 'https:' || !DISCORD_HOSTS.has(url.hostname)) throw new Error(`Discord-ийн биш холбоос: ${url.hostname}`);
  if ((attachment.size ?? 0) > MAX_BYTES) throw new Error(`дуут зурвас хэт том (${(attachment.size / 1048576).toFixed(1)} MB)`);

  const audio = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!audio.ok) throw new Error(`дуут зурвасыг татаж чадсангүй (HTTP ${audio.status})`);

  const form = new FormData();
  form.append('model_id', env.STT_MODEL || 'scribe_v3');
  // Хэлийг зааж өгвөл богино бичлэгийг өөр хэл гэж андуурахгүй. STT_LANGUAGE=auto бол автоматаар танина.
  const language = env.STT_LANGUAGE || 'mon';
  if (language !== 'auto') form.append('language_code', language);
  form.append('tag_audio_events', 'false');
  form.append('file', new Blob([await audio.arrayBuffer()], { type: attachment.contentType || 'audio/ogg' }), attachment.name || 'voice-message.ogg');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
    body: form,
    signal: AbortSignal.timeout(Number(env.STT_TIMEOUT_MS ?? 120_000)),
  });
  if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return { text: (json.text ?? '').trim(), languageCode: json.language_code ?? null };
}
