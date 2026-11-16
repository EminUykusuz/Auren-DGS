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
const [A, B, C, C2, D, E] = [new Client(), new Client(), new Client(), new Client(), new Client(), new Client()];
const [ua, ub, uc, ud, ue] = [mk('alice'), mk('bob'), mk('carol'), mk('dora'), mk('emre')];
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
  assert.equal((await D.call('POST', '/auth/register', ud)).status, 201);
  assert.equal((await E.call('POST', '/auth/register', ue)).status, 201);
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

test('deneme: net sunucuda hesaplanır, istemci net gönderemez, bölüm sınırı', async () => {
  const body = { examName: 'D1', examDate: '2026-11-01', results: { matematik: { correct: 30, wrong: 4 }, turkce: { correct: 40, wrong: 2 } } };
  const r = await A.call('POST', '/exams', body);
  assert.equal(r.status, 201); assert.equal(r.json.nets.matematik, 29); assert.equal(r.json.nets.turkce, 39.5); assert.equal(r.json.totalNet, 68.5);
  assert.equal((await A.call('POST', '/exams', { ...body, mathNet: 99 })).status, 400);
  assert.equal((await A.call('POST', '/exams', { ...body, results: { matematik: { correct: 48, wrong: 5 } } })).status, 400);
  assert.equal((await A.call('POST', '/exams', { ...body, results: { sosyal: { correct: 1, wrong: 0 } } })).status, 400); // DGS'de sosyal yok
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
  const body = { examName: 'Hata analizi', examDate: '2026-11-02', results: { matematik: { correct: 30, wrong: 10 }, turkce: { correct: 35, wrong: 5 } },
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


test('hibrit: YKS denemesi 4 yanlış 1 doğru, bölüm sınırları, mod filtresi', async () => {
  const tyt = { examType: 'YKS', part: 'TYT', examName: 'TYT-1', examDate: '2026-11-03',
    results: { turkce: { correct: 30, wrong: 8 }, sosyal: { correct: 15, wrong: 4 }, matematik: { correct: 25, wrong: 12 }, fen: { correct: 10, wrong: 4 } },
    errors: [{ subject: 'fen', reason: 'konu', count: 4 }] };
  const ok = await D.call('POST', '/exams', tyt);
  assert.equal(ok.status, 201);
  assert.deepEqual(ok.json.nets, { turkce: 28, sosyal: 14, matematik: 22, fen: 9 }); assert.equal(ok.json.totalNet, 73);
  assert.equal((await D.call('POST', '/exams', { ...tyt, results: { turkce: { correct: 40, wrong: 1 } } })).status, 400);   // TYT Türkçe 40 soru
  assert.equal((await D.call('POST', '/exams', { ...tyt, part: 'AYT' })).status, 400);                                      // AYT'de sosyal yok
  assert.equal((await D.call('POST', '/exams', { ...tyt, part: undefined })).status, 400);                                  // YKS'de bölüm şart
  assert.equal((await D.call('POST', '/exams', { ...tyt, errors: [{ subject: 'fen', reason: 'konu', count: 5 }] })).status, 400);
  assert.equal((await D.call('POST', '/exams', { ...tyt, examType: 'LGS' })).status, 400);
  const ayt = await D.call('POST', '/exams', { examType: 'YKS', part: 'AYT', examName: 'AYT-1', examDate: '2026-11-04', results: { matematik: { correct: 20, wrong: 8 }, fizik: { correct: 10, wrong: 4 } } });
  assert.equal(ayt.status, 201); assert.equal(ayt.json.totalNet, 18 + 9);
  // DGS ve YKS verisi ayrı
  assert.equal((await D.call('GET', '/exams?examType=YKS')).json.exams.length, 2);
  assert.equal((await D.call('GET', '/exams?examType=DGS')).json.exams.length, 0);
  assert.equal((await D.call('GET', '/exams/error-summary?examType=YKS')).json.categorized, 4);
  assert.equal((await D.call('GET', '/exams/error-summary?examType=DGS')).json.categorized, 0);
});

test('hibrit: kalıcı mod tercihi + mod bazlı oturum/müfredat doğrulaması', async () => {
  assert.equal((await D.call('GET', '/auth/me')).json.user.examMode, 'DGS');
  assert.equal((await D.call('PUT', '/profile/mode', { examMode: 'LGS' })).status, 400);
  assert.equal((await D.call('PUT', '/profile/mode', { examMode: 'YKS' })).status, 200);
  assert.equal((await D.call('GET', '/auth/me')).json.user.examMode, 'YKS');
  assert.equal((await D.call('GET', '/profile')).json.examMode, 'YKS');
  assert.equal((await D.call('GET', '/exams')).json.exams.length, 2);        // tür verilmezse kayıtlı mod (YKS)
  const day = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const s = { subjectKey: 'fizik', topicKey: 'enerji', durationMinutes: 45, questionsSolved: 30, correctCount: 20, wrongCount: 8, studyDate: day };
  assert.equal((await D.call('POST', '/sessions', s)).status, 201);                                                          // YKS'de fizik var
  assert.equal((await D.call('POST', '/sessions', { ...s, examType: 'DGS' })).status, 400);                                  // DGS'de fizik yok
  assert.equal((await D.call('POST', '/sessions', { ...s, subjectKey: 'matematik', topicKey: 'tek-cift-sayilar' })).status, 400);   // YKS matematiğinde bu (DGS'ye özgü) konu yok
  assert.equal((await D.call('GET', '/sessions?examType=DGS')).json.sessions.length, 0);
  assert.equal((await D.call('GET', '/sessions?examType=YKS')).json.sessions.length, 1);
  assert.equal((await D.call('GET', '/mastery?examType=YKS')).json.topics.length, 1);
  assert.equal((await D.call('GET', '/mastery?examType=DGS')).json.topics.length, 0);
  // sınav tarihi moda göre ayrı saklanır
  assert.equal((await D.call('PUT', '/profile', { targetUniversity: '', targetDepartment: '', examType: 'YKS', examDate: '2027-06-20' })).status, 200);
  const p = (await D.call('GET', '/profile')).json;
  assert.equal(p.examDates.YKS, '2027-06-20'); assert.equal(p.examDates.DGS, null); assert.equal(p.examDate, '2027-06-20');
});

test('hibrit: sıralama ve karşılaştırma seçili sınav türüne göre', async () => {
  const dId = (await D.call('GET', '/auth/me')).json.user.id;
  const eId = (await E.call('GET', '/auth/me')).json.user.id;
  assert.equal((await D.call('POST', '/friends/request', { username: ue.username })).status, 201);
  const inc = (await E.call('GET', '/friends')).json.incoming;
  assert.equal(inc[0].mode, 'YKS');
  assert.equal((await E.call('POST', `/friends/${inc[0].friendshipId}/accept`)).status, 200);
  await E.call('POST', '/exams', { examType: 'DGS', examName: 'DGS-E', examDate: '2026-11-05', results: { matematik: { correct: 40, wrong: 0 }, turkce: { correct: 40, wrong: 0 } } });
  const yks = (await D.call('GET', '/leaderboard?examType=YKS&part=TYT')).json;
  assert.equal(yks.examType, 'YKS'); assert.equal(yks.part, 'TYT');
  assert.equal(yks.rows.find(x => x.userId === dId).bestNet, 73); assert.equal(yks.rows.find(x => x.userId === eId).bestNet, 0);
  const dgs = (await D.call('GET', '/leaderboard?examType=DGS')).json;
  assert.equal(dgs.rows.find(x => x.userId === eId).bestNet, 80); assert.equal(dgs.rows.find(x => x.userId === dId).bestNet, 0);
  assert.equal(dgs.rows[0].userId, eId);                                                  // DGS'de E önde
  assert.equal((await D.call('GET', '/leaderboard?examType=YKS&part=DGS')).status, 400);  // bölüm sınav türüne ait olmalı
  const cmp = (await D.call('GET', `/compare/${eId}?examType=YKS&part=AYT`)).json;
  assert.equal(cmp.me.bestNet, 27);
  assert.deepEqual(cmp.me.sections.map(s => s.key), ['matematik', 'fizik', 'kimya', 'biyoloji', 'edebiyat', 'tarih', 'cografya']);
  assert.equal(cmp.me.sections[0].avg, 18);
  assert.equal((await D.call('GET', `/compare/${eId}?examType=XXX`)).status, 400);
});

test('hibrit: destek modülü açıklama kodu kullanıcıya özel ve kararlı', async () => {
  const a = (await D.call('GET', '/support')).json, a2 = (await D.call('GET', '/support')).json, b = (await E.call('GET', '/support')).json;
  assert.match(a.code, /^AUR-[0-9A-Z]+-[0-9A-F]{4}$/); assert.equal(a.code, a2.code); assert.notEqual(a.code, b.code);
  assert.equal(typeof a.configured, 'boolean');
  assert.equal((await new Client().call('GET', '/support')).status, 401);
  assert.equal((await new Client().call('GET', '/exams-config')).status, 200);
});

test('profil kimliği: ad soyad, avatar allowlist, e-posta değişimi şifre ister', async () => {
  const av = 'https://api.dicebear.com/9.x/lorelei/svg?seed=Mila';
  const base = { fullName: 'Ayşe Yılmaz', avatarUrl: av, email: ud.email };
  assert.equal((await D.call('PUT', '/profile/account', base)).status, 200);
  const p = (await D.call('GET', '/profile')).json; assert.equal(p.fullName, 'Ayşe Yılmaz'); assert.equal(p.avatarUrl, av);
  assert.equal((await D.call('GET', '/auth/me')).json.user.avatarUrl, av);
  assert.equal((await D.call('PUT', '/profile/account', { ...base, avatarUrl: 'https://evil.example/x.svg' })).status, 400);   // keyfi URL yok
  assert.equal((await D.call('PUT', '/profile/account', { ...base, fullName: '<script>' })).status, 400);
  const nm = `yeni.${suffix}@test.local`;
  assert.equal((await D.call('PUT', '/profile/account', { ...base, email: nm })).status, 403);                                // şifresiz olmaz
  assert.equal((await D.call('PUT', '/profile/account', { ...base, email: nm, currentPassword: 'yanlis123' })).status, 403);
  assert.equal((await D.call('PUT', '/profile/account', { ...base, email: ue.email, currentPassword: ud.password })).status, 409); // başkasının e-postası
  assert.equal((await D.call('PUT', '/profile/account', { ...base, email: nm, currentPassword: ud.password })).status, 200);
  assert.equal((await D.call('GET', '/profile')).json.email, nm);
  assert.equal((await D.call('PUT', '/profile/account', { ...base, avatarUrl: null, isAdmin: true })).status, 400);           // fazladan alan
  assert.equal((await D.call('PUT', '/profile/account', { ...base, email: nm, avatarUrl: null })).status, 200);
  assert.equal((await D.call('GET', '/auth/me')).json.user.avatarUrl, null);
});
