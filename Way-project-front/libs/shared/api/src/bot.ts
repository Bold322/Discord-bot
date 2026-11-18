// Discord bot dashboard data. This comes from the bot's own read-only API
// (discord-claude-bridge), not from the main backend, so it has its own base
// URL (`VITE_BOT_API_URL`) and needs no auth.

export type BotChatStatus = 'pending' | 'processing' | 'answered' | 'replied' | 'failed';

export interface BotChatAttachment {
  name: string;
  size: number;
}

export interface BotChat {
  id: string;
  status: BotChatStatus;
  prompt: string;
  answer: string | null;
  error: string | null;
  authorName: string;
  channelId: string;
  /** Discord message id; also the folder name of this chat's files in the bucket. */
  messageId: string;
  /** Cost of the Claude calls for this chat in USD; null when not recorded. */
  costUsd: number | null;
  durationMs: number | null;
  createdAt: string;
  answeredAt: string | null;
  attachments: BotChatAttachment[];
}

export interface BotFile {
  /** Full object key: `discord/<channelId>/<messageId>/<input|output>/<name>`. */
  key: string;
  size: number;
  lastModified: string;
}

interface BackendBotChat {
  id: string | number;
  status: BotChatStatus;
  prompt: string;
  answer: string | null;
  error: string | null;
  author_name: string;
  channel_id: string;
  message_id: string;
  cost_usd: number | null;
  duration_ms: number | null;
  created_at: string;
  answered_at: string | null;
  attachments: BotChatAttachment[] | null;
}

function toBotChat(c: BackendBotChat): BotChat {
  return {
    id: String(c.id),
    status: c.status,
    prompt: c.prompt,
    answer: c.answer,
    error: c.error,
    authorName: c.author_name,
    channelId: c.channel_id,
    messageId: c.message_id,
    costUsd: c.cost_usd,
    durationMs: c.duration_ms,
    createdAt: c.created_at,
    answeredAt: c.answered_at,
    attachments: c.attachments ?? [],
  };
}

async function getJson<T>(baseUrl: string, path: string): Promise<T> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`);
  if (!res.ok) throw new Error(`Bot API request failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchBotChats(baseUrl: string): Promise<BotChat[]> {
  const body = await getJson<{ chats: BackendBotChat[] }>(baseUrl, '/api/chats');
  return body.chats.map(toBotChat);
}

export async function fetchBotFiles(baseUrl: string): Promise<BotFile[]> {
  const body = await getJson<{ files: BotFile[] }>(baseUrl, '/api/files');
  return body.files;
}

// --- mock fixtures (used when no bot API URL is configured) ---

const XLSX_BYTES = 18432;

export const MOCK_BOT_CHATS: BotChat[] = [
  {
    id: '3',
    status: 'replied',
    prompt: 'Нийт гэсэн багана нэмээд доор нь нийлбэрийг гарга',
    answer: '«Нийт» багана (E) нэмж, 41-р мөрөнд нийлбэрийг томьёогоор гаргалаа.',
    error: null,
    authorName: 'Teacher',
    channelId: '1000000000000000001',
    messageId: '2000000000000000003',
    costUsd: 0.206,
    durationMs: 15000,
    createdAt: '2026-11-16T12:46:36Z',
    answeredAt: '2026-11-16T12:46:54Z',
    attachments: [{ name: 'borluulalt.xlsx', size: XLSX_BYTES }],
  },
  {
    id: '2',
    status: 'replied',
    prompt: '',
    answer: 'Энэ файл нь 10-р сарын борлуулалтын бүртгэл юм. Огноо, бараа, тоо ширхэг, үнэ гэсэн 4 багана, 40 мөртэй.',
    error: null,
    authorName: 'Bat',
    channelId: '1000000000000000001',
    messageId: '2000000000000000002',
    costUsd: 0.108,
    durationMs: 5900,
    createdAt: '2026-11-16T11:20:10Z',
    answeredAt: '2026-11-16T11:20:17Z',
    attachments: [{ name: 'borluulalt.xlsx', size: XLSX_BYTES }],
  },
  {
    id: '1',
    status: 'failed',
    prompt: 'энэ алдааг яаж засах вэ?',
    answer: null,
    error: 'claude timed out after 600000 ms',
    authorName: 'Teacher',
    channelId: '1000000000000000001',
    messageId: '2000000000000000001',
    costUsd: null,
    durationMs: null,
    createdAt: '2026-11-15T09:02:00Z',
    answeredAt: null,
    attachments: [],
  },
];

export const MOCK_BOT_FILES: BotFile[] = [
  { key: 'discord/1000000000000000001/2000000000000000003/input/borluulalt.xlsx', size: XLSX_BYTES, lastModified: '2026-11-16T12:46:37Z' },
  { key: 'discord/1000000000000000001/2000000000000000003/output/borluulalt.xlsx', size: XLSX_BYTES + 512, lastModified: '2026-11-16T12:46:55Z' },
  { key: 'discord/1000000000000000001/2000000000000000002/input/borluulalt.xlsx', size: XLSX_BYTES, lastModified: '2026-11-16T11:20:11Z' },
];
