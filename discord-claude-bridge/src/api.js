import { createServer } from 'node:http';
import { listChats } from './db.js';
import { listFiles, storageEnabled } from './storage.js';

/**
 * Нийтэд нээлттэй, зөвхөн унших JSON API (dashboard-д зориулсан).
 *   GET /api/chats  — хүсэлт, хариулт, төлөв, зардал
 *   GET /api/files  — bucket доторх файлуудын жагсаалт (агуулга биш)
 * Нэвтрэлтгүй тул хэрэглэгчийн ID, Discord-ийн холбоос, файлын агуулгыг буцаахгүй.
 */
export function startApi(port = Number(process.env.PORT ?? 3000)) {
  const server = createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === 'OPTIONS') return send(204, {});
      if (req.method !== 'GET') return send(405, { error: 'method not allowed' });
      const { pathname, searchParams } = new URL(req.url, 'http://localhost');

      if (pathname === '/health') return send(200, { ok: true });
      if (pathname === '/api/chats') {
        const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 200, 1), 500);
        return send(200, { chats: await listChats(limit) });
      }
      if (pathname === '/api/files') {
        return send(200, { enabled: storageEnabled, files: storageEnabled ? await listFiles() : [] });
      }
      return send(404, { error: 'not found' });
    } catch (err) {
      console.error('[api]', err);
      send(500, { error: 'internal error' });
    }
  });
  server.listen(port, () => console.log(`🌐 API listening on :${port}`));
  return server;
}
