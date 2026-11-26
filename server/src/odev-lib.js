// Kişiye özel ödev: Excel/CSV satırlarını öğrencilere eşleyen saf yardımcılar (veritabanı gerektirmez → birim testle doğrulanır).
import { asciiFold } from './kurum-lib.js';

export const MAX_ASSIGN = 200, MAX_ITEMS = 60;

/** CSV / sekmeli / noktalı virgüllü metni satırlara böler (tırnaklı alanlar desteklenir). */
export function parseDelimited(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const first = src.split(/\r?\n/).find(l => l.trim()) ?? '';
  const d = first.includes('\t') ? '\t' : first.includes(';') ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"' && cell === '') q = true;
    else if (ch === d) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell.trim()); cell = ''; if (row.some(Boolean)) rows.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

// Başlık adı → sütun rolü (asciiFold: küçük harf, Türkçe karakter ve boşluksuz)
const ROLE = [
  ['topic', k => /^(konu|madde|odev|konumadde|dersvekonu)/.test(k)],
  ['target', k => /^(hedef|soru|sorusayisi|adet)/.test(k)],
  ['due', k => /^(teslim|sontarih|bitis|tarih|sonteslim)/.test(k)],
  ['no', k => /^(no|numara|ogrencino|ogrencinumarasi|okulno|ogrnno)$/.test(k) || /^(ogrencino|okulno|numara)/.test(k)],
  ['name', k => /^(adsoyad|adisoyadi|ogrenci|isim|adi|ad|ogrenciadi|adsoyadi)/.test(k)],
];

/** Tarih: YYYY-MM-DD, GG.AA.YYYY veya GG/AA/YYYY → ISO. Geçersizse null. */
export function parseDate(s) {
  const t = String(s ?? '').trim(); if (!t) return null;
  let y, m, d, x;
  if ((x = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, d] = x.slice(1).map(Number);
  else if ((x = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/))) [d, m, y] = x.slice(1).map(Number);
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Satırları { line, no, name, topic, target, due } kayıtlarına çevirir. Başlık satırı varsa sütunları adına göre bulur, yoksa sırayla: No, Ad Soyad, Konu, Hedef, Teslim. */
export function parseRecords(rows) {
  const errors = []; const records = [];
  if (!rows.length) return { records, errors, header: false };
  const cols = {}; let start = 0;
  const head = rows[0].map(asciiFold);
  head.forEach((k, i) => { for (const [role, fn] of ROLE) if (cols[role] === undefined && k && fn(k)) { cols[role] = i; break; } });
  const header = cols.topic !== undefined;
  if (header) start = 1; else Object.assign(cols, { no: 0, name: 1, topic: 2, target: 3, due: 4 });
  for (let i = start; i < rows.length; i++) {
    const r = rows[i], line = i + 1; const g = (k) => (cols[k] === undefined ? '' : String(r[cols[k]] ?? '').trim());
    if (!r.some(c => String(c ?? '').trim())) continue;
    const rec = { line, no: g('no'), name: g('name'), topic: g('topic'), target: null, due: null };
    if (!rec.topic) continue;                                   // şablondaki boş satırlar: bu öğrenciye ödev yok
    if (rec.topic.length > 150) { errors.push({ line, message: 'Konu 150 karakterden uzun' }); continue; }
    const t = g('target');
    if (t) { const n = /^\d{1,4}$/.test(t.replace(/\.0+$/, '')) ? Number(t.replace(/\.0+$/, '')) : NaN; if (!(n >= 1 && n <= 5000)) { errors.push({ line, message: `Hedef soru 1-5000 arası bir sayı olmalı ("${t}")` }); continue; } rec.target = n; }
    const du = g('due');
    if (du) { rec.due = parseDate(du); if (!rec.due) { errors.push({ line, message: `Teslim tarihi anlaşılamadı ("${du}"); GG.AA.YYYY yaz` }); continue; } }
    if (!rec.no && !rec.name) { errors.push({ line, message: 'Öğrenci no veya ad soyad yazılmamış' }); continue; }
    records.push(rec);
  }
  return { records, errors, header };
}

/** Kayıtları kapsamdaki öğrencilere eşler. students: [{ id, name, no, username }]. Önce numara, sonra ad soyad (tek eşleşme şart). */
export function buildAssignments(records, students) {
  const byNo = new Map(), byName = new Map();
  for (const s of students) {
    if (s.no) { const k = String(s.no).trim().toLowerCase(); byNo.set(k, [...(byNo.get(k) ?? []), s]); }
    const n = asciiFold(s.name); if (n) byName.set(n, [...(byName.get(n) ?? []), s]);
  }
  const errors = []; const per = new Map();
  for (const r of records) {
    let hit = null;
    if (r.no) { const m = byNo.get(r.no.trim().toLowerCase()); if (m?.length === 1) hit = m[0]; else if (m?.length > 1) { errors.push({ line: r.line, message: `"${r.no}" numaralı birden fazla öğrenci var` }); continue; } }
    if (!hit && r.name) { const m = byName.get(asciiFold(r.name)); if (m?.length === 1) hit = m[0]; else if (m?.length > 1) { errors.push({ line: r.line, message: `"${r.name}" adında birden fazla öğrenci var; numara yaz` }); continue; } }
    if (!hit) { errors.push({ line: r.line, message: `Öğrenci bulunamadı (${r.no || r.name}); kapsamındaki öğrencilerden biri olmalı` }); continue; }
    const a = per.get(hit.id) ?? { studentId: hit.id, name: hit.name, no: hit.no ?? '', items: [], dueDate: null };
    if (a.items.length >= MAX_ITEMS) { errors.push({ line: r.line, message: `${hit.name}: en çok ${MAX_ITEMS} madde` }); continue; }
    if (!a.items.some(i => i.topic === r.topic)) a.items.push({ topic: r.topic, target: r.target });
    if (r.due && (!a.dueDate || r.due > a.dueDate)) a.dueDate = r.due;
    per.set(hit.id, a);
  }
  const assignments = [...per.values()];
  if (assignments.length > MAX_ASSIGN) { errors.push({ line: 0, message: `Tek seferde en çok ${MAX_ASSIGN} öğrenciye ödev verilir` }); assignments.length = MAX_ASSIGN; }
  return { assignments, errors };
}

/** Bir (ödev, öğrenci) için konuşma durumu: bekleyen tarih talebi var mı? thread: Kind sırasıyla. */
export function openRequest(thread) {
  for (let i = thread.length - 1; i >= 0; i--) {
    const k = thread[i].kind;
    if (k === 'request') return thread[i];
    if (k === 'accept' || k === 'reject' || k === 'set') return null;
  }
  return null;
}

/** Öğrencinin ödev durumu: 'done' (onayladı) | 'late' (süresi geçti) | 'open'. */
export function hwStatus({ submitted, due }, today = new Date().toISOString().slice(0, 10)) {
  if (submitted) return 'done';
  if (due && due < today) return 'late';
  return 'open';
}
