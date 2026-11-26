import test from 'node:test';
import assert from 'node:assert/strict';
import { net, sectionNets } from '../src/calc.js';
import { EXAM_TYPES, PARTS, WRONG_DIV, CURRICULUM, TOPIC_KEYS, partOf, publicConfig } from '../src/exams.js';

test('LGS net: 3 yanlış 1 doğruyu götürür', () => {
  assert.equal(net(10, 3, 3), 9);
  assert.equal(net(10, 1, 3), 9.67);
  assert.equal(net(0, 2, 3), -0.67);
  assert.equal(net(20, 0, 3), 20);
});
test('DGS/YKS net değişmedi (4 yanlış 1 doğru)', () => {
  assert.equal(net(30, 4), 29); assert.equal(net(10, 1, 4), 9.75); assert.equal(WRONG_DIV.DGS, 4); assert.equal(WRONG_DIV.YKS, 4); assert.equal(WRONG_DIV.LGS, 3);
});
test('LGS: 6 ders, 90 soru, her dersin müfredatı var', () => {
  assert.ok(EXAM_TYPES.includes('LGS'));
  const def = partOf('LGS', 'LGS');
  assert.equal(def.sections.length, 6);
  assert.equal(def.sections.reduce((s, x) => s + x.max, 0), 90);
  for (const s of def.sections) { assert.ok(TOPIC_KEYS.LGS.LGS[s.key].size > 0, s.key + ' müfredatsız'); assert.ok(s.key.length <= 10, 'SectionKey VARCHAR(10)'); }
  assert.ok(publicConfig().types.some(t => t.id === 'LGS'));
});
test('LGS bölüm netleri ve toplam (2 haneye yuvarlı)', () => {
  const def = partOf('LGS', 'LGS');
  const r = sectionNets(def.sections, { turkce: { correct: 18, wrong: 2 }, matematik: { correct: 10, wrong: 4 }, fen: { correct: 15, wrong: 1 } }, 3);
  assert.equal(r.nets.turkce, 17.33); assert.equal(r.nets.matematik, 8.67); assert.equal(r.nets.fen, 14.67);
  assert.equal(r.totalNet, 40.67);
  // DB kısıtı: Net, Doğru − Yanlış/3 değerine 0.005 içinde olmalı
  for (const [k, a] of Object.entries({ turkce: [18, 2], matematik: [10, 4], fen: [15, 1] })) assert.ok(Math.abs(r.nets[k] - (a[0] - a[1] / 3)) <= 0.005);
});
