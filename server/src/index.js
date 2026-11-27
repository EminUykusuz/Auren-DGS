import { app } from './app.js';
import { getPool } from './db.js';
import { config } from './config.js';

// Yakalanmayan söz reddi sürecin kapanmasına yol açmasın; kaydedilir (istek zaten 500 ile döner)
process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));

// Açılışta SQL Server henüz hazır olmayabilir (sunucu yeniden başladığında): birkaç kez dene, sonra pes et
for (let i = 1; ; i++) {
  try { await getPool(); break; }
  catch (e) { if (i >= 6) throw e; console.error(`[db] bağlanılamadı (${i}/6): ${e?.message || e}; 5 sn sonra yeniden denenecek`); await new Promise(r => setTimeout(r, 5000)); }
}
app.listen(config.port, () => console.log(`Auren DGS API :${config.port}`));
