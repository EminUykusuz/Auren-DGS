import { get } from './api.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 2 }));
const day = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

// Veli raporu: uygulamadan bağımsız, sade ve yazdırmaya uygun bir sayfa olarak yeni sekmede açılır (Yazdır → PDF olarak kaydet).
// Pencere, tıklamanın içinde eşzamanlı açılır (aksi halde tarayıcı açılır pencereyi engeller); veri sonra yazılır.
export async function openReport(studentId) {
  const w = window.open('', '_blank');
  if (!w) throw new Error('Tarayıcı yeni sekmeyi engelledi; bu site için açılır pencerelere izin ver.');
  w.document.write('<!doctype html><meta charset="utf-8"><title>Rapor hazırlanıyor…</title><body style="font:16px system-ui;padding:2rem">Rapor hazırlanıyor…</body>');
  let d;
  try { d = await get('/kurum/students/' + studentId + '/report'); } catch (e) { w.close(); throw e; }
  const open = d.homework.filter(h => !h.submitted).length, late = d.homework.filter(h => h.late).length;
  const trend = d.avg3 != null && d.avgPrev != null ? Math.round((d.avg3 - d.avgPrev) * 100) / 100 : null;
  const meta = [d.student.className, d.student.studentNo && 'No: ' + d.student.studentNo].filter(Boolean).map(esc).join(' · ');
  const examRows = d.exams.map(e => `<tr><td>${esc(day(e.date))}</td><td>${esc(e.name)}</td><td>${esc(e.type === e.part ? e.type : e.type + ' ' + e.part)}</td><td class="n">${fmt(e.net)}</td></tr>`).join('');
  const hwRows = d.homework.map(h => `<tr><td>${esc(h.title)}${h.personal ? ' <span class="muted">(kişiye özel)</span>' : ''}</td><td>${esc(day(h.due))}</td><td class="n">${h.done}/${h.items}</td><td class="${h.submitted ? 'ok' : h.late ? 'bad' : ''}">${h.submitted ? 'Bitirdi' : h.late ? 'Gecikti' : 'Devam ediyor'}</td></tr>`).join('');
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.student.name)} · Gelişim raporu</title>
<style>
*{box-sizing:border-box}body{font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#111;max-width:800px;margin:0 auto;padding:28px 22px}
h1{font-size:22px;margin:0}h2{font-size:15px;margin:26px 0 8px;border-bottom:2px solid #111;padding-bottom:4px}.muted{color:#666;font-size:12px}
.head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;border-bottom:1px solid #ccc;padding-bottom:14px;margin-bottom:6px}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}.tile{border:1px solid #ccc;border-radius:10px;padding:10px}.tile b{display:block;font-size:20px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd}th{background:#f3f3f3;font-size:12px}th.n,td.n{text-align:right;font-variant-numeric:tabular-nums}
.bad{color:#b00020;font-weight:600}.ok{color:#0a7a3b;font-weight:600}.btn{position:fixed;right:16px;top:16px;background:#111;color:#fff;border:0;border-radius:10px;padding:10px 16px;font:600 14px system-ui;cursor:pointer}
.sign{margin-top:36px;display:flex;justify-content:space-between;gap:30px}.sign div{flex:1;border-top:1px solid #111;padding-top:4px;font-size:12px;color:#444}
@media(max-width:560px){.tiles{grid-template-columns:repeat(2,1fr)}}@media print{.btn{display:none}body{padding:0}h2{break-after:avoid}tr{break-inside:avoid}}
</style></head><body>
<button class="btn" onclick="print()">Yazdır / PDF olarak kaydet</button>
<div class="head"><div><div class="muted">${esc(d.institution)}</div><h1>${esc(d.student.name)}</h1><div class="muted">${meta}</div></div>
<div class="muted" style="text-align:right">Öğrenci gelişim raporu<br>${esc(new Date(d.generatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }))}</div></div>
<div class="tiles">
<div class="tile"><span class="muted">Son 3 deneme ort. net</span><b>${fmt(d.avg3)}</b></div>
<div class="tile"><span class="muted">Önceki 3 denemeye göre</span><b class="${trend == null ? '' : trend >= 0 ? 'ok' : 'bad'}">${trend == null ? '—' : (trend > 0 ? '+' : '') + fmt(trend)}</b></div>
<div class="tile"><span class="muted">Teslim edilmemiş ödev</span><b>${open}</b></div>
<div class="tile"><span class="muted">Geciken ödev</span><b class="${late ? 'bad' : ''}">${late}</b></div></div>
<h2>Son denemeler</h2>
${d.exams.length ? `<table><thead><tr><th>Tarih</th><th>Deneme</th><th>Sınav</th><th class="n">Toplam net</th></tr></thead><tbody>${examRows}</tbody></table>` : '<p class="muted">Henüz deneme girilmemiş.</p>'}
<h2>Ödevler</h2>
${d.homework.length ? `<table><thead><tr><th>Ödev</th><th>Teslim</th><th class="n">Madde</th><th>Durum</th></tr></thead><tbody>${hwRows}</tbody></table>` : '<p class="muted">Ödev verilmemiş.</p>'}
<p class="muted" style="margin-top:20px">Son giriş: ${d.student.lastLoginAt ? esc(new Date(d.student.lastLoginAt).toLocaleDateString('tr-TR')) : 'henüz girmedi'}</p>
<div class="sign"><div>Öğretmen</div><div>Veli</div></div>
<p class="muted" style="margin-top:22px">Auren Study ile hazırlandı.</p></body></html>`;
  w.document.open(); w.document.write(html); w.document.close();
}
