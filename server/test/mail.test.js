// E-posta şablonları (saf birim testleri; ağ ve veritabanı gerekmez).
import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { homeworkMailHtml, resetMailHtml, isRealEmail } from '../src/mailer.js';

test('isRealEmail: yer tutucu ve boş adres gerçek sayılmaz', () => {
  assert.equal(isRealEmail('veli@gmail.com'), true);
  assert.equal(isRealEmail('ali@ogrenci.invalid'), false); assert.equal(isRealEmail(null), false); assert.equal(isRealEmail('yok'), false);
});

test('ödev e-postası: kullanıcı verisi HTML\'e kaçışlanır; teslim ve madde görünür; 8\'den fazla madde özetlenir', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ topic: i === 0 ? '<script>alert(1)</script>' : 'Konu ' + i, target: 20 }));
  const h = homeworkMailHtml({ name: 'Ayşe "Öğr"', teacher: '<b>Hoca</b>', inst: 'Kurum & Ortakları', title: 'Hafta <1>', due: '2026-12-18', items, personal: true, link: 'https://x.test/odev?a=1&b="2"' });
  assert.ok(!h.includes('<script>') && !h.includes('<b>Hoca</b>') && !h.includes('Hafta <1>'));
  assert.ok(h.includes('&lt;script&gt;') && h.includes('Kurum &amp; Ortakları') && h.includes('sana özel'));
  assert.ok(h.includes('18 Aralık 2026') && h.includes('ve 2 madde daha') && h.includes('href="https://x.test/odev?a=1&amp;b=&quot;2&quot;"'));
  assert.ok(!homeworkMailHtml({ name: 'A', teacher: 'H', inst: 'K', title: 'T', due: null, items: [{ topic: 'x', target: null }], personal: false, link: 'https://x.test' }).includes('Teslim:'));
});

test('şifre sıfırlama e-postası: bağlantı kaçışlanır', () => {
  assert.ok(resetMailHtml('https://x.test/r?t=1&u="2"', 15).includes('t=1&amp;u=&quot;2&quot;'));
});
