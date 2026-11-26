// Demo kurum: uygulamanın kendi API'siyle örnek veri üretir (net, kısıtlar ve kapsam kuralları gerçek akışla aynı kalır).
// Kullanım (server klasöründe, .env hazırken):  node scripts/seed-demo.js           → yoksa kurar; varsa yalnızca yönetici şifresini yeniler
//                                                node scripts/seed-demo.js --reset   → demo kurumu silip baştan kurar
// Tüm kişiler uydurmadır. Şifreler her çalıştırmada rastgele üretilir ve yalnızca ekrana yazılır (dosyaya yazılmaz).
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { query } from '../src/db.js';
import { TOPIC_KEYS } from '../src/exams.js';

const SLUG = 'demo', NAME = 'Demo Dershanesi', OWNER = 'demo.yonetici';
const RESET = process.argv.includes('--reset');
const pw = () => 'Demo-' + crypto.randomBytes(5).toString('hex');

// Sabit tohumlu rastgelelik: her kurulumda benzer, tutarlı veri
let seed = 20261126; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const day = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.toISOString().slice(0, 10); };
const ahead = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const server = app.listen(0), base = `http://127.0.0.1:${server.address().port}/api`;
class Client {
  cookie = '';
  async call(method, path, body) {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.getSetCookie?.().find(c => c.startsWith('dgs_token')); if (sc) this.cookie = sc.split(';')[0];
    const json = await res.json().catch(() => null);
    if (res.status >= 400) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
    return json;
  }
}

async function wipe(id) {
  await query(`DELETE FROM dbo.Announcements WHERE InstitutionId=@i`, { i: id });
  await query(`DELETE FROM dbo.Homework WHERE InstitutionId=@i`, { i: id });
  await query(`DELETE FROM dbo.ClassTransfers WHERE InstitutionId=@i`, { i: id });
  await query(`DELETE FROM dbo.TeacherClasses WHERE ClassId IN (SELECT Id FROM dbo.Classes WHERE InstitutionId=@i)`, { i: id });
  await query(`DELETE FROM dbo.Friendships WHERE RequesterId IN (SELECT Id FROM dbo.Users WHERE InstitutionId=@i) OR AddresseeId IN (SELECT Id FROM dbo.Users WHERE InstitutionId=@i)`, { i: id }).catch(() => {});
  await query(`DELETE FROM dbo.Users WHERE InstitutionId=@i`, { i: id });
  await query(`DELETE FROM dbo.Classes WHERE InstitutionId=@i`, { i: id });
  await query(`DELETE FROM dbo.Institutions WHERE Id=@i`, { i: id });
}

const CLASSES = [
  ['12-A Sayısal', 'YKS', ['Ahmet Yıldız', 'Elif Kaya', 'Mert Demir', 'Zeynep Çelik', 'Burak Şahin', 'Selin Aydın']],
  ['12-B Eşit Ağırlık', 'YKS', ['Can Öztürk', 'Defne Arslan', 'Emre Koç', 'Ayşe Polat', 'Kaan Güneş']],
  ['Mezun DGS', 'DGS', ['Gökhan Aksoy', 'Merve Tunç', 'Oğuz Erdem', 'Hilal Bulut']],
];

// Bir öğrenci için gerçekçi deneme sonuçları (zamanla artan başarı)
const EXAMS = {
  DGS: { DGS: [['matematik', 50], ['turkce', 50]] },
  YKS: { TYT: [['turkce', 40], ['sosyal', 20], ['matematik', 40], ['fen', 20]], AYT: [['matematik', 40], ['fizik', 14], ['kimya', 13], ['biyoloji', 13], ['edebiyat', 24], ['tarih', 10], ['cografya', 6]] },
};
function examBody(type, part, skill, k, total) {
  const results = {}, errors = [];
  for (const [key, max] of EXAMS[type][part]) {
    const prog = total > 1 ? k / (total - 1) : 1, s = Math.min(0.95, skill * (0.78 + 0.22 * prog) + (rnd() - 0.5) * 0.08);
    const correct = Math.max(0, Math.min(max, Math.round(max * s))), wrong = Math.min(max - correct, Math.round((max - correct) * (0.25 + rnd() * 0.35)));
    results[key] = { correct, wrong };
    if (wrong >= 2) { const a = Math.ceil(wrong / 2); errors.push({ subject: key, reason: ['dikkat', 'islem', 'konu', 'formul'][ri(0, 3)], count: a }); if (wrong - a > 0) errors.push({ subject: key, reason: 'sure', count: wrong - a }); }
  }
  return { examType: type, part, examName: `${part} Deneme ${k + 1}`, examDate: day((total - 1 - k) * 8 + ri(0, 2)), results, errors };
}

async function main() {
  const [ex] = await query(`SELECT Id FROM dbo.Institutions WHERE Slug=@s`, { s: SLUG });
  if (ex && !RESET) {
    const p = pw();
    await query(`UPDATE dbo.Users SET PasswordHash=@h, MustChangePassword=0 WHERE InstitutionId=@i AND Role='owner'`, { h: await bcrypt.hash(p, 10), i: ex.Id });
    const [o] = await query(`SELECT TOP 1 Username FROM dbo.Users WHERE InstitutionId=@i AND Role='owner' ORDER BY Id`, { i: ex.Id });
    console.log(`\nDemo kurum zaten var. Yönetici şifresi yenilendi.\n  Giriş: /k/${SLUG}\n  Kullanıcı: ${o.Username}\n  Şifre: ${p}\n(Verileri silip baştan kurmak için: node scripts/seed-demo.js --reset)`);
    return;
  }
  if (ex) await wipe(ex.Id);

  const ownerPw = pw();
  const [inst] = await query(`INSERT INTO dbo.Institutions (Name, Slug, ExamTrack) OUTPUT INSERTED.Id VALUES (@n,@s,'BOTH')`, { n: NAME, s: SLUG });
  await query(`INSERT INTO dbo.Users (Username, Email, PasswordHash, FullName, InstitutionId, Role, MustChangePassword, ExamMode, ExamTrack)
    VALUES (@u,@e,@h,'Demo Yönetici',@i,'owner',0,'DGS','BOTH')`, { u: OWNER, e: `${OWNER}@ogrenci.invalid`, h: await bcrypt.hash(ownerPw, 10), i: inst.Id });
  const owner = new Client();
  await owner.call('POST', '/auth/login', { identifier: OWNER, password: ownerPw });

  // Sınıflar + öğrenciler (toplu ekleme ile; sınıflar adlarından otomatik oluşur)
  const rows = []; let no = 1001;
  for (const [cls, , names] of CLASSES) for (const n of names) { const [f, ...l] = n.split(' '); rows.push({ firstName: f, lastName: l.join(' '), studentNo: String(no++), className: cls }); }
  const bulk = await owner.call('POST', '/kurum/students/bulk', { rows });
  const students = bulk.created;
  if (students.length !== rows.length) throw new Error('Öğrencilerin hepsi eklenemedi: ' + JSON.stringify(bulk.errors));

  // Demo olduğu için şifre değiştirme zorunluluğu kapalı; sınav modu sınıfa göre
  const modeOf = Object.fromEntries(CLASSES.map(([c, m]) => [c, m]));
  for (const s of students) await query(`UPDATE dbo.Users SET MustChangePassword=0, ExamMode=@m WHERE Id=@i`, { m: modeOf[s.className], i: s.id });

  // Öğretmen: ilk iki sınıfa atanır
  const classes = (await owner.call('GET', '/kurum/classes')).classes;
  const idOf = Object.fromEntries(classes.map(c => [c.name, c.id]));
  const teacherRes = await owner.call('POST', '/kurum/teachers', { firstName: 'Selim', lastName: 'Hoca', classIds: [idOf['12-A Sayısal'], idOf['12-B Eşit Ağırlık']] });
  const teacher = teacherRes.teacher ?? teacherRes;
  const tUser = teacher.username, tPw = teacher.password;
  await query(`UPDATE dbo.Users SET MustChangePassword=0 WHERE Username=@u`, { u: tUser });

  // Öğrenci verileri: giriş yapıp gerçek uçlara yazar
  const topics = (type, part, subj) => [...(TOPIC_KEYS[type]?.[part]?.[subj] ?? [])];
  let nEx = 0, nSes = 0;
  const clients = new Map();
  for (const s of students) {
    const c = new Client(); await c.call('POST', '/auth/login', { identifier: s.username, password: s.password }); clients.set(s.id, c);
    const type = modeOf[s.className], skill = 0.42 + rnd() * 0.4;
    const parts = type === 'DGS' ? ['DGS'] : ['TYT', 'AYT'];
    for (const part of parts) {
      const total = part === 'AYT' ? ri(2, 3) : ri(4, 6);
      for (let k = 0; k < total; k++) { await c.call('POST', '/exams', examBody(type, part, skill, k, total)); nEx++; }
      const subjects = EXAMS[type][part].map(([key]) => key).filter(key => topics(type, part, key).length);
      for (let k = 0; k < ri(5, 9); k++) {
        const subj = subjects[ri(0, subjects.length - 1)], list = topics(type, part, subj), q = ri(15, 80), ok = Math.round(q * (0.55 + rnd() * 0.35));
        await c.call('POST', '/sessions', { examType: type, part, subjectKey: subj, topicKey: list[ri(0, list.length - 1)], durationMinutes: ri(25, 90), questionsSolved: q, correctCount: ok, wrongCount: Math.round((q - ok) * 0.8), studyDate: day(ri(0, 13)) });
        nSes++;
      }
    }
  }

  // Haftalık ödev: iki sınıfa; öğrencilerin bir kısmı işaretler
  const hwPlans = [['12-A Sayısal', 'Hafta 1: Problemler ve paragraf', [['Oran orantı problemleri', 40], ['Yaş problemleri', 30], ['Paragraf: ana düşünce', 25]]],
    ['12-B Eşit Ağırlık', 'Hafta 1: Dil bilgisi ve tarih', [['Sözcükte anlam', 30], ['Cümle bilgisi', 30], ['Kurtuluş Savaşı kronolojisi', 20]]],
    ['Mezun DGS', 'Hafta 1: İşlem ve sayısal mantık', [['Üslü ifadeler', 40], ['Sayısal mantık', 20]]]];
  for (const [cls, title, items] of hwPlans) {
    await owner.call('POST', '/odev/homework', { classId: idOf[cls], title, note: 'Çözdüğün soruları işaretle; yanlışlarını deneme hata nedenine ekle.', dueDate: ahead(5), items: items.map(([topic, target]) => ({ topic, target })) });
  }
  for (const s of students) {
    const c = clients.get(s.id), list = (await c.call('GET', '/odev/my')).homework;
    for (const h of list) for (const it of h.items) if (rnd() < 0.55) await c.call('PUT', `/odev/my/${h.id}/items/${it.id}`, { done: true });
  }

  const out = (a) => a.map(x => `  ${x.username.padEnd(26)} ${x.password}   ${x.fullName} (${x.className})`).join('\n');
  console.log(`\nDemo kurum hazır.  ${students.length} öğrenci, ${CLASSES.length} sınıf, ${nEx} deneme, ${nSes} çalışma kaydı, ${hwPlans.length} ödev.\n`);
  console.log(`Giriş sayfası : /k/${SLUG}   (genel giriş: /giris)\n`);
  console.log(`YÖNETİCİ  ${OWNER}   ${ownerPw}`);
  console.log(`ÖĞRETMEN  ${tUser}   ${tPw}   (12-A ve 12-B sınıfları)\n`);
  console.log(`ÖĞRENCİLER:\n${out(students)}\n`);
}

try { await main(); } catch (e) { console.error('HATA:', e.message); process.exitCode = 1; } finally { server.close(); setTimeout(() => process.exit(), 200); }
