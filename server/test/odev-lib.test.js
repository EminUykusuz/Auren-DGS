// Saf birim testleri (veritabanı gerekmez): Excel okuyucu, CSV ayrıştırıcı, öğrenci eşleme.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readXlsx, serialToIso } from '../src/xlsx-read.js';
import { buildXlsx } from '../src/xlsx.js';
import { parseDelimited, parseRecords, buildAssignments, parseDate, openRequest, hwStatus } from '../src/odev-lib.js';

const fx = (n) => fs.readFileSync(new URL('./fixtures/' + n, import.meta.url));
const STUDENTS = [
  { id: 1, name: 'Ayşe Yılmaz', no: '101', username: 'ayse.yilmaz' },
  { id: 2, name: 'Mehmet Kaya', no: '102', username: 'mehmet.kaya' },
  { id: 3, name: 'Zeynep Çelik', no: '103', username: 'zeynep.celik' },
  { id: 4, name: 'Ali Demir', no: '201', username: 'ali.demir' },
  { id: 5, name: 'Ali Demir', no: '202', username: 'ali.demir2' },
];
const rec = (o) => ({ line: 1, no: '', name: '', topic: 'Konu', target: null, due: null, ...o });

test('xlsx okuyucu: sharedStrings + tarih biçimi + deflate (el yapımı dosya)', () => {
  const { rows } = readXlsx(fx('odev-excel.xlsx'));
  assert.deepEqual(rows[0], ['Öğrenci no', 'Ad Soyad', 'Konu', 'Hedef soru', 'Teslim tarihi']);
  assert.deepEqual(rows[1], ['101', 'Ayşe Yılmaz', 'Üslü ifadeler', '40', '2026-12-16']);
  assert.equal(rows[2][2], 'Paragraf & dil');           // &amp; çözülür
  assert.equal(rows.length, 4);
});

test('xlsx okuyucu: openpyxl çıktısı (gerçek Excel kütüphanesi)', () => {
  const { rows } = readXlsx(fx('odev-openpyxl.xlsx'));
  assert.equal(rows[0][0], 'Öğrenci no');
  assert.deepEqual(rows[1], ['101', 'Ayşe Yılmaz', 'Üslü ifadeler', '40', '2026-12-18']);
  assert.equal(rows[3][4], '20.12.2026');
});

test('xlsx okuyucu: kendi yazıcımızın çıktısını geri okur (inlineStr, saklı zip)', () => {
  const buf = buildXlsx([{ name: 'S', rows: [['Konu', 'Hedef'], ['Üslü; ifade', 40], ['=1+1', '']] }]);
  const { rows } = readXlsx(buf);
  assert.deepEqual(rows, [['Konu', 'Hedef'], ['Üslü; ifade', '40'], ['=1+1']]);   // formül metni olarak kalır, çalıştırılmaz
});

test('xlsx okuyucu: xlsx olmayan / bozuk dosya reddedilir', () => {
  assert.throws(() => readXlsx(Buffer.from('merhaba dünya')), /Excel/);
  assert.throws(() => readXlsx(Buffer.from('PK\x03\x04bozuk-bozuk-bozuk-bozuk-bozuk')), Error);
  const good = fx('odev-excel.xlsx'); const cut = Buffer.concat([good.subarray(0, 100), Buffer.alloc(30)]);
  assert.throws(() => readXlsx(cut), Error);
});

test('serialToIso', () => { assert.equal(serialToIso(46372), '2026-12-16'); assert.equal(serialToIso(45292), '2024-01-01'); });

test('parseDelimited: sekme, noktalı virgül, virgül, tırnaklı alan, BOM', () => {
  assert.deepEqual(parseDelimited('a\tb\tc\n1\t2\t3'), [['a', 'b', 'c'], ['1', '2', '3']]);
  assert.deepEqual(parseDelimited('﻿no;ad;konu\r\n101;Ayşe;"Üslü; ifade"\r\n'), [['no', 'ad', 'konu'], ['101', 'Ayşe', 'Üslü; ifade']]);
  assert.deepEqual(parseDelimited('a,b\n"x ""q"" y",z'), [['a', 'b'], ['x "q" y', 'z']]);
  assert.deepEqual(parseDelimited('\n\n'), []);
});

test('parseDate: ISO, GG.AA.YYYY, GG/AA/YYYY; geçersizler null', () => {
  assert.equal(parseDate('2026-12-18'), '2026-12-18'); assert.equal(parseDate('18.12.2026'), '2026-12-18'); assert.equal(parseDate('1/2/2027'), '2027-02-01');
  assert.equal(parseDate('31.02.2026'), null); assert.equal(parseDate('yarın'), null); assert.equal(parseDate(''), null);
});

test('parseRecords: başlık adına göre sütun bulur, sütun sırası fark etmez', () => {
  const r = parseRecords([['Konu', 'Ad Soyad', 'Teslim', 'Hedef soru', 'Öğrenci no'], ['Paragraf', 'Ayşe Yılmaz', '2026-12-18', '30', '101']]);
  assert.equal(r.header, true);
  assert.deepEqual(r.records[0], { line: 2, no: '101', name: 'Ayşe Yılmaz', topic: 'Paragraf', target: 30, due: '2026-12-18' });
});
test('parseRecords: başlıksız → sırayla No, Ad, Konu, Hedef, Teslim; konusu boş satır atlanır', () => {
  const r = parseRecords([['101', 'Ayşe Yılmaz', 'Üslü', '40', ''], ['102', 'Mehmet Kaya', '', '', '']]);
  assert.equal(r.header, false); assert.equal(r.records.length, 1); assert.equal(r.records[0].target, 40); assert.equal(r.errors.length, 0);
});
test('parseRecords: hatalı hedef/tarih/öğrencisiz satır hata verir, diğerleri devam eder', () => {
  const r = parseRecords([['no', 'ad', 'konu', 'hedef', 'teslim'], ['1', 'A', 'x', '0', ''], ['1', 'A', 'x', 'çok', ''], ['1', 'A', 'x', '', '40.40.2026'], ['', '', 'x', '', ''], ['1', 'A', 'iyi', '5', '']]);
  assert.equal(r.records.length, 1); assert.equal(r.errors.length, 4); assert.ok(r.errors.every(e => e.line >= 2));
});

test('buildAssignments: numara öncelikli; aynı öğrencinin satırları birleşir; en geç tarih alınır; boş satır ödev almaz', () => {
  const { records } = parseRecords(readXlsx(fx('odev-openpyxl.xlsx')).rows);
  const { assignments, errors } = buildAssignments(records, STUDENTS);
  const ayse = assignments.find(a => a.studentId === 1);
  assert.deepEqual(ayse.items, [{ topic: 'Üslü ifadeler', target: 40 }, { topic: 'Paragraf', target: 30 }]);
  assert.equal(ayse.dueDate, '2026-12-18');
  assert.equal(assignments.find(a => a.studentId === 2).dueDate, '2026-12-20');
  assert.equal(assignments.find(a => a.studentId === 3), undefined);                 // şablondaki boş satır
  assert.equal(errors.length, 1); assert.match(errors[0].message, /bulunamadı/);      // 999 kapsamda değil
});
test('buildAssignments: aynı adlı iki öğrenci numarasız eşlenmez (yanlış kişiye ödev gitmesin)', () => {
  const bad = buildAssignments([rec({ name: 'Ali Demir' })], STUDENTS);
  assert.equal(bad.assignments.length, 0); assert.match(bad.errors[0].message, /birden fazla/);
  const ok = buildAssignments([rec({ no: '202', name: 'Ali Demir' })], STUDENTS);
  assert.equal(ok.assignments[0].studentId, 5);
});
test('buildAssignments: numara yanlışsa adla eşler; Türkçe harf ve büyük/küçük harf farkı önemsiz', () => {
  assert.equal(buildAssignments([rec({ no: '777', name: 'AYŞE yılmaz' })], STUDENTS).assignments[0]?.studentId, 1);
  assert.equal(buildAssignments([rec({ name: 'zeynep CELIK' })], STUDENTS).assignments[0]?.studentId, 3);
});
test('buildAssignments: öğrenci başına en çok 60 madde, aynı konu iki kez eklenmez', () => {
  const many = Array.from({ length: 70 }, (_, i) => rec({ no: '101', topic: 'K' + i, line: i + 2 }));
  const r = buildAssignments([...many, rec({ no: '101', topic: 'K0' })], STUDENTS);
  assert.equal(r.assignments[0].items.length, 60); assert.ok(r.errors.length >= 10);
});

test('openRequest: bekleyen tarih talebi; kabul/ret/hoca tarihi sonrası kapanır', () => {
  assert.equal(openRequest([]), null);
  assert.equal(openRequest([{ kind: 'msg' }, { kind: 'request', id: 1 }])?.id, 1);
  assert.equal(openRequest([{ kind: 'request' }, { kind: 'accept' }]), null);
  assert.equal(openRequest([{ kind: 'request' }, { kind: 'reject' }, { kind: 'request', id: 3 }])?.id, 3);
  assert.equal(openRequest([{ kind: 'request' }, { kind: 'set' }]), null);
});
test('hwStatus', () => {
  assert.equal(hwStatus({ submitted: true, due: '2020-01-01' }, '2026-01-01'), 'done');
  assert.equal(hwStatus({ submitted: false, due: '2025-12-31' }, '2026-01-01'), 'late');
  assert.equal(hwStatus({ submitted: false, due: '2026-01-01' }, '2026-01-01'), 'open');
  assert.equal(hwStatus({ submitted: false, due: null }, '2026-01-01'), 'open');
});
