// UYARI: DB'ye karşı çalışır (api.test.js gibi) ve henüz HİÇ ÇALIŞTIRILMADI (geliştirme makinesinde SQL Server kapalıydı).
// Önce migration 009 uygulanmış olmalı. Çalıştırma: cd server && node --test test/kurum.test.js
import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { query } from '../src/db.js';

let server, base;
const sfx = Date.now().toString(36);
class Client {
  constructor() { this.cookie = ''; }
  async call(method, path, body) {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.getSetCookie?.().find(c => c.startsWith('dgs_token'));
    if (sc) this.cookie = sc.split(';')[0];
    return { status: res.status, json: await res.json().catch(() => null) };
  }
}
const [OWN, TEA, STU, OTHER, ANON] = [new Client(), new Client(), new Client(), new Client(), new Client()];
let inst1, inst2, c1, c2, ownerId, teacherId, ownerPw = 'Sahip1234x', students = [];

async function mkUser(name, role, instId, classId = null) {
  const h = await bcrypt.hash(ownerPw, 4);
  const [u] = await query(`INSERT INTO dbo.Users (Username, Email, PasswordHash, InstitutionId, Role, ClassId) OUTPUT INSERTED.Id VALUES (@u,@e,@h,@i,@r,@c)`,
    { u: `${name}_${sfx}`.slice(0, 30), e: `${name}.${sfx}@test.local`, h, i: instId, r: role, c: classId });
  return { id: u.Id, username: `${name}_${sfx}`.slice(0, 30) };
}

test.before(async () => {
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}/api`;
  inst1 = (await query(`INSERT INTO dbo.Institutions (Name, Slug) OUTPUT INSERTED.Id VALUES (@n,@s)`, { n: 'Test Kurum 1', s: `t1${sfx}`.slice(0, 40) }))[0].Id;
  inst2 = (await query(`INSERT INTO dbo.Institutions (Name, Slug) OUTPUT INSERTED.Id VALUES (@n,@s)`, { n: 'Test Kurum 2', s: `t2${sfx}`.slice(0, 40) }))[0].Id;
  c1 = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'A')`, { i: inst1 }))[0].Id;
  c2 = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'X')`, { i: inst2 }))[0].Id;
  const o = await mkUser('own', 'owner', inst1); ownerId = o.id;
  const t = await mkUser('tea', 'teacher', inst1); teacherId = t.id;
  const x = await mkUser('oth', 'owner', inst2);
  await query(`INSERT INTO dbo.TeacherClasses (TeacherId, ClassId) VALUES (@t,@c)`, { t: teacherId, c: c1 });
  assert.equal((await OWN.call('POST', '/auth/login', { identifier: o.username, password: ownerPw })).status, 200);
  assert.equal((await TEA.call('POST', '/auth/login', { identifier: t.username, password: ownerPw })).status, 200);
  assert.equal((await OTHER.call('POST', '/auth/login', { identifier: x.username, password: ownerPw })).status, 200);
});
test.after(async () => {
  const ids = `SELECT Id FROM dbo.Users WHERE Email LIKE '%.${sfx}@test.local' OR Username LIKE '%\\_${sfx}' ESCAPE '\\' OR InstitutionId IN (${inst1}, ${inst2})`;
  await query(`DELETE FROM dbo.ClassTransfers WHERE InstitutionId IN (${inst1}, ${inst2})`);
  await query(`DELETE FROM dbo.TeacherClasses WHERE ClassId IN (${c1}, ${c2})`);
  await query(`DELETE FROM dbo.Users WHERE Id IN (${ids})`);
  await query(`DELETE FROM dbo.Classes WHERE InstitutionId IN (${inst1}, ${inst2})`);
  await query(`DELETE FROM dbo.Institutions WHERE Id IN (${inst1}, ${inst2})`);
  server.close(); setTimeout(() => process.exit(0), 100);
});

test('yetkisiz: oturumsuz 401, öğrenci/bireysel 404', async () => {
  assert.equal((await ANON.call('GET', '/kurum/classes')).status, 401);
  const s = await mkUser('stu0', 'student', inst1, c1);
  assert.equal((await STU.call('POST', '/auth/login', { identifier: s.username, password: ownerPw })).status, 200);
  assert.equal((await STU.call('GET', '/kurum/classes')).status, 404);
  assert.equal((await STU.call('GET', '/kurum/students')).status, 404);
});

test('sınıf: yalnızca yönetici oluşturur; öğretmen yalnız atandığını görür', async () => {
  assert.equal((await TEA.call('POST', '/kurum/classes', { name: 'B' })).status, 404);
  const b = await OWN.call('POST', '/kurum/classes', { name: 'B' });
  assert.equal(b.status, 201);
  assert.equal((await OWN.call('POST', '/kurum/classes', { name: 'B' })).status, 409);
  const mine = await TEA.call('GET', '/kurum/classes');
  assert.deepEqual(mine.json.classes.map(c => c.name), ['A']);
  assert.equal((await OWN.call('GET', '/kurum/classes')).json.classes.length, 2);
});

test('toplu ekleme: önizleme + oluşturma + çakışma + giriş + zorunlu şifre', async () => {
  const text = 'Ad\tSoyad\tNo\tSınıf\nAyşe\tYılmaz\t1\tA\nAyşe\tYılmaz\t2\tA\nMehmet\tKaya\t3\tA';
  const pre = await OWN.call('POST', '/kurum/students/preview', { text });
  assert.equal(pre.status, 200); assert.equal(pre.json.rows.length, 3); assert.deepEqual(pre.json.errors, []);
  const out = await OWN.call('POST', '/kurum/students/bulk', { rows: pre.json.rows });
  assert.equal(out.status, 201); assert.equal(out.json.created.length, 3);
  const names = out.json.created.map(c => c.username);
  assert.equal(new Set(names).size, 3, 'kullanıcı adları benzersiz');
  students = out.json.created;
  // aynı numara tekrar → eklenmez
  const dup = await OWN.call('POST', '/kurum/students/bulk', { rows: [{ firstName: 'Can', lastName: 'Er', studentNo: '1', className: 'A' }] });
  assert.equal(dup.json.created.length, 0); assert.equal(dup.json.errors.length, 1);
  // öğrenci geçici şifreyle girer → her şey 403, şifre değiştirince açılır
  const s = new Client();
  const l = await s.call('POST', '/auth/login', { identifier: students[0].username, password: students[0].password });
  assert.equal(l.status, 200); assert.equal(l.json.user.mustChangePassword, true);
  assert.equal((await s.call('GET', '/sessions')).status, 403);
  assert.equal((await s.call('POST', '/auth/change-password', { currentPassword: students[0].password, newPassword: 'Yeni12345' })).status, 200);
  assert.equal((await s.call('GET', '/sessions')).status, 200);
});

test('IDOR: başka kurum hiçbir şeye erişemez', async () => {
  const id = students[0].id;
  assert.equal((await OTHER.call('PATCH', `/kurum/students/${id}`, { isDisabled: true })).status, 404);
  assert.equal((await OTHER.call('POST', '/kurum/students/reset-passwords', { studentIds: [id] })).status, 404);
  assert.equal((await OTHER.call('POST', '/kurum/students/transfer', { moves: [{ studentId: id, toClassId: c2 }] })).status, 404);
  assert.equal((await OTHER.call('GET', '/kurum/students')).json.students.length, 0);
  // kendi öğrencisini başkasının sınıfına taşıyamaz
  const mine = await OTHER.call('POST', '/kurum/students', { firstName: 'Z', lastName: 'Y', classId: c1 });
  assert.equal(mine.status, 404);
});

test('taşıma: öğretmen yalnız kendi sınıfları arasında; yönetici serbest; geçmiş yazılır', async () => {
  const b = (await OWN.call('GET', '/kurum/classes')).json.classes.find(c => c.name === 'B').id;
  const id = students[1].id;
  assert.equal((await TEA.call('POST', '/kurum/students/transfer', { moves: [{ studentId: id, toClassId: b }] })).status, 404);   // B atanmamış
  const ok = await OWN.call('POST', '/kurum/students/transfer', { moves: [{ studentId: id, toClassId: b }], reason: 'test' });
  assert.equal(ok.status, 200); assert.equal(ok.json.moved, 1);
  assert.equal((await OWN.call('POST', '/kurum/students/transfer', { moves: [{ studentId: id, toClassId: b }] })).json.moved, 0);
  const h = await OWN.call('GET', '/kurum/transfers');
  assert.ok(h.json.transfers.some(t => t.studentId === id && t.to === 'B' && t.reason === 'test'));
});

test('arkadaşlık: kurum öğrencisi dışarıdan bulunamaz', async () => {
  const outsider = new Client(); const u = `out_${sfx}`.slice(0, 30);
  assert.equal((await outsider.call('POST', '/auth/register', { username: u, email: `out.${sfx}@test.local`, password: 'Sifre1234' })).status, 201);
  const q = await outsider.call('GET', `/friends/search?q=${encodeURIComponent(students[0].username.slice(0, 5))}`);
  assert.equal(q.json.users.length, 0);
  assert.equal((await outsider.call('POST', '/friends/request', { username: students[0].username })).status, 404);
});

test('pasif kurum: kullanıcılar anında düşer', async () => {
  await query(`UPDATE dbo.Institutions SET IsActive=0 WHERE Id=@i`, { i: inst1 });
  assert.equal((await TEA.call('GET', '/kurum/classes')).status, 401);
  await query(`UPDATE dbo.Institutions SET IsActive=1 WHERE Id=@i`, { i: inst1 });
});
