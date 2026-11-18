import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL тохируулаагүй байна');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 5,
});

export const query = (text, params) => pool.query(text, params);

export async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id                 BIGSERIAL PRIMARY KEY,
      discord_message_id TEXT UNIQUE NOT NULL,
      guild_id           TEXT,
      channel_id         TEXT NOT NULL,
      author_id          TEXT NOT NULL,
      author_name        TEXT NOT NULL,
      content            TEXT NOT NULL,
      mentions_trigger   BOOLEAN NOT NULL DEFAULT false,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS messages_channel_created_idx ON messages (channel_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS requests (
      id           BIGSERIAL PRIMARY KEY,
      message_id   BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      status       TEXT NOT NULL DEFAULT 'pending',
      prompt       TEXT NOT NULL,
      answer       TEXT,
      error        TEXT,
      attempts     INT NOT NULL DEFAULT 0,
      claimed_at   TIMESTAMPTZ,
      answered_at  TIMESTAMPTZ,
      replied_at   TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS requests_status_idx ON requests (status, id);
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments JSONB;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10,4);
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS duration_ms INT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS voice BOOLEAN NOT NULL DEFAULT false;

    CREATE TABLE IF NOT EXISTS request_files (
      id         BIGSERIAL PRIMARY KEY,
      request_id BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      data       BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS request_files_request_idx ON request_files (request_id);
  `);
}

// ---------- messages ----------
export async function saveMessage(m) {
  const { rows } = await query(
    `INSERT INTO messages (discord_message_id, guild_id, channel_id, author_id, author_name, content, mentions_trigger)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (discord_message_id) DO UPDATE SET content = EXCLUDED.content
     RETURNING *`,
    [m.discordMessageId, m.guildId, m.channelId, m.authorId, m.authorName, m.content, m.mentionsTrigger],
  );
  return rows[0];
}

export async function recentMessages(channelId, limit, beforeId) {
  const { rows } = await query(
    `SELECT author_name, content, created_at FROM messages
     WHERE channel_id = $1 AND id < $2
     ORDER BY id DESC LIMIT $3`,
    [channelId, beforeId, limit],
  );
  return rows.reverse();
}

// ---------- requests ----------
/** voice: дуут зурвасаас үүссэн хүсэлт (богино, уншуулахад тохирсон хариулт + дуугаар буцаана). */
export async function createRequest(messageId, prompt, attachments = [], { voice = false } = {}) {
  const { rows } = await query(
    `INSERT INTO requests (message_id, prompt, attachments, voice) VALUES ($1,$2,$3,$4) RETURNING *`,
    [messageId, prompt, attachments.length ? JSON.stringify(attachments) : null, voice],
  );
  return rows[0];
}

/** Bridge: нэг pending хүсэлтийг атомаар авч processing болгоно. */
export async function claimNextRequest() {
  const { rows } = await query(
    `UPDATE requests SET status = 'processing', claimed_at = now(), attempts = attempts + 1
     WHERE id = (
       SELECT id FROM requests WHERE status = 'pending'
       ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED
     )
     RETURNING requests.*,
       (SELECT row_to_json(m) FROM messages m WHERE m.id = requests.message_id) AS message`,
  );
  return rows[0] ?? null;
}

export async function completeRequest(id, answer, files = [], { costUsd = null, durationMs = null } = {}) {
  // Файлуудыг эхэлж хадгална: bot хариултыг харах үед файл нь бэлэн байх ёстой.
  await query(`DELETE FROM request_files WHERE request_id = $1`, [id]);
  for (const f of files) {
    await query(`INSERT INTO request_files (request_id, name, data) VALUES ($1,$2,$3)`, [id, f.name, f.data]);
  }
  await query(
    `UPDATE requests SET status = 'answered', answer = $2, error = NULL, answered_at = now(),
       cost_usd = $3, duration_ms = $4 WHERE id = $1`,
    [id, answer, costUsd, durationMs],
  );
}

export async function failRequest(id, error, { retry }) {
  await query(
    `UPDATE requests SET status = $2, error = $3, answered_at = now() WHERE id = $1`,
    [id, retry ? 'pending' : 'failed', String(error).slice(0, 4000)],
  );
}

/** Bridge унтарсан үед processing-д гацсан хүсэлтүүдийг буцааж pending болгоно. */
export async function requeueStale(maxAgeMinutes, maxAttempts) {
  const { rowCount } = await query(
    `UPDATE requests
     SET status = CASE WHEN attempts >= $2 THEN 'failed' ELSE 'pending' END,
         error  = CASE WHEN attempts >= $2 THEN 'timeout: too many attempts' ELSE error END
     WHERE status = 'processing' AND claimed_at < now() - ($1 || ' minutes')::interval`,
    [String(maxAgeMinutes), maxAttempts],
  );
  return rowCount;
}

/** Bot: Discord руу илгээх бэлэн хариултууд (answered эсвэл failed). */
export async function pendingReplies(limit = 10) {
  const { rows } = await query(
    `SELECT r.*, m.channel_id, m.author_id, m.discord_message_id
     FROM requests r JOIN messages m ON m.id = r.message_id
     WHERE r.status IN ('answered', 'failed')
     ORDER BY r.id LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function markReplied(id) {
  await query(`UPDATE requests SET status = 'replied', replied_at = now() WHERE id = $1`, [id]);
  // Илгээсэн файлыг DB-д үлдээхгүй.
  await query(`DELETE FROM request_files WHERE request_id = $1`, [id]);
}

/** Bot: хариулттай хамт илгээх файлууд. */
export async function requestFiles(requestId) {
  const { rows } = await query(`SELECT name, data FROM request_files WHERE request_id = $1 ORDER BY id`, [requestId]);
  return rows;
}

/** Dashboard: сүүлийн хүсэлтүүд. Нийтэд харагдах тул author_id, Discord-ийн холбоосыг оруулахгүй. */
export async function listChats(limit = 200) {
  const { rows } = await query(
    `SELECT r.id, r.status, r.prompt, r.answer, r.error, r.attempts,
            r.cost_usd::float8 AS cost_usd, r.duration_ms, r.created_at, r.answered_at,
            m.author_name, m.channel_id, m.discord_message_id AS message_id,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('name', a->>'name', 'size', (a->>'size')::bigint))
                      FROM jsonb_array_elements(r.attachments) a), '[]'::jsonb) AS attachments
     FROM requests r JOIN messages m ON m.id = r.message_id
     ORDER BY r.id DESC LIMIT $1`,
    [limit],
  );
  return rows;
}
