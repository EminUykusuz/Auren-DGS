// DB gerektirmez: node --test test/kurum-lib.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { asciiFold, makeSlug, makeUsername, genPassword, parseStudentText, canAccessClass, canTransfer, suggestPlacement, csvCell } from '../src/kurum-lib.js';

test('asciiFold Türkçe karakterleri indirger', () => {
  assert.equal(asciiFold('Çağlar İŞÇİ Ğüneş'), 'caglariscigunes');
  assert.equal(asciiFold('ISPARTA'), 'isparta');
  assert.equal(makeSlug('Işık Dershanesi!'), 'isikdershanesi');
});

test('makeUsername: çakışmada numara ekler, uzunluğu aşmaz', () => {
  const taken = new Set();
  assert.equal(makeUsername('Ayşe', 'Yılmaz', taken), 'ayse.yilmaz');
  assert.equal(makeUsername('Ayşe', 'Yılmaz', taken), 'ayse.yilmaz2');
  assert.equal(makeUsername('Ayşe', 'Yılmaz', taken), 'ayse.yilmaz3');
  const long = makeUsername('Muhammedmuhammedmuhammed', 'Karaosmanoglu', new Set());
  assert.ok(long.length <= 26 && !long.endsWith('.'));
  const t2 = new Set(['abcdefghijklmnopqrstuvwxyz']);
  const u = makeUsername('abcdefghijklmnopqrstuvwxyz', '', t2);
  assert.ok(u.length <= 26 && u !== 'abcdefghijklmnopqrstuvwxyz');
});

test('genPassword: uzunluk, harf+rakam, belirsiz karakter yok, rastgele', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const p = genPassword();
    assert.equal(p.length, 8); assert.match(p, /[a-z]/); assert.match(p, /\d/); assert.doesNotMatch(p, /[0o1liI]/);
    seen.add(p);
  }
  assert.ok(seen.size > 295);
});

test('parseStudentText: Excel yapıştırma (sekme), başlıklı', () => {
  const r = parseStudentText('Ad\tSoyad\tNo\tSınıf\nayşe\tyılmaz\t101\t8-A\nMEHMET\tKAYA\t102\t8-B\n');
  assert.deepEqual(r.errors, []);
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows[0], { line: 2, firstName: 'Ayşe', lastName: 'Yılmaz', studentNo: '101', className: '8-A' });
  assert.equal(r.rows[1].firstName, 'Mehmet');
});

test('parseStudentText: noktalı virgül, BOM, başlıksız, tek sütun "Ad Soyad"', () => {
  const a = parseStudentText('﻿Ali;Veli;5\r\nZeynep;Su;6\r\n');
  assert.equal(a.rows.length, 2); assert.equal(a.rows[0].studentNo, '5');
  const b = parseStudentText('Ad Soyad\nAli Can Veli\nSelin Demir');
  assert.equal(b.rows[0].firstName, 'Ali Can'); assert.equal(b.rows[0].lastName, 'Veli');
  assert.equal(b.rows[1].lastName, 'Demir');
});

test('parseStudentText: hatalar satır numarasıyla; yinelenen numara reddedilir', () => {
  const r = parseStudentText('Ad,Soyad,No\nAli,,1\nVeli,Kaya,7\nCan,Er,7\nX,Y,bad no!');
  assert.equal(r.rows.length, 1);
  assert.deepEqual(r.errors.map(e => e.line), [2, 4, 5]);
});

test('parseStudentText: tırnaklı alan ve üst sınır', () => {
  const r = parseStudentText('"Ali, Can",Veli');
  assert.equal(r.rows[0].firstName, 'Ali, Can');
  const big = Array.from({ length: 301 }, (_, i) => `A${i};B`).join('\n');
  assert.equal(parseStudentText(big).rows.length, 0);
});

test('yetki: öğretmen yalnız atandığı sınıflara erişir', () => {
  assert.equal(canAccessClass('owner', [], 9), true);
  assert.equal(canAccessClass('teacher', [1, 2], 2), true);
  assert.equal(canAccessClass('teacher', [1, 2], 3), false);
  assert.equal(canAccessClass('student', [1], 1), false);
  assert.equal(canTransfer('teacher', [1, 2], 1, 2), true);
  assert.equal(canTransfer('teacher', [1], 1, 2), false);
  assert.equal(canTransfer('teacher', [1], null, null), false);
  assert.equal(canTransfer('owner', [], 5, 6), true);
});

test('suggestPlacement: net sırasına göre kademelere böler', () => {
  const s = [{ id: 1, score: 50 }, { id: 2, score: 80 }, { id: 3, score: 65 }, { id: 4, score: 20 }, { id: 5, score: null }];
  const p = suggestPlacement(s, [{ classId: 'A', size: 2 }, { classId: 'B', size: null }]);
  assert.deepEqual(p.filter(x => x.toClassId === 'A').map(x => x.studentId), [2, 3]);
  assert.deepEqual(p.filter(x => x.toClassId === 'B').map(x => x.studentId), [1, 4, 5]);
  assert.equal(p.length, 5);
});

test('csvCell kaçışlar', () => { assert.equal(csvCell('a;b'), '"a;b"'); assert.equal(csvCell('x"y'), '"x""y"'); assert.equal(csvCell('ok'), 'ok'); });
