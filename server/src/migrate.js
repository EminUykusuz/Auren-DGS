import fs from 'node:fs';
import { getPool, query } from './db.js';

const split = (s) => s.split(/^\s*GO\s*$/gim).map(x => x.trim()).filter(Boolean);
const schema = split(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
// CREATE DATABASE master üzerinde; sonrası hedef veritabanında çalışır
const master = await getPool('master');
await query(schema[0], {}, master);
await master.close();
const p = await getPool();
for (const b of schema.slice(2)) await query(b, {}, p); // schema[1] = USE

// migrations/*.sql: dosya adı sırasıyla, idempotent
const dir = new URL('../migrations/', import.meta.url);
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort() : [];
for (const f of files) {
  const batches = split(fs.readFileSync(new URL(f, dir), 'utf8'));
  for (const b of batches) await query(b, {}, p);
  console.log(`Migration uygulandı: ${f} (${batches.length} batch)`);
}
console.log(`Şema uygulandı (${schema.length - 1} batch + ${files.length} migration).`);
process.exit(0);
