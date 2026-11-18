import { migrate, pool } from './db.js';

await migrate();
console.log('✅ migration done');
await pool.end();
