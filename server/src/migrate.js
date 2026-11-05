import fs from 'node:fs';
import { getPool, query } from './db.js';
const script = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const batches = script.split(/^\s*GO\s*$/gim).map(s => s.trim()).filter(Boolean);
// CREATE DATABASE master üzerinde; sonrası AurenDGS üzerinde çalışır
const master = await getPool('master');
await query(batches[0], {}, master);
await master.close();
const p = await getPool();
for (const b of batches.slice(2)) await query(b, {}, p); // batches[1] = USE
console.log(`Şema uygulandı (${batches.length - 1} batch).`);
process.exit(0);
