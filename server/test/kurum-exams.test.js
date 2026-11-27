// Kurum denemeleri + yanlış defteri. DB'ye karşı çalışır (migration 014-015 uygulanmış olmalı).
import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { query } from '../src/db.js';
import { parseExamResults } from '../src/kurum-lib.js';
import { PARTS } from '../src/exams.js';
import { decodePhoto } from '../src/routes/defter.js';

let server, base;
const sfx = (Date.now() + 11).toString(36);
class Client {
  constructor() { this.cookie = ''; }
  async call(method, path, body) {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.getSetCookie?.().find(c => c.startsWith('dgs_token'));
    if (sc) this.cookie = sc.split(';')[0];
    return { status: res.status, json: await res.json().catch(() => null), type: res.headers.get('content-type') };
  }
}
const [OWN, TEA, S1, S2, OTHER] = [new Client(), new Client(), new Client(), new Client(), new Client()];
let inst1, inst2, cA, cB, pw = 'Sahip1234x', exam;
const SEC = PARTS.YKS.TYT.sections;

async function mkUser(name, role, instId, classId = null, no = null) {
  const h = await bcrypt.hash(pw, 4), username = `${name}_${sfx}`.slice(0, 30);
  await query(`INSERT INTO dbo.Users (Username, Email, PasswordHash, InstitutionId, Role, ClassId, FullName, StudentNo, ExamTrack) VALUES (@u,@e,@h,@i,@r,@c,@f,@n,'BOTH')`,
    { u: username, e: `${name}.${sfx}@test.local`, h, i: instId, r: role, c: classId, f: 'Ad ' + name, n: no });
  return username;
}

test.before(async () => {
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}/api`;
  inst1 = (await query(`INSERT INTO dbo.Institutions (Name, Slug) OUTPUT INSERTED.Id VALUES (@n,@s)`, { n: 'Deneme Kurum 1', s: `e1${sfx}`.slice(0, 40) }))[0].Id;
  inst2 = (await query(`INSERT INTO dbo.Institutions (Name, Slug) OUTPUT INSERTED.Id VALUES (@n,@s)`, { n: 'Deneme Kurum 2', s: `e2${sfx}`.slice(0, 40) }))[0].Id;
  cA = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'A')`, { i: inst1 }))[0].Id;
  cB = (await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@i,'B')`, { i: inst1 }))[0].Id;
  const names = { own: await mkUser('own', 'owner', inst1), tea: await mkUser('tea', 'teacher', inst1), oth: await mkUser('oth', 'owner', inst2),
    s1: await mkUser('s1', 'student', inst1, cA, '101'), s2: await mkUser('s2', 'student', inst1, cA, '102') };
  const [t] = await query(`SELECT Id FROM dbo.Users WHERE Username=@u`, { u: names.tea });
  await query(`INSERT INTO dbo.TeacherClasses (TeacherId, ClassId) VALUES (@t,@c)`, { t: t.Id, c: cA });
  for (const [c, n] of [[OWN, 'own'], [TEA, 'tea'], [OTHER, 'oth'], [S1, 's1'], [S2, 's2']]) assert.equal((await c.call('POST', '/auth/login', { identifier: names[n], password: pw })).status, 200);
});
test.after(async () => {
  await query(`DELETE FROM dbo.InstExams WHERE InstitutionId IN (${inst1}, ${inst2})`);
  await query(`DELETE FROM dbo.TeacherClasses WHERE ClassId IN (${cA}, ${cB})`);
  await query(`DELETE FROM dbo.Users WHERE Email LIKE '%.${sfx}@test.local'`);
  await query(`DELETE FROM dbo.Classes WHERE InstitutionId IN (${inst1}, ${inst2})`);
  await query(`DELETE FROM dbo.Institutions WHERE Id IN (${inst1}, ${inst2})`);
  server.close(); setTimeout(() => process.exit(0), 100);
});

test('sonuç ayrıştırma: başlık atlanır, sayı/sınır/tekrar hataları satır satır', () => {
  const ok = '101\t30 5\t10 2\t25 10\t12 3';
  const { rows, errors } = parseExamResults(`No\tTR D\tTR Y\n${ok}\n102;40;0;20;0;40;0;20;0\n103 1 2 3\n104 41 0 0 0 0 0 0 0\n101 1 1 1 1 1 1 1 1\nx 1 a 1 1 1 1 1 1`, SEC);
  assert.deepEqual(rows.map(r => r.studentNo), ['101', '102']);
  assert.deepEqual(errors.map(e => e.line), [4, 5, 6, 7]);   // eksik sayı, sınır aşımı, tekrar, sayı olmayan
});

test('kurum denemesi: öğrenci/başka kurum erişemez; öğretmen yalnız kendi sınıfına tanımlar', async () => {
  assert.equal((await S1.call('GET', '/kurum/exams')).status, 404);
  const body = (classId, extra = {}) => ({ examType: 'YKS', part: 'TYT', examName: 'Deneme 1', examDate: '2026-03-01', classId, ...extra });
  assert.equal((await TEA.call('POST', '/kurum/exams', body(null))).status, 400);        // öğretmen sınıf seçmeli
  assert.equal((await TEA.call('POST', '/kurum/exams', body(cB))).status, 404);          // atanmadığı sınıf
  assert.equal((await OWN.call('POST', '/kurum/exams', body(999999))).status, 404);
  assert.equal((await OWN.call('POST', '/kurum/exams', body(cA, { part: 'XYZ' }))).status, 400);
  const r = await TEA.call('POST', '/kurum/exams', body(cA)); assert.equal(r.status, 201); exam = r.json.id;
  assert.equal((await OTHER.call('GET', `/kurum/exams/${exam}`)).status, 404);
  assert.equal((await OTHER.call('DELETE', `/kurum/exams/${exam}`)).status, 404);
});

test('sonuç girişi: önizleme yazmaz; kayıt öğrencinin Denemeler listesine düşer, silinemez; sıralama', async () => {
  // TYT: Türkçe 40, Sosyal 20, Temel Mat 40, Fen 20
  const text = 'No\tTR D\tTR Y\tS D\tS Y\tM D\tM Y\tF D\tF Y\n101\t30\t4\t15\t1\t20\t8\t10\t4\n102\t38\t0\t18\t0\t35\t0\t15\t0\n999\t1\t1\t1\t1\t1\t1\t1\t1\n101 41 0 0 0 0 0 0 0';
  const dry = await TEA.call('POST', `/kurum/exams/${exam}/results`, { text, dryRun: true });
  assert.equal(dry.status, 200); assert.equal(dry.json.saved, 0); assert.equal(dry.json.preview.length, 2); assert.equal(dry.json.errors.length, 2);
  assert.equal((await S1.call('GET', '/exams?examType=YKS')).json.exams.length, 0);
  const save = await TEA.call('POST', `/kurum/exams/${exam}/results`, { text });
  assert.equal(save.status, 201); assert.equal(save.json.saved, 2);
  const mine = (await S1.call('GET', '/exams?examType=YKS')).json.exams;
  assert.equal(mine.length, 1); assert.equal(mine[0].Institutional, true); assert.equal(mine[0].Sections.length, 4);
  assert.equal((await S1.call('DELETE', `/exams/${mine[0].Id}`)).status, 404);
  // yeniden yükleme çoğaltmaz
  await TEA.call('POST', `/kurum/exams/${exam}/results`, { text });
  assert.equal((await S1.call('GET', '/exams?examType=YKS')).json.exams.length, 1);
  const rank = (await OWN.call('GET', `/kurum/exams/${exam}`)).json;
  assert.deepEqual(rank.students.map(s => [s.rank, s.studentNo]), [[1, '102'], [2, '101']]);
  assert.equal(rank.classes[0].name, 'A'); assert.equal(rank.classes[0].count, 2);
  assert.equal((await TEA.call('GET', '/kurum/exams')).json.exams[0].results, 2);
  // silince öğrencilerin kayıtları da gider
  assert.equal((await TEA.call('DELETE', `/kurum/exams/${exam}`)).status, 200);
  assert.equal((await S1.call('GET', '/exams?examType=YKS')).json.exams.length, 0);
});

const JPG = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 7)]).toString('base64');
test('yanlış defteri: fotoğraf doğrulama, yalnız sahibi görür/düzenler', async () => {
  assert.equal(decodePhoto('data:image/jpeg;base64,' + Buffer.from('MZ-exe').toString('base64')), null);   // imza uyuşmaz
  assert.equal(decodePhoto('data:image/svg+xml;base64,PHN2Zz4='), null);
  const q = { examType: 'YKS', part: 'TYT', subject: 'matematik', topic: 'Üslü sayılar', reason: 'formul', photo: JPG };
  assert.equal((await S1.call('POST', '/defter', { ...q, subject: 'yok' })).status, 400);
  assert.equal((await S1.call('POST', '/defter', { ...q, photo: 'data:image/jpeg;base64,AAAA' })).status, 400);
  assert.equal((await S1.call('POST', '/defter', { subject: 'matematik', examType: 'YKS' })).status, 400);   // fotoğraf da not da yok
  const c = await S1.call('POST', '/defter', q); assert.equal(c.status, 201);
  const list = (await S1.call('GET', '/defter?examType=YKS')).json.items; assert.equal(list.length, 1); assert.equal(list[0].hasPhoto, true);
  const ph = await S1.call('GET', `/defter/${c.json.id}/photo`); assert.equal(ph.status, 200); assert.equal(ph.type, 'image/jpeg');
  assert.equal((await S2.call('GET', `/defter/${c.json.id}/photo`)).status, 404);
  assert.equal((await S2.call('PATCH', `/defter/${c.json.id}`, { solved: true })).status, 404);
  assert.equal((await S2.call('DELETE', `/defter/${c.json.id}`)).status, 404);
  assert.equal((await S1.call('PATCH', `/defter/${c.json.id}`, { solved: true, reason: null })).status, 200);
  const it = (await S1.call('GET', '/defter?examType=YKS')).json.items[0]; assert.equal(it.solved, true); assert.equal(it.reason, null); assert.equal(it.topic, 'Üslü sayılar');
  assert.equal((await S1.call('DELETE', `/defter/${c.json.id}`)).status, 200);
  assert.equal((await new Client().call('GET', '/defter')).status, 401);
});
