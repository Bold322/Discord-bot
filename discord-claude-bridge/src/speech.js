// Claude-ийн хариултыг ElevenLabs-ээр дуу болгоно (дуут зурваст өгөх хариулт).
// ELEVENLABS_API_KEY тохируулаагүй эсвэл TTS=off бол унтраалттай.

const API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
// Sarah: үнэгүй багцад ажилладаг үндсэн (premade) дуу хоолой. Library дуу хоолойд Creator багц хэрэгтэй.
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const MAX_CHARS = Number(process.env.TTS_MAX_CHARS ?? 1500);

export const ttsEnabled = Boolean(process.env.ELEVENLABS_API_KEY) && (process.env.TTS ?? 'on').toLowerCase() !== 'off';

/** Уншуулахад тохиромжгүй хэсгийг (mention, код, холбоос, markdown тэмдэг) текстээс цэвэрлэнэ. */
export function speechText(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[@#][!&]?\d+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_~`>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Текстийг MP3 болгон буцаана. Уншуулах зүйлгүй эсвэл хэт урт бол null (зөвхөн текстээр хариулна).
 * @returns {Promise<Buffer | null>}
 */
export async function synthesize(text, env = process.env) {
  const spoken = speechText(text);
  if (!spoken || spoken.length > MAX_CHARS) return null;

  const body = { text: spoken, model_id: env.TTS_MODEL || 'eleven_v4' };
  // Хэлийг зааж өгвөл тоо, товчлолыг монголоор уншина. TTS_LANGUAGE=auto бол модель өөрөө танина.
  const language = env.TTS_LANGUAGE || 'mn';
  if (language !== 'auto') body.language_code = language;

  const res = await fetch(`${API_URL}/${env.TTS_VOICE_ID || DEFAULT_VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(env.TTS_TIMEOUT_MS ?? 120_000)),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}
