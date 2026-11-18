import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// Railway bucket (S3-compatible). Хувьсагчид тохируулаагүй бол хадгалалт унтраалттай.
const { BUCKET_NAME, BUCKET_ENDPOINT, BUCKET_ACCESS_KEY_ID, BUCKET_SECRET_ACCESS_KEY } = process.env;
const MAX_BYTES = Number(process.env.SPREADSHEET_MAX_MB ?? 25) * 1024 * 1024;
const DISCORD_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

export const storageEnabled = Boolean(BUCKET_NAME && BUCKET_ENDPOINT && BUCKET_ACCESS_KEY_ID && BUCKET_SECRET_ACCESS_KEY);

const client = storageEnabled
  ? new S3Client({
      endpoint: BUCKET_ENDPOINT,
      region: process.env.BUCKET_REGION || 'auto',
      credentials: { accessKeyId: BUCKET_ACCESS_KEY_ID, secretAccessKey: BUCKET_SECRET_ACCESS_KEY },
    })
  : null;

const CONTENT_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
};

function safeName(name) {
  return String(name).replace(/[\/\\\u0000-\u001f]/g, '_').slice(0, 150) || 'file';
}

/** Bucket доторх зам: discord/<channel>/<message>/<input|output>/<файлын нэр> */
export function objectKey({ channelId, messageId, kind, name }) {
  return `discord/${channelId}/${messageId}/${kind}/${safeName(name)}`;
}

export async function putFile(key, data, name) {
  const ext = String(name).split('.').pop().toLowerCase();
  await client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: data,
    ContentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
  }));
  return key;
}

/** Discord-ийн хавсралтыг татаж bucket-д хадгална. */
export async function storeDiscordAttachment({ url, name, size }, key) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !DISCORD_HOSTS.has(parsed.hostname)) throw new Error(`Discord-ийн биш холбоос: ${parsed.hostname}`);
  if (size > MAX_BYTES) throw new Error(`"${name}" хэт том (${(size / 1048576).toFixed(1)} MB)`);
  const res = await fetch(parsed, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`"${name}" татаж чадсангүй (HTTP ${res.status})`);
  return putFile(key, Buffer.from(await res.arrayBuffer()), name);
}

/** Bucket доторх файлуудын жагсаалт (зам, хэмжээ, огноо). Агуулгыг буцаахгүй. */
export async function listFiles(max = 2000) {
  const files = [];
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: BUCKET_NAME, Prefix: 'discord/', ContinuationToken: token }));
    for (const o of page.Contents ?? []) files.push({ key: o.Key, size: o.Size, lastModified: o.LastModified });
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token && files.length < max);
  return files;
}
