// Kurum paneli saf yardımcıları (veritabanı gerektirmez → birim testle doğrulanır).
import crypto from 'node:crypto';

const TR = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
// Türkçe karakterleri ASCII'ye indirir; yalnızca a-z0-9 bırakır (kullanıcı adı / slug için)
export function asciiFold(s = '') {
  const lower = String(s).replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr-TR');
  return [...lower].map(ch => TR[ch] ?? ch).join('').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}
export const makeSlug = (name) => asciiFold(name).slice(0, 40);
export const SLUG_RE = /^[a-z0-9]{3,40}$/;

// ad.soyad (en çok 26 karakter); doluysa sondan numara eklenir. taken: küçük harfli Set (değiştirilir).
export function makeUsername(first, last, taken) {
  let base = [asciiFold(first), asciiFold(last)].filter(Boolean).join('.').slice(0, 26).replace(/\.$/, '');
  if (base.length < 3) base = (base + 'ogr').slice(0, 26);
  let name = base, n = 1;
  while (taken.has(name.toLowerCase())) { n += 1; name = base.slice(0, 26 - String(n).length) + n; }
  taken.add(name.toLowerCase());
  return name;
}

// Karışabilen karakterler (0/O, 1/l/I) yok; en az bir harf ve bir rakam garanti (şifre kuralı: harf + rakam, ≥8)
const LETTERS = 'abcdefghjkmnpqrstuvwxyz', DIGITS = '23456789';
export function genPassword(len = 8) {
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(LETTERS), pick(DIGITS)];
  while (chars.length < len) chars.push(pick(LETTERS + DIGITS));
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

// --- Excel'den yapıştırma / CSV ---
function detectDelimiter(line) {
  const [best] = ['\t', ';', ','].map(d => [d, line.split(d).length]).sort((a, b) => b[1] - a[1]);
  return best[1] > 1 ? best[0] : null;
}
// Tırnaklı alanları destekleyen tek satır ayrıştırıcı
function splitLine(line, d) {
  if (!d) return [line.trim()];
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const HEADERS = { ad: 'first', isim: 'first', soyad: 'last', soyadi: 'last', adsoyad: 'full', isimsoyisim: 'full', adisoyadi: 'full', ogrenci: 'full',
  no: 'no', numara: 'no', ogrencino: 'no', okulno: 'no', sinif: 'cls', sube: 'cls', sinifi: 'cls' };
const titleCase = (s) => s.toLocaleLowerCase('tr-TR').replace(/(^|[\s'-])(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('tr-TR'));

export const MAX_BULK = 300;
// text → { rows: [{ line, firstName, lastName, studentNo, className }], errors: [{ line, message }] }
// Başlık satırı varsa sütunlar adından, yoksa sırayla: Ad, Soyad, No, Sınıf.
export function parseStudentText(text) {
  const lines = String(text ?? '').replace(/^﻿/, '').split(/\r?\n/);
  const rows = [], errors = [];
  let map = null, d = null, started = false;
  const seenNo = new Map();
  lines.forEach((raw, idx) => {
    const line = idx + 1;
    if (!raw.trim()) return;
    if (!started) { d = detectDelimiter(raw); }
    const cells = splitLine(raw, d);
    if (!started) {
      started = true;
      const keys = cells.map(c => HEADERS[asciiFold(c)]);
      if (keys.some(Boolean) && keys.filter(Boolean).length >= Math.min(2, cells.length)) { map = keys; return; }   // başlık satırı
      map = cells.length === 1 ? ['full'] : ['first', 'last', 'no', 'cls'];
    }
    const rec = {};
    cells.forEach((c, i) => { const k = map[i]; if (k && c) rec[k] = c; });
    let first = rec.first, last = rec.last;
    if (rec.full && !first) {
      const parts = rec.full.split(/\s+/).filter(Boolean);
      last = parts.length > 1 ? parts.pop() : undefined; first = parts.join(' ');
    }
    if (!first || !last) return errors.push({ line, message: 'Ad ve soyad gerekli' });
    if (first.length > 40 || last.length > 40) return errors.push({ line, message: 'Ad veya soyad çok uzun' });
    const studentNo = rec.no ? String(rec.no).replace(/\s+/g, '') : null;
    if (studentNo && !/^[\p{L}\p{N}_.-]{1,20}$/u.test(studentNo)) return errors.push({ line, message: 'Öğrenci numarası geçersiz (en çok 20 harf/rakam)' });
    if (studentNo) {
      if (seenNo.has(studentNo)) return errors.push({ line, message: `Numara ${studentNo} ${seenNo.get(studentNo)}. satırda da var` });
      seenNo.set(studentNo, line);
    }
    rows.push({ line, firstName: titleCase(first), lastName: titleCase(last), studentNo, className: rec.cls ? rec.cls.trim().slice(0, 40) : null });
  });
  if (rows.length + errors.length > MAX_BULK) return { rows: [], errors: [{ line: 0, message: `Tek seferde en çok ${MAX_BULK} öğrenci eklenebilir` }] };
  return { rows, errors };
}

// Giriş bilgisi çıktısı: Excel'in Türkçe ayarında doğru açılması için ; ayraç + BOM istemcide eklenir
export const csvCell = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

// --- Yetki ---
export const STAFF = new Set(['owner', 'teacher']);
export const isStaff = (role) => STAFF.has(role);
// Öğretmen yalnızca atandığı sınıflara erişir; owner kurumdaki tüm sınıflara
export const canAccessClass = (role, assignedIds, classId) => role === 'owner' || (role === 'teacher' && assignedIds.includes(classId));
// Taşıma: öğretmen için kaynak ve hedef sınıfın ikisi de atandığı sınıflardan olmalı (sahipsiz öğrenciyi yalnızca yönetici yerleştirir)
export const canTransfer = (role, assignedIds, fromId, toId) =>
  role === 'owner' || (role === 'teacher' && fromId != null && toId != null && assignedIds.includes(fromId) && assignedIds.includes(toId));

// Sınıf değiştirme sınavı önerisi: net'e göre sıralı öğrencileri kotalara böler.
// students: [{ id, score }], tiers: [{ classId, size }] (son kademe size=null → kalanlar). Eşit puanda id sırası (kararlı).
export function suggestPlacement(students, tiers) {
  const sorted = [...students].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.id - b.id);
  const out = []; let i = 0;
  for (const t of tiers) {
    const n = t.size == null ? sorted.length - i : Math.max(0, t.size);
    for (const s of sorted.slice(i, i + n)) out.push({ studentId: s.id, toClassId: t.classId, rank: sorted.indexOf(s) + 1, score: s.score });
    i += n;
  }
  return out;
}

// Net düşüşü: nets en yeniden eskiye. Son deneme, ondan önceki en çok 3 denemenin ortalamasından en az 3 net ve %15 düşükse uyarı.
export function netDrop(nets) {
  if (nets.length < 3) return null;
  const prev = nets.slice(1, 4), avg = prev.reduce((a, b) => a + b, 0) / prev.length, drop = avg - nets[0];
  if (avg <= 0 || drop < 3 || drop / avg < 0.15) return null;
  return { last: Math.round(nets[0] * 100) / 100, avg: Math.round(avg * 100) / 100, drop: Math.round(drop * 100) / 100 };
}
