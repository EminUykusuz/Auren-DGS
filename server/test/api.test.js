import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { app } from '../src/app.js';
import { query } from '../src/db.js';
import { net } from '../src/calc.js';

let server, base;
const suffix = Date.now().toString(36);
const mk = n => ({ username: `${n}_${suffix}`.slice(0, 30), email: `${n}.${suffix}@test.local`, password: 'Sifre1234' });
class Client {
  constructor() { this.cookie = ''; }
  async call(method, path, body) {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.getSetCookie?.().find(c => c.startsWith('dgs_token'));
    if (sc) this.cookie = sc.split(';')[0];
    return { status: res.status, json: await res.json().catch(() => null), headers: res.headers };
  }
}
const [A, B, C, C2] = [new Client(), new Client(), new Client(), new Client()];
const [ua, ub, uc] = [mk('alice'), mk('bob'), mk('carol')];
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

test.before(async () => { server = app.listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
test.after(async () => {
  const ids = `SELECT Id FROM dbo.Users WHERE Email LIKE '%.${suffix}@test.local'`;
  await query(`DELETE FROM dbo.Friendships WHERE RequesterId IN (${ids}) OR AddresseeId IN (${ids})`);
  await query(`DELETE FROM dbo.Users WHERE Email LIKE '%.${suffix}@test.local'`);
  server.close(); setTimeout(() => process.exit(0), 100);
});

test('net formülü kesin', () => {
  assert.equal(net(30, 4), 29); assert.equal(net(10, 1), 9.75); assert.equal(net(0, 3), -0.75); assert.equal(net(50, 0), 50);
});

test('kayıt + cookie HttpOnly + me', async () => {
  const r = await A.call('POST', '/auth/register', ua);
  assert.equal(r.status, 201);
  const sc = r.headers.getSetCookie().find(c => c.startsWith('dgs_token'));
  assert.match(sc, /HttpOnly/i); assert.match(sc, /SameSite=Strict/i);
  assert.equal((await A.call('GET', '/auth/me')).json.user.username, ua.username);
  assert.equal((await B.call('POST', '/auth/register', ub)).status, 201);
  assert.equal((await C.call('POST', '/auth/register', uc)).status, 201);
  assert.equal((await C2.call('POST', '/auth/register', mk('dave'))).status, 201);
  assert.equal((await new Client().call('POST', '/auth/register', ua)).status, 409);
});

test('zayıf şifre reddedilir, yanlış şifre 401', async () => {
  assert.equal((await new Client().call('POST', '/auth/register', { ...mk('x'), password: 'abc' })).status, 400);
  assert.equal((await new Client().call('POST', '/auth/login', { identifier: ua.email, password: 'yanlis123' })).status, 401);
  assert.equal((await new Client().call('POST', '/auth/login', { identifier: ua.username, password: ua.password })).status, 200);
});

test('oturumsuz erişim 401', async () => {
  assert.equal((await new Client().call('GET', '/exams')).status, 401);
  assert.equal((await new Client().call('GET', '/leaderboard')).status, 401);
});

test('deneme: net sunucuda hesaplanır, istemci net gönderemez, 50 sınırı', async () => {
  const body = { examName: 'D1', mathCorrect: 30, mathWrong: 4, turkceCorrect: 40, turkceWrong: 2, examDate: '2026-11-01' };
  const r = await A.call('POST', '/exams', body);
  assert.equal(r.status, 201); assert.equal(r.json.mathNet, 29); assert.equal(r.json.turkceNet, 39.5); assert.equal(r.json.totalNet, 68.5);
  assert.equal((await A.call('POST', '/exams', { ...body, mathNet: 99 })).status, 400);
  assert.equal((await A.call('POST', '/exams', { ...body, mathCorrect: 48, mathWrong: 5 })).status, 400);
  assert.equal((await A.call('GET', '/exams')).json.exams[0].TotalNet, 68.5);
});

test('çalışma oturumu doğrulama + ilerleme', async () => {
  const s = { subjectKey: 'matematik', topicKey: 'ebob-ekok', durationMinutes: 90, questionsSolved: 40, correctCount: 30, wrongCount: 10, studyDate: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10) };
  assert.equal((await A.call('POST', '/sessions', s)).status, 201);
  assert.equal((await A.call('POST', '/sessions', { ...s, correctCount: 35 })).status, 400);
  assert.equal((await A.call('POST', '/sessions', { ...s, topicKey: 'fiiller' })).status, 400);
  const p = (await A.call('GET', '/progress')).json.progress.find(x => x.TopicKey === 'ebob-ekok');
  assert.equal(p.CompletedQuestions, 40); assert.equal(p.Status, 'in_progress');
});

test('arkadaşlık akışı + Anti-IDOR', async () => {
  const bId = (await B.call('GET', '/auth/me')).json.user.id;
  assert.equal((await A.call('GET', `/compare/${bId}`)).status, 404);
  assert.equal((await A.call('POST', '/friends/request', { username: ub.username })).status, 201);
  assert.equal((await A.call('POST', '/friends/request', { username: ub.username })).status, 409);
  assert.equal((await A.call('GET', `/compare/${bId}`)).status, 404);
  const inc = (await B.call('GET', '/friends')).json.incoming;
  assert.equal(inc.length, 1);
  assert.equal((await C.call('POST', `/friends/${inc[0].friendshipId}/accept`)).status, 404);
  assert.equal((await A.call('POST', `/friends/${inc[0].friendshipId}/accept`)).status, 404);
  assert.equal((await B.call('POST', `/friends/${inc[0].friendshipId}/accept`)).status, 200);
  const cmp = await A.call('GET', `/compare/${bId}`);
  assert.equal(cmp.status, 200); assert.equal(cmp.json.friend.username, ub.username);
  assert.equal(cmp.json.me.weeklyHours, 1.5);
  assert.ok(!JSON.stringify(cmp.json).includes('@test.local'));
  const aId = (await A.call('GET', '/auth/me')).json.user.id;
  assert.equal((await C.call('GET', `/compare/${aId}`)).status, 404);
  assert.equal((await C.call('GET', `/compare/${bId}`)).status, 404);
  const lb = (await A.call('GET', '/leaderboard')).json.rows;
  assert.deepEqual(lb.map(x => x.username).sort(), [ua.username, ub.username].sort());
});

test('SQL injection denemesi etkisiz', async () => {
  assert.equal((await new Client().call('POST', '/auth/login', { identifier: "' OR 1=1 --", password: 'x' })).status, 401);
  assert.equal((await A.call('GET', '/friends/search?q=' + encodeURIComponent("a' OR '1'='1"))).status, 400);
});

test('şifre sıfırlama: hashli, tek kullanımlık, süreli, enumeration yok', async () => {
  const unk = await new Client().call('POST', '/auth/forgot-password', { email: 'yok@test.local' });
  const known = await new Client().call('POST', '/auth/forgot-password', { email: ub.email });
  assert.deepEqual(unk.json, known.json); assert.equal(unk.status, known.status);
  const [row] = await query(`SELECT TOP 1 TokenHash, DATEDIFF(minute, SYSUTCDATETIME(), ExpiresAt) AS Mins FROM dbo.PasswordResets pr JOIN dbo.Users u ON u.Id=pr.UserId WHERE u.Email=@e ORDER BY pr.Id DESC`, { e: ub.email });
  assert.equal(row.TokenHash.length, 64); assert.ok(row.Mins >= 14 && row.Mins <= 15);
  const [u] = await query(`SELECT Id FROM dbo.Users WHERE Email=@e`, { e: ub.email });
  const tok = crypto.randomBytes(32).toString('base64url');
  await query(`INSERT INTO dbo.PasswordResets (UserId,TokenHash,ExpiresAt) VALUES (@id,@th,DATEADD(minute,15,SYSUTCDATETIME()))`, { id: u.Id, th: sha(tok) });
  assert.equal((await new Client().call('POST', '/auth/reset-password', { token: tok, password: 'Yeni12345' })).status, 200);
  assert.equal((await new Client().call('POST', '/auth/reset-password', { token: tok, password: 'Baska12345' })).status, 400);
  assert.equal((await new Client().call('POST', '/auth/login', { identifier: ub.email, password: 'Yeni12345' })).status, 200);
  const tok2 = crypto.randomBytes(32).toString('base64url');
  await query(`INSERT INTO dbo.PasswordResets (UserId,TokenHash,ExpiresAt) VALUES (@id,@th,DATEADD(minute,-1,SYSUTCDATETIME()))`, { id: u.Id, th: sha(tok2) });
  assert.equal((await new Client().call('POST', '/auth/reset-password', { token: tok2, password: 'Yeni12345' })).status, 400);
});

test('yönetici paneli: yetki, kendini koruma, askıya alma', async () => {
  const aId = (await A.call('GET', '/auth/me')).json.user.id;
  const cId = (await C.call('GET', '/auth/me')).json.user.id;
  assert.equal((await A.call('GET', '/admin/metrics')).status, 404);          // admin değil
  assert.equal((await new Client().call('GET', '/admin/users')).status, 401);  // oturumsuz
  await query(`UPDATE dbo.Users SET IsAdmin=1 WHERE Id=@id`, { id: aId });
  const m = await A.call('GET', '/admin/metrics');
  assert.equal(m.status, 200); assert.ok(m.json.users >= 3); assert.equal(m.json.daily.length, 7);
  const list = await A.call('GET', '/admin/users?q=' + encodeURIComponent(uc.username));
  assert.equal(list.json.users.length, 1);
  assert.equal((await A.call('PATCH', `/admin/users/${aId}`, { isAdmin: false })).status, 400);   // kendini düşüremez
  assert.equal((await A.call('DELETE', `/admin/users/${aId}`)).status, 400);
  assert.equal((await A.call('GET', '/admin/activity')).status, 200);
  assert.equal((await A.call('PATCH', `/admin/users/${cId}`, { isDisabled: true })).status, 200);
  assert.equal((await C.call('GET', '/auth/me')).status, 401);                   // anında oturum düşer
  assert.equal((await new Client().call('POST', '/auth/login', { identifier: uc.username, password: uc.password })).status, 401);
  assert.equal((await C.call('GET', '/admin/metrics')).status, 401);
  assert.equal((await A.call('DELETE', `/admin/users/${cId}`)).status, 200);
});

test('konu güç analizi: skor, seviye, tekrar etkisi', async () => {
  const { masteryOf } = await import('../src/mastery.js');
  assert.equal(masteryOf({}).level, 'none');
  const fresh = masteryOf({ correct: 45, wrong: 5, solved: 100, days: 5, daysSince: 0 });
  const stale = masteryOf({ correct: 45, wrong: 5, solved: 100, days: 5, daysSince: 60 });
  assert.equal(fresh.level, 'strong'); assert.ok(stale.score < fresh.score);      // zamanla düşer
  assert.equal(masteryOf({ correct: 2, wrong: 8, solved: 10, days: 1, daysSince: 10 }).level, 'critical');
  assert.ok(masteryOf({ correct: 5, wrong: 0, solved: 5, days: 1, daysSince: 0 }).score < fresh.score); // az veri → düşük güven
  const m = await A.call('GET', '/mastery');
  assert.equal(m.status, 200);
  const t = m.json.topics.find(x => x.topicKey === 'ebob-ekok');
  assert.equal(t.solved, 40); assert.equal(t.correct, 30); assert.equal(t.accuracy, 75); assert.equal(t.daysSince, 0);
  assert.equal((await new Client().call('GET', '/mastery')).status, 401);
});

test('profil + geri bildirim: doğrulama, kayıt, satır sonu temizliği, yetki', async () => {
  assert.equal((await B.call('PUT', '/profile', { targetUniversity: 'Boğaziçi Üniversitesi', targetDepartment: 'Bilgisayar Mühendisliği' })).status, 200);
  const p = (await B.call('GET', '/profile')).json;
  assert.equal(p.targetUniversity, 'Boğaziçi Üniversitesi'); assert.equal(p.email, ub.email);
  assert.equal((await B.call('PUT', '/profile', { targetUniversity: 'x'.repeat(121), targetDepartment: '' })).status, 400);
  assert.equal((await B.call('PUT', '/profile', { targetUniversity: 'A', targetDepartment: 'B', isAdmin: true })).status, 400);   // fazladan alan reddedilir

  const fb = { category: 'oneri', subject: 'Koyu tema\r\nBcc: x@y.z', message: 'Harika uygulama, bir öneri yazmak istiyorum.' };
  const ok = await B.call('POST', '/feedback', fb);
  assert.equal(ok.status, 201); assert.equal(ok.json.mail, 'queued');                                                       // SMTP yok → veritabanında bekler
  const [row] = await query(`SELECT Subject, MailStatus FROM dbo.Feedback WHERE Id=@id`, { id: ok.json.id });
  assert.ok(!/[\r\n]/.test(row.Subject));                                                                                    // satır sonları temizlenir
  assert.equal((await B.call('POST', '/feedback', { ...fb, message: 'kısa' })).status, 400);
  assert.equal((await B.call('POST', '/feedback', { ...fb, category: 'spam' })).status, 400);
  assert.equal((await new Client().call('POST', '/feedback', fb)).status, 401);
  assert.equal((await B.call('GET', '/admin/feedback')).status, 404);                                                        // admin değil
});


test('hata nedenleri: kayıt, toplam sınırı, tekil çift, özet, sahiplik', async () => {
  const body = { examName: 'Hata analizi', mathCorrect: 30, mathWrong: 10, turkceCorrect: 35, turkceWrong: 5, examDate: '2026-11-02',
    errors: [{ subject: 'matematik', reason: 'dikkat', count: 4 }, { subject: 'matematik', reason: 'konu', count: 6 }, { subject: 'turkce', reason: 'sure', count: 5 }] };
  const ok = await C2.call('POST', '/exams', body); assert.equal(ok.status, 201);
  assert.equal((await C2.call('POST', '/exams', { ...body, errors: [{ subject: 'turkce', reason: 'sure', count: 6 }] })).status, 400);
  assert.equal((await C2.call('POST', '/exams', { ...body, errors: [{ subject: 'turkce', reason: 'sure', count: 1 }, { subject: 'turkce', reason: 'sure', count: 1 }] })).status, 400);
  assert.equal((await C2.call('POST', '/exams', { ...body, errors: [{ subject: 'turkce', reason: 'uyku', count: 1 }] })).status, 400);
  const list = (await C2.call('GET', '/exams')).json.exams; assert.equal(list.length, 1); assert.equal(list[0].Errors.length, 3);
  assert.equal((await C2.call('PUT', `/exams/${ok.json.id}/errors`, { errors: [{ subject: 'matematik', reason: 'formul', count: 10 }] })).status, 200);
  assert.equal((await C2.call('PUT', `/exams/${ok.json.id}/errors`, { errors: [{ subject: 'matematik', reason: 'formul', count: 11 }] })).status, 400);
  const sum = (await C2.call('GET', '/exams/error-summary')).json;
  assert.equal(sum.categorized, 10); assert.equal(sum.totalWrong, 15); assert.deepEqual(sum.rows, [{ subject: 'matematik', reason: 'formul', total: 10 }]);
  assert.equal((await A.call('PUT', `/exams/${ok.json.id}/errors`, { errors: [] })).status, 404);
});

test('profil: sınav tarihi doğrulama', async () => {
  const base = { targetUniversity: '', targetDepartment: '' };
  assert.equal((await B.call('PUT', '/profile', { ...base, examDate: '2020-01-01' })).status, 400);
  assert.equal((await B.call('PUT', '/profile', { ...base, examDate: '2027-07-18' })).status, 200);
  assert.equal((await B.call('GET', '/profile')).json.examDate, '2027-07-18');
  assert.equal((await B.call('PUT', '/profile', { targetUniversity: 'x', targetDepartment: 'y' })).status, 200);
  assert.equal((await B.call('GET', '/profile')).json.examDate, '2027-07-18');
  assert.equal((await B.call('PUT', '/profile', { ...base, examDate: null })).status, 200);
  assert.equal((await B.call('GET', '/profile')).json.examDate, null);
});
