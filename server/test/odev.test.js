// DB'ye karşı çalışır (kurum.test.js gibi). Önce migration 009-011 uygulanmış olmalı. Çalıştırma: cd server && node --test test/odev.test.js
import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { query } from '../src/db.js';

let server, base;
const sfx = (Date.now() + 7).toString(36);
class Client {
  constructor() { this.cookie = ''; }
  async call(method, path, body) {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.getSetCookie?.().find(c => c.startsWith('dgs_token'));
    if (sc) this.cookie = sc.split(';')[0];
    return { status: res.status, json: await res.json().catch(() => null) };
  }
  async raw(method, path, buf) {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/octet-stream', cookie: this.cookie }, body: buf });
    return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') };
  }
}
const [OWN, TEA, STU, STU2, OTHER, ANON] = [new Client(), new Client(), new Client(), new Client(), new Client(), new Client()];
let inst1, inst2, cA, cB, cX, pw = 'Sahip1234x';

async function mkUser(name, role, instId, classId = null) {
  const h = await bcrypt.hash(pw, 4);
  const username = `${name}_${sfx}`.slice(0, 30);
  await query(`INSERT INTO dbo.Users (Username, Email, PasswordHash, InstitutionId, Role, ClassId, FullName) VALUES (@u,@e,@h,@i,@r,@c,@f)`,
    { u: username, e: `${name}.${sfx}@test.local`, h, i: instId, r: role, c: classId, f: 'Ad ' + name });
  return username;
}

test.before(async () => {
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}/api`;
  inst1 = (await query(`INSERT INTO dbo.Institutions (Name, Slug) OUTPUT INSERTED.Id VALUES (@n,@s)`, { n: 'Ödev Kurum 1', s: `o1${sfx}`.slice(0, 40) }))[0].Id;
  inst2 = (await query(`INSERT INTO dbo.Institutions (Name, Slug) OUTPUT INSERTED.Id VALUES (@n,@s)`, { n: 'Ödev Kurum 2', s: `o2${sfx}`.slice(0, 40) }))[0].Id;
  cA = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'A')`, { i: inst1 }))[0].Id;
  cB = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'B')`, { i: inst1 }))[0].Id;
  cX = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'X')`, { i: inst2 }))[0].Id;
  const names = {
    own: await mkUser('own', 'owner', inst1), tea: await mkUser('tea', 'teacher', inst1), oth: await mkUser('oth', 'owner', inst2),
    s1: await mkUser('s1', 'student', inst1, cA), s2: await mkUser('s2', 'student', inst1, cB),
  };
  const [t] = await query(`SELECT Id FROM dbo.Users WHERE Username=@u`, { u: names.tea });
  await query(`INSERT INTO dbo.TeacherClasses (TeacherId, ClassId) VALUES (@t,@c)`, { t: t.Id, c: cA });
  for (const [c, n] of [[OWN, 'own'], [TEA, 'tea'], [OTHER, 'oth'], [STU, 's1'], [STU2, 's2']]) assert.equal((await c.call('POST', '/auth/login', { identifier: names[n], password: pw })).status, 200);
});
test.after(async () => {
  await query(`DELETE FROM dbo.Homework WHERE InstitutionId IN (${inst1}, ${inst2})`);
  await query(`DELETE FROM dbo.TeacherClasses WHERE ClassId IN (${cA}, ${cB}, ${cX})`);
  await query(`DELETE FROM dbo.Users WHERE Email LIKE '%.${sfx}@test.local'`);
  await query(`DELETE FROM dbo.Classes WHERE InstitutionId IN (${inst1}, ${inst2})`);
  await query(`DELETE FROM dbo.Institutions WHERE Id IN (${inst1}, ${inst2})`);
  server.close(); setTimeout(() => process.exit(0), 100);
});

const body = (classId, extra = {}) => ({ classId, title: 'Hafta 1', note: 'not', dueDate: '2026-12-01', items: [{ topic: 'Üslü ifadeler', target: 40 }, { topic: 'Paragraf', target: null }], ...extra });
let hw;

test('ödev: oturumsuz 401; öğrenci personel uçlarına 404', async () => {
  assert.equal((await ANON.call('GET', '/odev/homework')).status, 401);
  assert.equal((await STU.call('GET', '/odev/homework')).status, 404);
  assert.equal((await STU.call('POST', '/odev/homework', body(cA))).status, 404);
});

test('ödev: yönetici verir; öğretmen yalnız kendi sınıfına; başka kurum sınıfı 404', async () => {
  const r = await OWN.call('POST', '/odev/homework', body(cA)); assert.equal(r.status, 201); hw = r.json.id;
  assert.equal((await OWN.call('POST', '/odev/homework', body(cB))).status, 201);
  assert.equal((await TEA.call('POST', '/odev/homework', body(cA, { title: 'Hafta 2' }))).status, 201);
  assert.equal((await TEA.call('POST', '/odev/homework', body(cB))).status, 404);       // atanmadığı sınıf
  assert.equal((await OWN.call('POST', '/odev/homework', body(cX))).status, 404);       // başka kurumun sınıfı
  assert.equal((await OWN.call('POST', '/odev/homework', body(cA, { items: [] }))).status, 400);
  const mine = await TEA.call('GET', '/odev/homework');
  assert.equal(mine.json.homework.length, 2); assert.ok(mine.json.homework.every(h => h.className === 'A'));
  assert.equal((await OWN.call('GET', '/odev/homework')).json.homework.length, 3);
});

test('ödev: IDOR - başka kurum ve başka sınıf öğrencisi göremez/işaretleyemez', async () => {
  assert.equal((await OTHER.call('GET', `/odev/homework/${hw}`)).status, 404);
  assert.equal((await OTHER.call('DELETE', `/odev/homework/${hw}`)).status, 404);
  assert.equal((await OTHER.call('GET', `/odev/homework/${hw}/results.xlsx`)).status, 404);
  assert.equal((await STU2.call('GET', `/odev/homework/${hw}/sheet.xlsx`)).status, 404);   // B sınıfı öğrencisi A ödevini göremez
  const d = (await OWN.call('GET', `/odev/homework/${hw}`)).json;
  assert.equal((await STU2.call('PUT', `/odev/my/${hw}/items/${d.items[0].id}`, { done: true })).status, 404);
  assert.equal((await TEA.call('GET', `/odev/homework/${(await OWN.call('GET', '/odev/homework')).json.homework.find(h => h.className === 'B').id}`)).status, 404);
});

test('ödev: öğrenci kendi sınıfının ödevini görür, işaretler; öğretmen takip eder', async () => {
  const my = (await STU.call('GET', '/odev/my')).json.homework;
  assert.equal(my.length, 2); assert.ok(my.every(h => h.className === 'A'));
  const h = my.find(x => x.id === hw);
  assert.deepEqual(h.items.map(i => i.done), [false, false]); assert.equal(h.items[0].target, 40);
  assert.equal((await STU.call('PUT', `/odev/my/${hw}/items/${h.items[0].id}`, { done: true })).status, 200);
  assert.equal((await STU.call('PUT', `/odev/my/${hw}/items/${h.items[0].id}`, { done: true })).status, 200);   // tekrar: hata yok
  assert.equal((await STU.call('GET', '/odev/my')).json.homework.find(x => x.id === hw).items[0].done, true);
  const det = (await TEA.call('GET', `/odev/homework/${hw}`)).json;
  assert.deepEqual(det.students.map(s => s.done), [[true, false]]);
  assert.equal((await STU.call('PUT', `/odev/my/${hw}/items/${h.items[0].id}`, { done: false })).status, 200);
  assert.equal((await TEA.call('GET', `/odev/homework/${hw}`)).json.students[0].done[0], false);
});

test('ödev: Excel çıktıları geçerli xlsx (zip imzası) olarak iner', async () => {
  for (const [c, p] of [[STU, `/odev/homework/${hw}/sheet.xlsx`], [OWN, `/odev/homework/${hw}/sheet.xlsx`], [TEA, `/odev/homework/${hw}/results.xlsx`]]) {
    const r = await c.raw('GET', p);
    assert.equal(r.status, 200); assert.equal(r.buf.subarray(0, 4).toString('hex'), '504b0304'); assert.match(r.type, /spreadsheetml/);
  }
  assert.equal((await STU.raw('GET', `/odev/homework/${hw}/results.xlsx`)).status, 404);   // sonuç Excel'i yalnız personel
});

test('ödev: dosya eki yalnız gerçek xlsx/pdf; öğrenci indirir; öğrenci yükleyemez; silinince gider', async () => {
  const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.alloc(200, 1)]);
  const pdf = Buffer.from('%PDF-1.4\n' + 'x'.repeat(100));
  assert.equal((await OWN.raw('PUT', `/odev/homework/${hw}/file?name=odev.xlsx`, Buffer.from('MZ-calistirilabilir-dosya'))).status, 400);   // uzantı/içerik uyuşmaz
  assert.equal((await STU.raw('PUT', `/odev/homework/${hw}/file?name=odev.xlsx`, zip)).status, 404);
  assert.equal((await OTHER.raw('PUT', `/odev/homework/${hw}/file?name=odev.xlsx`, zip)).status, 404);
  const up = await OWN.raw('PUT', `/odev/homework/${hw}/file?name=${encodeURIComponent('Hafta 1 / ödev.xlsx')}`, zip);
  assert.equal(up.status, 200); assert.match(JSON.parse(up.buf.toString()).fileName, /\.xlsx$/); assert.ok(!/[\\/]/.test(JSON.parse(up.buf.toString()).fileName));
  const dl = await STU.raw('GET', `/odev/homework/${hw}/file`);
  assert.equal(dl.status, 200); assert.equal(dl.buf.length, zip.length);
  assert.equal((await STU2.raw('GET', `/odev/homework/${hw}/file`)).status, 404);
  assert.equal((await OWN.raw('PUT', `/odev/homework/${hw}/file?name=x.pdf`, pdf)).status, 200);
  assert.equal((await OWN.raw('PUT', `/odev/homework/${hw}/file?name=x.pdf`, Buffer.alloc(2 * 1024 * 1024 + 10, 0x25))).status >= 400, true);   // 2 MB üstü
  assert.equal((await OWN.call('DELETE', `/odev/homework/${hw}/file`)).status, 200);
  assert.equal((await STU.raw('GET', `/odev/homework/${hw}/file`)).status, 404);
});

test('ödev: silinince maddeler ve işaretler de gider', async () => {
  assert.equal((await TEA.call('DELETE', `/odev/homework/${hw}`)).status, 200);
  assert.equal((await OWN.call('GET', `/odev/homework/${hw}`)).status, 404);
  const [c] = await query(`SELECT COUNT(*) AS n FROM dbo.HomeworkItems WHERE HomeworkId=@h`, { h: hw });
  assert.equal(c.n, 0);
});
