import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { buildXlsx, crc32, colName } from '../src/xlsx.js';

test('crc32 bilinen değer', () => assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926));
test('sütun adları', () => { assert.equal(colName(0), 'A'); assert.equal(colName(25), 'Z'); assert.equal(colName(26), 'AA'); assert.equal(colName(701), 'ZZ'); });

// ZIP'i geri okuyup yapıyı doğrular (yerel başlık + CRC + içerik)
function readZip(buf) {
  const out = {}; let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const crc = buf.readUInt32LE(p + 14), n = buf.readUInt32LE(p + 18), nl = buf.readUInt16LE(p + 26), el = buf.readUInt16LE(p + 28);
    const name = buf.toString('utf8', p + 30, p + 30 + nl), data = buf.subarray(p + 30 + nl + el, p + 30 + nl + el + n);
    assert.equal(crc32(data), crc, name); out[name] = data.toString('utf8'); p += 30 + nl + el + n;
  }
  return out;
}

test('xlsx: geçerli zip, başlık stili, sayı ve metin, kaçış', () => {
  const z = readZip(buildXlsx([{ name: 'Öğrenciler/1?', rows: [['Ad', 'Net'], ['=HYPERLINK("x")', 12.5], ['A & <B>', null]], widths: [20, 8] }]));
  assert.ok(z['[Content_Types].xml'] && z['xl/workbook.xml'] && z['xl/worksheets/sheet1.xml']);
  assert.match(z['xl/workbook.xml'], /name="Öğrenciler 1 "/);
  const s = z['xl/worksheets/sheet1.xml'];
  assert.match(s, /<c r="A1" s="1" t="inlineStr">/);
  assert.match(s, /<c r="B2"><v>12\.5<\/v><\/c>/);
  assert.match(s, /t="inlineStr"><is><t xml:space="preserve">=HYPERLINK/); // formül değil, metin
  assert.match(s, /A &amp; &lt;B&gt;/);
  assert.doesNotMatch(s, /r="B3"/);
});
test('xlsx: gzip ile uyumsuz değil (bozuk değil) ve büyük satır sayısı', () => {
  const rows = [['n']]; for (let i = 0; i < 5000; i++) rows.push([i]);
  const buf = buildXlsx([{ name: 'a', rows }]); assert.ok(buf.length > 1000); assert.ok(zlib.gzipSync(buf).length > 0);
});
