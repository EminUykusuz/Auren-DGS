// Duyuru panosu, dikkat gerektiren öğrenci uyarıları ve veli raporu. DB'ye karşı çalışır (migration 013 gerekir).
// Çalıştırma: cd server && DB_NAME=DgsTouch DB_PORT=0 node --test test/duyuru.test.js
import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { query } from '../src/db.js';
import { netDrop } from '../src/kurum-lib.js';

let server, base;
const sfx = (Date.now() + 29).toString(36);
class Client {
  constructor() { this.cookie = ''; }
  async call(method, path, body) {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.getSetCookie?.().find(c => c.startsWith('dgs_token'));
    if (sc) this.cookie = sc.split(';')[0];
    return { status: res.status, json: await res.json().catch(() => null) };
  }
}
const [OWN, TEA, S1, S2, OTHER] = [new Client(), new Client(), new Client(), new Client(), new Client()];
let inst1, inst2, cA, cB, cX, ids = {}; const pw = 'Sahip1234x';
const addDays = (n) => new Date(Date.now() + 3 * 3600e3 + n * 86400000).toISOString().slice(0, 10);

async function mkUser(name, role, instId, classId = null, fullName = null, extra = '') {
  const h = await bcrypt.hash(pw, 4); const username = `${name}_${sfx}`.slice(0, 30);
  const [u] = await query(`INSERT INTO dbo.Users (Username, Email, PasswordHash, InstitutionId, Role, ClassId, FullName) OUTPUT INSERTED.Id VALUES (@u,@e,@h,@i,@r,@c,@f)`,
    { u: username, e: `${name}.${sfx}@test.local`, h, i: instId, r: role, c: classId, f: fullName ?? 'Ad ' + name });
  ids[name] = u.Id; return username;
}
const addExam = (uid, nameTag, net, date) => query(`INSERT INTO dbo.TrialExams (UserId, ExamName, MathCorrect, MathWrong, MathNet, TurkceCorrect, TurkceWrong, TurkceNet, ExamDate, ExamType, ExamPart, TotalNet)
  VALUES (@u,@n,0,0,0,0,0,0,CAST(@d AS date),'DGS','DGS',@t)`, { u: uid, n: nameTag, d: date, t: net });

test.before(async () => {
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}/api`;
  inst1 = (await query(`INSERT INTO dbo.Institutions (Name, Slug) OUTPUT INSERTED.Id VALUES (@n,@s)`, { n: 'Duyuru Kurum 1', s: `d1${sfx}`.slice(0, 40) }))[0].Id;
  inst2 = (await query(`INSERT INTO dbo.Institutions (Name, Slug) OUTPUT INSERTED.Id VALUES (@n,@s)`, { n: 'Duyuru Kurum 2', s: `d2${sfx}`.slice(0, 40) }))[0].Id;
  cA = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'A')`, { i: inst1 }))[0].Id;
  cB = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'B')`, { i: inst1 }))[0].Id;
  cX = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'X')`, { i: inst2 }))[0].Id;
  const n = { own: await mkUser('own', 'owner', inst1), tea: await mkUser('tea', 'teacher', inst1), oth: await mkUser('oth', 'owner', inst2),
    s1: await mkUser('s1', 'student', inst1, cA, 'Ayşe Yılmaz'), s2: await mkUser('s2', 'student', inst1, cB, 'Mehmet Kaya'), s3: await mkUser('s3', 'student', inst1, cA, 'Zeynep Çelik') };
  await query(`INSERT INTO dbo.TeacherClasses (TeacherId, ClassId) VALUES (@t,@c)`, { t: ids.tea, c: cA });
  for (const [c, k] of [[OWN, 'own'], [TEA, 'tea'], [OTHER, 'oth'], [S1, 's1'], [S2, 's2']]) assert.equal((await c.call('POST', '/auth/login', { identifier: n[k], password: pw })).status, 200);
});
test.after(async () => {
  await query(`DELETE FROM dbo.Announcements WHERE InstitutionId IN (${inst1}, ${inst2})`);
  await query(`DELETE FROM dbo.Homework WHERE InstitutionId IN (${inst1}, ${inst2})`);
  await query(`DELETE FROM dbo.TeacherClasses WHERE ClassId IN (${cA}, ${cB}, ${cX})`);
  await query(`DELETE FROM dbo.Users WHERE Email LIKE '%.${sfx}@test.local'`);
  await query(`DELETE FROM dbo.Classes WHERE InstitutionId IN (${inst1}, ${inst2})`);
  await query(`DELETE FROM dbo.Institutions WHERE Id IN (${inst1}, ${inst2})`);
  server.close(); setTimeout(() => process.exit(0), 100);
});

test('netDrop: yeterli veri ve eşik', () => {
  assert.equal(netDrop([40, 50]), null);                                   // en az 3 deneme
  assert.equal(netDrop([48, 50, 50, 50]), null);                           // düşüş küçük
  assert.deepEqual(netDrop([35, 50, 52, 48]), { last: 35, avg: 50, drop: 15 });
  assert.equal(netDrop([0, 0, 0, 0]), null);                               // ortalama 0: bölme yok
  assert.equal(netDrop([60, 50, 50, 50]), null);                           // yükseliş uyarı değil
});

let annAll, annA;
test('duyuru: yönetici kuruma ve sınıfa yazar; öğretmen yalnız kendi sınıfına; öğrenci/başka kurum yazamaz', async () => {
  const r = await OWN.call('POST', '/duyuru', { title: 'Tatil', body: 'Pazartesi okul kapalı.' }); assert.equal(r.status, 201); annAll = r.json.id;
  assert.equal((await TEA.call('POST', '/duyuru', { title: 'A sınıfı', body: 'Deneme cumartesi.', classId: cA, expiresAt: addDays(5) })).status, 201);
  assert.equal((await TEA.call('POST', '/duyuru', { title: 'Hepsine', body: 'Öğretmen kuruma yazamaz.' })).status, 403);
  assert.equal((await TEA.call('POST', '/duyuru', { title: 'B sınıfı', body: 'Atanmadığı sınıf.', classId: cB })).status, 404);
  assert.equal((await OWN.call('POST', '/duyuru', { title: 'Başka', body: 'Başka kurum sınıfı.', classId: cX })).status, 404);
  assert.equal((await OWN.call('POST', '/duyuru', { title: 'x', body: 'k' })).status, 400);
  assert.equal((await OWN.call('POST', '/duyuru', { title: 'Geçmiş', body: 'Bitiş geçmişte.', expiresAt: addDays(-1) })).status, 400);
  assert.equal((await S1.call('POST', '/duyuru', { title: 'Öğrenci', body: 'Yazamaz.' })).status, 404);
  assert.equal((await OTHER.call('POST', '/duyuru', { title: 'Başka kurum', body: 'Kendi kurumuna yazar.' })).status, 201);
  const list = (await TEA.call('GET', '/duyuru')).json.announcements; annA = list.find(a => a.classId === cA).id;
  assert.equal(list.length, 2); assert.ok(list.every(a => a.classId === null || a.classId === cA));    // başka kurumunki yok
  assert.equal((await OWN.call('GET', '/duyuru')).json.announcements.length, 2);
  assert.equal((await S1.call('GET', '/duyuru')).status, 404);
});

test('duyuru: öğrenci kendi sınıfı + kurum duyurusunu görür; okundu sayısı personele yansır; IDOR', async () => {
  const m1 = (await S1.call('GET', '/duyuru/my')).json; assert.equal(m1.announcements.length, 2); assert.equal(m1.unread, 2);
  const m2 = (await S2.call('GET', '/duyuru/my')).json; assert.deepEqual(m2.announcements.map(a => a.id), [annAll]);       // B sınıfı: A duyurusunu görmez
  assert.equal((await S2.call('POST', `/duyuru/my/${annA}/read`)).status, 404);
  assert.equal((await OTHER.call('POST', `/duyuru/my/${annAll}/read`)).status, 404);
  assert.equal((await S1.call('POST', `/duyuru/my/${annA}/read`)).status, 200); assert.equal((await S1.call('POST', `/duyuru/my/${annA}/read`)).status, 200);
  assert.equal((await S1.call('GET', '/duyuru/my')).json.unread, 1);
  const a = (await TEA.call('GET', '/duyuru')).json.announcements.find(x => x.id === annA); assert.equal(a.audience, 2); assert.equal(a.read, 1);   // A sınıfında 2 öğrenci, 1 okudu
  const all = (await OWN.call('GET', '/duyuru')).json.announcements.find(x => x.id === annAll); assert.equal(all.audience, 3);
});

test('duyuru: süresi dolan öğrenciden gizlenir; silme yetkisi; silinince okumalar da gider', async () => {
  await query(`UPDATE dbo.Announcements SET ExpiresAt=CAST(@d AS date) WHERE Id=@id`, { d: addDays(-1), id: annA });
  assert.deepEqual((await S1.call('GET', '/duyuru/my')).json.announcements.map(a => a.id), [annAll]);
  assert.equal((await TEA.call('DELETE', `/duyuru/${annAll}`)).status, 404);          // öğretmen yöneticinin duyurusunu silemez
  assert.equal((await OTHER.call('DELETE', `/duyuru/${annAll}`)).status, 404);
  assert.equal((await S1.call('DELETE', `/duyuru/${annAll}`)).status, 404);
  assert.equal((await TEA.call('DELETE', `/duyuru/${annA}`)).status, 200);            // kendi duyurusunu siler
  const [x] = await query(`SELECT COUNT(*) AS n FROM dbo.AnnouncementReads WHERE AnnouncementId=@i`, { i: annA }); assert.equal(x.n, 0);
  assert.equal((await OWN.call('DELETE', `/duyuru/${annAll}`)).status, 200);
});

test('uyarılar: girmeyen, neti düşen ve ödevi geciken öğrenci; öğretmen yalnız kendi sınıfını görür', async () => {
  await query(`UPDATE dbo.Users SET MustChangePassword=0, LastLoginAt=DATEADD(day,-10,SYSUTCDATETIME()) WHERE Id=@u`, { u: ids.s3 });       // s3 (A) 10 gündür yok
  await query(`UPDATE dbo.Users SET MustChangePassword=0, LastLoginAt=DATEADD(day,-12,SYSUTCDATETIME()) WHERE Id=@u`, { u: ids.s2 });       // s2 (B) 12 gündür yok
  for (const [i, net] of [[0, 30], [1, 52], [2, 50], [3, 49]]) await addExam(ids.s1, 'D' + i, net, addDays(-i * 7));                       // s1: son 30, öncekiler ~50
  for (const [i, t] of [[1, 'Ödev 1'], [2, 'Ödev 2']]) {
    const [h] = await query(`INSERT INTO dbo.Homework (InstitutionId, ClassId, Title, DueDate) OUTPUT INSERTED.Id VALUES (@i,@c,@t,CAST(@d AS date))`, { i: inst1, c: cA, t, d: addDays(-i) });
    await query(`INSERT INTO dbo.HomeworkItems (HomeworkId, Pos, Topic) VALUES (@h,1,'k')`, { h: h.Id });
  }
  const o = (await OWN.call('GET', '/kurum/alerts')).json;
  assert.deepEqual(o.inactive.map(x => x.id).sort(), [ids.s2, ids.s3].sort()); assert.ok(o.inactive.every(x => x.days >= 7));
  assert.equal(o.drop.length, 1); assert.equal(o.drop[0].id, ids.s1); assert.equal(o.drop[0].last, 30);
  assert.deepEqual(o.late.map(x => [x.id, x.count]).sort((a, b) => a[0] - b[0]), [[ids.s1, 2], [ids.s3, 2]]);                                // A sınıfı ödevleri; s2 B'de
  const t = (await TEA.call('GET', '/kurum/alerts')).json; assert.deepEqual(t.inactive.map(x => x.id), [ids.s3]);                           // B sınıfındaki s2 görünmez
  assert.equal((await OTHER.call('GET', '/kurum/alerts')).json.inactive.length, 0);
  assert.equal((await S1.call('GET', '/kurum/alerts')).status, 404);
});

test('veli raporu: denemeler, ödevler, ortalama; kapsam dışı öğrenci 404', async () => {
  const r = (await TEA.call('GET', `/kurum/students/${ids.s1}/report`)).json;
  assert.equal(r.institution, 'Duyuru Kurum 1'); assert.equal(r.student.name, 'Ayşe Yılmaz'); assert.equal(r.student.className, 'A');
  assert.equal(r.exams.length, 4); assert.equal(r.exams[0].net, 30); assert.equal(r.avg3, 44);                                                // (30+52+50)/3
  assert.equal(r.homework.length, 2); assert.ok(r.homework.every(h => h.late && !h.submitted && h.items === 1));
  assert.equal((await TEA.call('GET', `/kurum/students/${ids.s2}/report`)).status, 404);                                                    // B sınıfı: öğretmenin değil
  assert.equal((await OWN.call('GET', `/kurum/students/${ids.s2}/report`)).status, 200);
  assert.equal((await OTHER.call('GET', `/kurum/students/${ids.s1}/report`)).status, 404);
  assert.equal((await S1.call('GET', `/kurum/students/${ids.s1}/report`)).status, 404);
});
