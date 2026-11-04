// Kullanım: npm run make-admin -- <kullaniciAdi>   (yetkiyi kaldırmak için: -- <kullaniciAdi> --revoke)
import { getPool, query } from './db.js';
const [name, flag] = process.argv.slice(2);
if (!name) { console.error('Kullanım: npm run make-admin -- <kullaniciAdi> [--revoke]'); process.exit(1); }
await getPool();
const out = await query(`UPDATE dbo.Users SET IsAdmin=@v OUTPUT INSERTED.Username, INSERTED.IsAdmin WHERE Username=@u`, { v: flag === '--revoke' ? 0 : 1, u: name });
console.log(out.length ? `${out[0].Username}: IsAdmin=${out[0].IsAdmin}` : 'Kullanıcı bulunamadı');
process.exit(out.length ? 0 : 1);
