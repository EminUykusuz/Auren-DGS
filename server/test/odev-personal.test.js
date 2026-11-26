// Kişiye özel ödev, Excel ile toplu verme, öğrenci onayı ve teslim tarihi görüşmesi. DB'ye karşı çalışır; migration 012 uygulanmış olmalı.
// Çalıştırma: cd server && DB_NAME=DgsTouch DB_PORT=0 node --test test/odev-personal.test.js
import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { query } from '../src/db.js';
import { buildXlsx } from '../src/xlsx.js';
import { readXlsx } from '../src/xlsx-read.js';

let server, base;
const sfx = (Date.now() + 11).toString(36);
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
    const b = Buffer.from(await res.arrayBuffer());
    let json = null; try { json = JSON.parse(b.toString('utf8')); } catch { /* ikili içerik */ }
    return { status: res.status, buf: b, json };
  }
}
const [OWN, TEA, STU1, STU2, STU3, OTHER, TEA2] = [new Client(), new Client(), new Client(), new Client(), new Client(), new Client(), new Client()];
let inst1, inst2, cA, cB, cX, ids = {}; const pw = 'Sahip1234x';
const addDays = (n) => new Date(Date.now() + 3 * 3600e3 + n * 86400000).toISOString().slice(0, 10);

async function mkUser(name, role, instId, classId = null, fullName = null, no = null) {
  const h = await bcrypt.hash(pw, 4); const username = `${name}_${sfx}`.slice(0, 30);
  const [u] = await query(`INSERT INTO dbo.Users (Username, Email, PasswordHash, InstitutionId, Role, ClassId, FullName, StudentNo) OUTPUT INSERTED.Id VALUES (@u,@e,@h,@i,@r,@c,@f,@n)`,
    { u: username, e: `${name}.${sfx}@test.local`, h, i: instId, r: role, c: classId, f: fullName ?? 'Ad ' + name, n: no });
  ids[name] = u.Id; return username;
}

test.before(async () => {
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}/api`;
  inst1 = (await query(`INSERT INTO dbo.Institutions (Name, Slug) OUTPUT INSERTED.Id VALUES (@n,@s)`, { n: 'Kişisel Kurum 1', s: `p1${sfx}`.slice(0, 40) }))[0].Id;
  inst2 = (await query(`INSERT INTO dbo.Institutions (Name, Slug) OUTPUT INSERTED.Id VALUES (@n,@s)`, { n: 'Kişisel Kurum 2', s: `p2${sfx}`.slice(0, 40) }))[0].Id;
  cA = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'A')`, { i: inst1 }))[0].Id;
  cB = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'B')`, { i: inst1 }))[0].Id;
  cX = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'X')`, { i: inst2 }))[0].Id;
  const n = {
    own: await mkUser('own', 'owner', inst1), tea: await mkUser('tea', 'teacher', inst1), tea2: await mkUser('tea2', 'teacher', inst1), oth: await mkUser('oth', 'owner', inst2),
    s1: await mkUser('s1', 'student', inst1, cA, 'Ayşe Yılmaz', '101'), s2: await mkUser('s2', 'student', inst1, cB, 'Mehmet Kaya', '102'), s3: await mkUser('s3', 'student', inst1, cA, 'Zeynep Çelik', '103'),
  };
  await query(`INSERT INTO dbo.TeacherClasses (TeacherId, ClassId) VALUES (@t,@c)`, { t: ids.tea, c: cA });
  await query(`INSERT INTO dbo.TeacherClasses (TeacherId, ClassId) VALUES (@t,@c)`, { t: ids.tea2, c: cB });
  for (const [c, k] of [[OWN, 'own'], [TEA, 'tea'], [TEA2, 'tea2'], [OTHER, 'oth'], [STU1, 's1'], [STU2, 's2'], [STU3, 's3']]) assert.equal((await c.call('POST', '/auth/login', { identifier: n[k], password: pw })).status, 200);
});
test.after(async () => {
  await query(`DELETE FROM dbo.Homework WHERE InstitutionId IN (${inst1}, ${inst2})`);
  await query(`DELETE FROM dbo.TeacherClasses WHERE ClassId IN (${cA}, ${cB}, ${cX})`);
  await query(`DELETE FROM dbo.Users WHERE InstitutionId IN (${inst1}, ${inst2}) OR Email LIKE '%.${sfx}@test.local'`);
  await query(`DELETE FROM dbo.Classes WHERE InstitutionId IN (${inst1}, ${inst2})`);
  await query(`DELETE FROM dbo.Institutions WHERE Id IN (${inst1}, ${inst2})`);
  server.close(); setTimeout(() => process.exit(0), 100);
});

const sheet = (rows) => buildXlsx([{ name: 'Ödev', rows: [['Öğrenci no', 'Ad soyad', 'Konu', 'Hedef soru', 'Teslim tarihi'], ...rows] }]);
let batchId, hwS1, hwS3;

test('kişisel ödev: şablon yalnız kapsamdaki öğrencileri içerir (yönetici hepsi, öğretmen kendi sınıfı)', async () => {
  const own = await OWN.raw('GET', '/odev/homework/personal/template.xlsx'); assert.equal(own.status, 200);
  const rows = readXlsx(own.buf).rows; assert.deepEqual(rows[0].slice(0, 3), ['Öğrenci no', 'Ad soyad', 'Sınıf']);
  assert.deepEqual(rows.slice(1).map(r => r[0]).sort(), ['101', '102', '103']);
  const tea = readXlsx((await TEA.raw('GET', '/odev/homework/personal/template.xlsx')).buf).rows;
  assert.deepEqual(tea.slice(1).map(r => r[0]).sort(), ['101', '103']);                 // B sınıfındaki 102 yok
  assert.equal((await STU1.raw('GET', '/odev/homework/personal/template.xlsx')).status, 404);
});

test('kişisel ödev: Excel önizleme — eşler, hata satırlarını bildirir, kimseyi kaydetmez', async () => {
  const file = sheet([['101', 'Ayşe Yılmaz', 'Üslü ifadeler', 40, ''], ['101', 'Ayşe Yılmaz', 'Paragraf', 30, addDays(7)], ['103', '', 'Fiilimsiler', '', ''], ['102', 'Mehmet Kaya', 'Geometri', 20, ''], ['999', 'Yok Kişi', 'X', '', '']]);
  const p = await TEA.raw('POST', '/odev/homework/personal/preview', file);
  assert.equal(p.status, 200); assert.equal(p.json.header, true);
  assert.deepEqual(p.json.assignments.map(a => a.studentId).sort(), [ids.s1, ids.s3].sort());
  const a1 = p.json.assignments.find(a => a.studentId === ids.s1); assert.equal(a1.items.length, 2); assert.equal(a1.dueDate, addDays(7)); assert.equal(a1.className, 'A');
  assert.equal(p.json.errors.length, 2);                                                  // 102 öğretmenin kapsamında değil; 999 yok
  const o = await OWN.raw('POST', '/odev/homework/personal/preview', file);
  assert.equal(o.json.assignments.length, 3); assert.equal(o.json.errors.length, 1);      // yönetici 102'yi de görür; yalnız 999 hata
  assert.equal((await OWN.call('GET', '/odev/homework')).json.batches.length, 0);          // önizleme kayıt yapmaz
});

test('kişisel ödev: yapıştırılan metin (sekmeli) ve bozuk/boş yükleme', async () => {
  const text = 'No\tAd Soyad\tKonu\tHedef\n101\tAyşe Yılmaz\tTürev\t25\n';
  const p = await OWN.raw('POST', '/odev/homework/personal/preview', Buffer.from(text));
  assert.equal(p.status, 200); assert.equal(p.json.assignments[0].items[0].topic, 'Türev'); assert.equal(p.json.assignments[0].items[0].target, 25);
  assert.equal((await OWN.raw('POST', '/odev/homework/personal/preview', Buffer.alloc(0))).status, 400);
  assert.equal((await OWN.raw('POST', '/odev/homework/personal/preview', Buffer.from('PK\x03\x04sahte-dosya-sahte-dosya-sahte'))).status, 400);
  assert.equal((await STU1.raw('POST', '/odev/homework/personal/preview', Buffer.from(text))).status, 404);
});

const payload = (a, extra = {}) => ({ title: '12. hafta (kişisel)', note: 'Özenle çöz', dueDate: addDays(5), assignments: a, ...extra });
const it = (t, n = null) => ({ topic: t, target: n });

test('kişisel ödev: yönetici verir; öğretmen yalnız kendi sınıfındaki öğrenciye; başka kurum/yinelenen/boş reddedilir', async () => {
  const r = await OWN.call('POST', '/odev/homework/personal', payload([{ studentId: ids.s1, items: [it('Üslü ifadeler', 40), it('Paragraf', 30)] }, { studentId: ids.s2, dueDate: addDays(9), items: [it('Geometri', 20)] }]));
  assert.equal(r.status, 201); assert.equal(r.json.created, 2); batchId = r.json.batchId;
  assert.equal((await TEA.call('POST', '/odev/homework/personal', payload([{ studentId: ids.s3, items: [it('Fiilimsiler')] }]))).status, 201);
  assert.equal((await TEA.call('POST', '/odev/homework/personal', payload([{ studentId: ids.s2, items: [it('x')] }]))).status, 404);          // B sınıfı: kapsam dışı
  assert.equal((await OTHER.call('POST', '/odev/homework/personal', payload([{ studentId: ids.s1, items: [it('x')] }]))).status, 404);       // başka kurum
  assert.equal((await OWN.call('POST', '/odev/homework/personal', payload([{ studentId: ids.s1, items: [it('a')] }, { studentId: ids.s1, items: [it('b')] }]))).status, 400);
  assert.equal((await OWN.call('POST', '/odev/homework/personal', payload([{ studentId: ids.s1, items: [] }]))).status, 400);
  assert.equal((await OWN.call('POST', '/odev/homework/personal', payload([{ studentId: ids.s1, items: [it('a')] }], { dueDate: '2026-02-31' }))).status, 400);
  assert.equal((await STU1.call('POST', '/odev/homework/personal', payload([{ studentId: ids.s1, items: [it('a')] }]))).status, 404);          // öğrenci ödev veremez
  const list = (await OWN.call('GET', '/odev/homework')).json;
  assert.equal(list.batches.length, 2); assert.equal(list.homework.length, 0);
  const b = list.batches.find(x => x.batchId === batchId); assert.equal(b.students, 2); assert.equal(b.items, 3); assert.equal(b.finished, 0);
  assert.equal(b.dueFrom, addDays(5)); assert.equal(b.dueTo, addDays(9));
});

test('kişisel ödev: öğretmen kapsamı öğrencinin O ANKİ sınıfını izler (sınıf değişince ödev de el değiştirir)', async () => {
  assert.equal((await TEA.call('GET', `/odev/batch/${batchId}`)).json.students.map(s => s.id).join(), String(ids.s1));   // yalnız s1 (A)
  assert.equal((await TEA2.call('GET', `/odev/batch/${batchId}`)).json.students.map(s => s.id).join(), String(ids.s2)); // yalnız s2 (B)
  assert.equal((await OTHER.call('GET', `/odev/batch/${batchId}`)).status, 404);
  await query(`UPDATE dbo.Users SET ClassId=@c WHERE Id=@u`, { c: cB, u: ids.s1 });                                        // s1 → B sınıfına taşındı
  assert.equal((await TEA.call('GET', `/odev/batch/${batchId}`)).status, 404);
  assert.equal((await TEA2.call('GET', `/odev/batch/${batchId}`)).json.students.length, 2);
  await query(`UPDATE dbo.Users SET ClassId=@c WHERE Id=@u`, { c: cA, u: ids.s1 });                                        // geri al
});

test('kişisel ödev: öğrenci yalnız kendi kişisel ödevini görür; başkasınınkine erişemez (IDOR)', async () => {
  const m1 = (await STU1.call('GET', '/odev/my')).json; const mine = m1.homework.find(h => h.kind === 'personal');
  assert.ok(mine); hwS1 = mine.id; assert.equal(mine.items.length, 2); assert.equal(mine.className, null); assert.equal(mine.dueDate, addDays(5)); assert.equal(mine.status, 'open');
  assert.equal(m1.summary.total, 1); assert.equal(m1.summary.open, 1); assert.equal(m1.summary.items, 2);
  const m2 = (await STU2.call('GET', '/odev/my')).json; assert.equal(m2.homework.length, 1); assert.equal(m2.homework[0].dueDate, addDays(9));   // satır bazlı tarih
  assert.notEqual(m2.homework[0].id, hwS1);
  hwS3 = (await STU3.call('GET', '/odev/my')).json.homework[0].id;
  for (const [m, p, body] of [['GET', `/odev/homework/${hwS1}/sheet.xlsx`], ['PUT', `/odev/my/${hwS1}/items/${mine.items[0].id}`, { done: true }], ['POST', `/odev/my/${hwS1}/submit`, { done: true }], ['POST', `/odev/my/${hwS1}/thread`, { body: 'selam' }]])
    assert.equal((await STU2.call(m, p, body)).status, 404, `${m} ${p}`);
  assert.equal((await STU3.call('POST', `/odev/my/${hwS1}/submit`, { done: true })).status, 404);                          // aynı sınıftaki arkadaşı bile erişemez
  assert.equal((await TEA2.call('GET', `/odev/homework/${hwS1}`)).status, 404);                                          // s1 şimdi A'da; B öğretmeni göremez
});

test('kişisel ödev: öğrenci maddeleri işaretler, "bitirdim" der; madde geri alınınca onay düşer; öğretmen görür', async () => {
  const hw = (await STU1.call('GET', '/odev/my')).json.homework.find(h => h.id === hwS1);
  assert.equal((await STU1.call('PUT', `/odev/my/${hwS1}/items/${hw.items[0].id}`, { done: true })).status, 200);
  assert.equal((await STU1.call('POST', `/odev/my/${hwS1}/submit`, { done: true })).status, 200);
  assert.equal((await STU1.call('POST', `/odev/my/${hwS1}/submit`, { done: true })).status, 200);                           // tekrar: hata yok
  let m = (await STU1.call('GET', '/odev/my')).json; let h = m.homework.find(x => x.id === hwS1);
  assert.ok(h.submittedAt); assert.equal(h.status, 'done'); assert.deepEqual(h.items.map(i => i.done), [true, true]);        // onay tüm maddeleri tamamladı sayar
  assert.equal(m.summary.open, 0); assert.equal(m.summary.submitted, 1); assert.equal(m.summary.itemsDone, 2);
  const st = (await TEA.call('GET', `/odev/batch/${batchId}`)).json.students[0]; assert.ok(st.submittedAt); assert.equal(st.items.every(i => i.done), true);
  assert.equal((await OWN.call('GET', '/odev/homework')).json.batches.find(b => b.batchId === batchId).finished, 1);
  assert.equal((await STU1.call('PUT', `/odev/my/${hwS1}/items/${hw.items[1].id}`, { done: false })).status, 200);           // bir maddeyi geri al
  h = (await STU1.call('GET', '/odev/my')).json.homework.find(x => x.id === hwS1); assert.equal(h.submittedAt, null); assert.equal(h.status, 'open');
  assert.equal((await STU1.call('POST', `/odev/my/${hwS1}/submit`, { done: true })).status, 200);
  assert.equal((await STU1.call('POST', `/odev/my/${hwS1}/submit`, { done: false })).status, 200);                           // onayı geri al
  assert.equal((await STU1.call('GET', '/odev/my')).json.homework.find(x => x.id === hwS1).submittedAt, null);
  assert.deepEqual((await STU1.call('GET', '/odev/my/summary')).json, { open: 1, late: 0 });
});

test('teslim tarihi görüşmesi: talep → kabul; ikinci talep → ret; öğretmen yeni tarih belirler', async () => {
  const sTh = (c = TEA) => c.call('GET', `/odev/homework/${hwS1}/thread/${ids.s1}`);
  // doğrulama
  assert.equal((await STU1.call('POST', `/odev/my/${hwS1}/thread`, {})).status, 400);                                       // boş
  assert.equal((await STU1.call('POST', `/odev/my/${hwS1}/thread`, { proposedDue: addDays(-1) })).status, 400);              // geçmiş tarih
  assert.equal((await STU1.call('POST', `/odev/my/${hwS1}/thread`, { proposedDue: addDays(500) })).status, 400);             // bir yıldan uzak
  assert.equal((await STU1.call('POST', `/odev/my/${hwS1}/thread`, { proposedDue: '2026-02-31' })).status, 400);             // geçersiz tarih
  // talep
  assert.equal((await STU1.call('POST', `/odev/my/${hwS1}/thread`, { body: 'Hastaydım, 3 gün uzatabilir miyiz?', proposedDue: addDays(8) })).status, 201);
  assert.equal((await STU1.call('POST', `/odev/my/${hwS1}/thread`, { proposedDue: addDays(9) })).status, 409);               // bekleyen talep varken yenisi yok
  assert.equal((await STU1.call('POST', `/odev/my/${hwS1}/thread`, { body: 'Teşekkürler' })).status, 201);                   // not yazabilir
  assert.equal((await STU1.call('GET', '/odev/my')).json.homework.find(h => h.id === hwS1).requestOpen, true);
  assert.equal((await TEA.call('GET', '/odev/requests-count')).json.open, 1); assert.equal((await TEA2.call('GET', '/odev/requests-count')).json.open, 0);
  assert.equal((await TEA.call('GET', `/odev/batch/${batchId}`)).json.students[0].requestOpen, true);
  assert.equal((await OWN.call('GET', '/odev/homework')).json.batches.find(b => b.batchId === batchId).requests, 1);
  // yetki
  assert.equal((await sTh(OTHER)).status, 404); assert.equal((await sTh(TEA2)).status, 404); assert.equal((await sTh(STU1)).status, 404);
  assert.equal((await TEA2.call('POST', `/odev/homework/${hwS1}/thread/${ids.s1}`, { action: 'accept' })).status, 404);
  assert.equal((await TEA.call('POST', `/odev/homework/${hwS1}/thread/${ids.s2}`, { action: 'msg', body: 'x' })).status, 404);   // ödevin öğrencisi değil
  // kabul
  assert.equal((await TEA.call('POST', `/odev/homework/${hwS1}/thread/${ids.s1}`, { action: 'accept', body: 'Geçmiş olsun' })).status, 201);
  let h = (await STU1.call('GET', '/odev/my')).json.homework.find(x => x.id === hwS1);
  assert.equal(h.dueDate, addDays(8)); assert.equal(h.originalDue, addDays(5)); assert.equal(h.requestOpen, false);
  assert.deepEqual(h.thread.map(t => t.kind), ['request', 'msg', 'accept']); assert.equal(h.thread[2].role, 'staff'); assert.equal(h.thread[0].proposedDue, addDays(8));
  assert.equal((await TEA.call('GET', `/odev/batch/${batchId}`)).json.students[0].dueDate, addDays(8));
  assert.equal((await TEA.call('POST', `/odev/homework/${hwS1}/thread/${ids.s1}`, { action: 'accept' })).status, 409);       // yanıtlanacak talep kalmadı
  assert.equal((await TEA.call('GET', '/odev/requests-count')).json.open, 0);
  // ikinci talep → ret (tarih değişmez)
  assert.equal((await STU1.call('POST', `/odev/my/${hwS1}/thread`, { proposedDue: addDays(20) })).status, 201);
  assert.equal((await TEA.call('POST', `/odev/homework/${hwS1}/thread/${ids.s1}`, { action: 'reject', body: 'Çok uzun' })).status, 201);
  h = (await STU1.call('GET', '/odev/my')).json.homework.find(x => x.id === hwS1); assert.equal(h.dueDate, addDays(8)); assert.equal(h.requestOpen, false);
  // öğretmen kendisi tarih belirler
  assert.equal((await TEA.call('POST', `/odev/homework/${hwS1}/thread/${ids.s1}`, { action: 'set' })).status, 400);          // tarih şart
  assert.equal((await TEA.call('POST', `/odev/homework/${hwS1}/thread/${ids.s1}`, { action: 'set', dueDate: addDays(12), body: 'En fazla bu kadar' })).status, 201);
  assert.equal((await STU1.call('GET', '/odev/my')).json.homework.find(x => x.id === hwS1).dueDate, addDays(12));
  const th = (await sTh()).json; assert.equal(th.dueDate, addDays(12)); assert.equal(th.originalDue, addDays(5)); assert.equal(th.thread.length, 6);
  // öğretmen bu öğrencinin tarihini değiştirince diğer öğrencinin ödevi etkilenmez
  assert.equal((await STU3.call('GET', '/odev/my')).json.homework[0].dueDate, addDays(5));
});

test('teslim tarihi: süresi geçen açık ödev "late" sayılır; onaylanırsa "done"', async () => {
  await query(`INSERT INTO dbo.HomeworkDue (HomeworkId, UserId, DueDate) VALUES (@h,@u,CAST(@d AS date))`, { h: hwS3, u: ids.s3, d: addDays(-2) });
  const m = (await STU3.call('GET', '/odev/my')).json; assert.equal(m.homework[0].status, 'late'); assert.equal(m.summary.late, 1);
  assert.deepEqual((await STU3.call('GET', '/odev/my/summary')).json, { open: 1, late: 1 });
  assert.equal((await STU3.call('POST', `/odev/my/${hwS3}/submit`, { done: true })).status, 200);
  assert.equal((await STU3.call('GET', '/odev/my')).json.homework[0].status, 'done');
});

test('kişisel ödev: sınıf ödevi ile birlikte listelenir; sınıf ödevi başka öğrencinin kişisel ödevini göstermez', async () => {
  const r = await OWN.call('POST', '/odev/homework', { classId: cA, title: 'Sınıf ödevi', dueDate: addDays(3), items: [{ topic: 'Ortak konu', target: 10 }] }); assert.equal(r.status, 201);
  const m1 = (await STU1.call('GET', '/odev/my')).json.homework; assert.equal(m1.length, 2); assert.deepEqual(m1.map(h => h.kind).sort(), ['class', 'personal']);
  assert.equal((await STU2.call('GET', '/odev/my')).json.homework.every(h => h.kind === 'personal'), true);                    // s2 B sınıfında: sınıf ödevi yok
  const cls = (await OWN.call('GET', '/odev/homework')).json; assert.equal(cls.homework.length, 1); assert.equal(cls.homework[0].kind, 'class'); assert.equal(cls.homework[0].requests, 0);
  const det = (await TEA.call('GET', `/odev/homework/${r.json.id}`)).json; assert.equal(det.students.length, 2);              // s1 ve s3 (A sınıfı)
  assert.ok(det.students.every(s => 'submittedAt' in s && 'dueDate' in s && 'requestOpen' in s));
  // sınıf ödevinde de öğrenci başına tarih talebi ve onay çalışır
  assert.equal((await STU3.call('POST', `/odev/my/${r.json.id}/thread`, { proposedDue: addDays(6) })).status, 201);
  assert.equal((await TEA.call('GET', '/odev/requests-count')).json.open, 1);
  assert.equal((await TEA.call('POST', `/odev/homework/${r.json.id}/thread/${ids.s3}`, { action: 'accept' })).status, 201);
  assert.equal((await STU3.call('GET', '/odev/my')).json.homework.find(h => h.id === r.json.id).dueDate, addDays(6));
  assert.equal((await STU1.call('GET', '/odev/my')).json.homework.find(h => h.id === r.json.id).dueDate, addDays(3));          // arkadaşının tarihi değişmedi
  assert.equal((await TEA.call('POST', `/odev/homework/${r.json.id}/thread/${ids.s2}`, { action: 'msg', body: 'x' })).status, 404);   // başka sınıftaki öğrenci
  // Öğrenci listesi: açık / geciken ödev sayısı (kurum paneli listesi bunu gösterir)
  const list = (await OWN.call('GET', '/kurum/students')).json.students; const row = (id) => list.find(s => s.id === id);
  assert.equal(row(ids.s1).openHomework, 2); assert.equal(row(ids.s1).lateHomework, 0);       // kişisel (onaysız) + sınıf ödevi
  assert.equal(row(ids.s3).openHomework, 1);                                                   // kişisel ödevini onayladı; sınıf ödevi açık
  assert.equal(row(ids.s2).openHomework, 1); assert.equal(row(ids.s1).avgNet, null);           // B sınıfı: yalnız kişisel; denemesi yok
});

test('kişisel ödev: sonuç Excel\'i iner (paket + sınıf ödevi); öğrenci/başka kurum erişemez', async () => {
  const b = await OWN.raw('GET', `/odev/batch/${batchId}/results.xlsx`); assert.equal(b.status, 200); assert.equal(b.buf.subarray(0, 4).toString('hex'), '504b0304');
  const rows = readXlsx(b.buf).rows; assert.equal(rows.length, 3); assert.ok(rows[0].includes('Bitirdi'));
  assert.equal((await STU1.raw('GET', `/odev/batch/${batchId}/results.xlsx`)).status, 404); assert.equal((await OTHER.raw('GET', `/odev/batch/${batchId}/results.xlsx`)).status, 404);
  assert.equal((await OWN.call('GET', '/odev/batch/not-a-uuid')).status, 400);
  const cls = (await OWN.call('GET', '/odev/homework')).json.homework[0];
  const c = readXlsx((await OWN.raw('GET', `/odev/homework/${cls.id}/results.xlsx`)).buf).rows; assert.ok(c[0].includes('Bitirdi') && c[0].includes('Teslim tarihi'));
});

test('kişisel ödev: paket silinince ödevler, maddeler, onaylar ve yazışmalar gider; başkası silemez; kullanıcı silinebilir', async () => {
  assert.equal((await OTHER.call('DELETE', `/odev/batch/${batchId}`)).status, 404); assert.equal((await STU1.call('DELETE', `/odev/batch/${batchId}`)).status, 404);
  assert.equal((await TEA.call('DELETE', `/odev/batch/${batchId}`)).json.deleted, 1);                                       // öğretmen yalnız kapsamındakini siler (s1)
  assert.equal((await OWN.call('GET', `/odev/batch/${batchId}`)).json.students.length, 1);                                  // s2'ninki duruyor
  assert.equal((await OWN.call('DELETE', `/odev/batch/${batchId}`)).json.deleted, 1);
  assert.equal((await OWN.call('GET', `/odev/batch/${batchId}`)).status, 404);
  const [x] = await query(`SELECT (SELECT COUNT(*) FROM dbo.HomeworkThread WHERE HomeworkId=@h) AS t, (SELECT COUNT(*) FROM dbo.HomeworkSubmissions WHERE HomeworkId=@h) AS s, (SELECT COUNT(*) FROM dbo.HomeworkItems WHERE HomeworkId=@h) AS i`, { h: hwS1 });
  assert.deepEqual([x.t, x.s, x.i], [0, 0, 0]);
  // FK: kişisel ödevi olan öğrenci silinirken önce ödevi silinir (hesap silme akışıyla aynı sıra)
  await OWN.call('POST', '/odev/homework/personal', payload([{ studentId: ids.s3, items: [it('Son konu')] }]));
  await assert.rejects(query(`DELETE FROM dbo.Users WHERE Id=@u`, { u: ids.s3 }));                                          // CASCADE yok: doğrudan silme engellenir
  await query(`DELETE FROM dbo.Homework WHERE UserId=@u`, { u: ids.s3 }); await query(`DELETE FROM dbo.Users WHERE Id=@u`, { u: ids.s3 });
});

test('e-posta bildirimi: personel öğrenci e-postası ekler/kaldırır; yinelenen e-posta 409; liste yer tutucuyu göstermez; ödev e-posta ayarsızken bozulmaz', async () => {
  const mail = `veli.${sfx}@test.local`;
  assert.equal((await OWN.call('PATCH', `/kurum/students/${ids.s1}`, { email: mail })).status, 200);
  let list = (await OWN.call('GET', '/kurum/students')).json.students;
  assert.equal(list.find(s => s.id === ids.s1).email, mail); assert.notEqual(list.find(s => s.id === ids.s2).email, mail);
  assert.equal((await OWN.call('PATCH', `/kurum/students/${ids.s2}`, { email: mail })).status, 409);                          // aynı adres başka hesapta
  assert.equal((await OWN.call('PATCH', `/kurum/students/${ids.s2}`, { email: 'x@ogrenci.invalid' })).status, 400);
  assert.equal((await OWN.call('PATCH', `/kurum/students/${ids.s2}`, { email: 'gecersiz' })).status, 400);
  assert.equal((await TEA.call('PATCH', `/kurum/students/${ids.s2}`, { email: `b.${sfx}@test.local` })).status, 404);          // öğretmenin sınıfı değil
  assert.equal((await OTHER.call('PATCH', `/kurum/students/${ids.s1}`, { email: `c.${sfx}@test.local` })).status, 404);
  const r = await OWN.call('POST', '/odev/homework/personal', payload([{ studentId: ids.s1, items: [it('Bildirim denemesi')] }]));
  assert.equal(r.status, 201);                                                                                               // SMTP yok: sessizce atlanır, ödev yine verilir
  assert.equal((await OWN.call('PATCH', `/kurum/students/${ids.s1}`, { email: null })).status, 200);                          // kaldır → yer tutucuya döner
  list = (await OWN.call('GET', '/kurum/students')).json.students; assert.equal(list.find(s => s.id === ids.s1).email, null);
  const [u] = await query(`SELECT Email FROM dbo.Users WHERE Id=@u`, { u: ids.s1 }); assert.match(u.Email, /@ogrenci\.invalid$/);
});
