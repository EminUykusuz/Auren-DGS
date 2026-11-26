// Bağımlılıksız .xlsx okuyucu: ilk sayfayı satırlar × hücreler (metin) olarak döndürür. Excel, LibreOffice, Google E-Tablolar ve xlsx.js çıktısını okur.
// Güvenlik: yalnızca merkezi dizin okunur; açılmış boyut ve dosya sayısı sınırlıdır (zip bombası), formül ÇALIŞTIRILMAZ (yalnızca önbellekteki değer okunur).
import zlib from 'node:zlib';

const MAX_FILES = 200, MAX_XML = 8 * 1024 * 1024, MAX_ROWS = 3000, MAX_COLS = 30;

function entries(buf) {
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Geçerli bir Excel (.xlsx) dosyası değil');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  if (n > MAX_FILES) throw new Error('Dosya çok karmaşık');
  const out = new Map();
  for (let k = 0; k < n; k++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Excel dosyası bozuk');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    out.set(buf.toString('utf8', p + 46, p + 46 + nl), { method, csize, usize, off });
    p += 46 + nl + xl + cl;
  }
  return out;
}

function read(buf, ent) {
  if (!ent || ent.usize > MAX_XML) return null;
  if (buf.readUInt32LE(ent.off) !== 0x04034b50) throw new Error('Excel dosyası bozuk');
  const start = ent.off + 30 + buf.readUInt16LE(ent.off + 26) + buf.readUInt16LE(ent.off + 28);
  const data = buf.subarray(start, start + ent.csize);
  if (ent.method === 0) return data.toString('utf8');
  if (ent.method === 8) return zlib.inflateRawSync(data, { maxOutputLength: MAX_XML }).toString('utf8');
  throw new Error('Desteklenmeyen sıkıştırma');
}

const unesc = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, g) =>
  g[0] === '#' ? String.fromCodePoint(g[1] === 'x' ? parseInt(g.slice(2), 16) : Number(g.slice(1))) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[g]));
const textOf = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => unesc(m[1])).join('');
const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

// Excel seri sayısı (1900 sistemi) → YYYY-MM-DD
export const serialToIso = (n) => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10);

/** @returns {{ rows: string[][] }} hücreler metin; tarih biçimli sayısal hücreler ISO tarih (YYYY-MM-DD) olarak gelir */
export function readXlsx(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error('Geçerli bir Excel (.xlsx) dosyası değil');
  const ent = entries(buf);
  const shared = [];
  const ssXml = read(buf, ent.get('xl/sharedStrings.xml'));
  if (ssXml) for (const m of ssXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]));
  // Tarih biçimli hücreler: styles.xml'deki numFmt/cellXfs → hangi stil indeksleri tarih
  const dateStyles = new Set();
  const stXml = read(buf, ent.get('xl/styles.xml'));
  if (stXml) {
    const custom = new Map([...stXml.matchAll(/<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]*)"/g)].map(m => [Number(m[1]), m[2]]));
    const isDate = (id) => (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (custom.has(id) && /[dmy]/i.test(custom.get(id).replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')));
    const xfs = (stXml.match(/<cellXfs[\s\S]*?<\/cellXfs>/) ?? [''])[0];
    [...xfs.matchAll(/<xf\s[^>]*?numFmtId="(\d+)"/g)].forEach((m, i) => { if (isDate(Number(m[1]))) dateStyles.add(i); });
  }
  const sheet = [...ent.keys()].filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))[0];
  const xml = sheet && read(buf, ent.get(sheet));
  if (!xml) throw new Error('Excel dosyasında sayfa bulunamadı');
  const rows = [];
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    if (rows.length >= MAX_ROWS) break;
    const row = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], inner = cm[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1]; const type = attrs.match(/\bt="(\w+)"/)?.[1]; const st = Number(attrs.match(/\bs="(\d+)"/)?.[1] ?? -1);
      const ci = ref ? colIndex(ref) : row.length; if (ci >= MAX_COLS) continue;
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let val = '';
      if (type === 's') val = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') val = textOf(inner);
      else if (type === 'str' || type === 'e') val = v == null ? '' : unesc(v);
      else if (type === 'b') val = v === '1' ? 'Evet' : 'Hayır';
      else if (v != null) val = dateStyles.has(st) && Number(v) > 20000 && Number(v) < 80000 ? serialToIso(Number(v)) : unesc(v);
      row[ci] = val.trim();
    }
    for (let i = 0; i < row.length; i++) row[i] ??= '';
    rows.push(row);
  }
  return { rows };
}
