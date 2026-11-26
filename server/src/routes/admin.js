import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import bcrypt from 'bcryptjs';
import { requireAdmin, validate, wrap } from '../security.js';
import { sendXlsx } from '../xlsx.js';
import { makeSlug, SLUG_RE, makeUsername, genPassword, asciiFold } from '../kurum-lib.js';

const r = Router();
r.use(requireAdmin); // oturum + IsAdmin (yetkisizlere 404)

const idParam = z.object({ id: z.coerce.number().int().positive() });
const num = v => Number(v ?? 0);

r.get('/metrics', wrap(async (req, res) => {
  const [m] = await query(`SELECT
    (SELECT COUNT(*) FROM dbo.Users) AS Users,
    (SELECT COUNT(*) FROM dbo.Users WHERE IsDisabled=1) AS Disabled,
    (SELECT COUNT(*) FROM dbo.Users WHERE IsAdmin=1) AS Admins,
    (SELECT COUNT(*) FROM dbo.Users WHERE CreatedAt >= DATEADD(day,-7,SYSUTCDATETIME())) AS NewWeek,
    (SELECT COUNT(DISTINCT UserId) FROM dbo.StudySessions WHERE StudyDate >= DATEADD(day,-7,CAST(GETDATE() AS date))) AS ActiveWeek,
    (SELECT COUNT(*) FROM dbo.Friendships WHERE Status='accepted') AS Friendships,
    (SELECT COUNT(*) FROM dbo.Friendships WHERE Status='pending') AS PendingRequests,
    (SELECT COUNT(*) FROM dbo.StudySessions) AS Sessions,
    (SELECT COALESCE(SUM(DurationMinutes),0) FROM dbo.StudySessions) AS Minutes,
    (SELECT COUNT(*) FROM dbo.TrialExams) AS Exams,
    (SELECT COALESCE(AVG(CAST(TotalNet AS float)),0) FROM dbo.TrialExams) AS AvgNet,
    (SELECT COUNT(*) FROM dbo.PasswordResets WHERE IsUsed=0 AND ExpiresAt > SYSUTCDATETIME()) AS OpenResets`);
  const daily = await query(`SELECT CONVERT(char(10), d.Day, 23) AS Day,
      (SELECT COUNT(*) FROM dbo.StudySessions s WHERE s.StudyDate = d.Day) AS Sessions,
      (SELECT COUNT(*) FROM dbo.Users u WHERE CAST(u.CreatedAt AS date) = d.Day) AS Signups
    FROM (SELECT DATEADD(day, -n, CAST(GETDATE() AS date)) AS Day FROM (VALUES (0),(1),(2),(3),(4),(5),(6)) v(n)) d ORDER BY d.Day`);
  res.json({
    users: m.Users, disabled: m.Disabled, admins: m.Admins, newThisWeek: m.NewWeek, activeThisWeek: m.ActiveWeek,
    friendships: m.Friendships, pendingRequests: m.PendingRequests, sessions: m.Sessions, studyHours: Math.round(num(m.Minutes) / 6) / 10,
    exams: m.Exams, avgNet: Math.round(num(m.AvgNet) * 100) / 100, openResets: m.OpenResets,
    daily, server: { uptimeSec: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1048576), node: process.version },
  });
}));

r.get('/users', validate(z.object({ q: z.string().trim().max(50).optional(), page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().min(5).max(50).default(20) }), 'query'), wrap(async (req, res) => {
  const { page, pageSize } = req.query;
  const like = req.query.q ? '%' + req.query.q.replace(/[%_\\[]/g, '\\$&') + '%' : '%';
  const rows = await query(`SELECT u.Id, u.Username, u.Email, u.IsAdmin, u.IsDisabled,
      CONVERT(varchar(19), u.CreatedAt, 126) AS CreatedAt, CONVERT(varchar(19), u.LastLoginAt, 126) AS LastLoginAt,
      (SELECT COALESCE(SUM(DurationMinutes),0) FROM dbo.StudySessions s WHERE s.UserId=u.Id) AS Minutes,
      (SELECT COUNT(*) FROM dbo.TrialExams e WHERE e.UserId=u.Id) AS Exams
    FROM dbo.Users u WHERE u.Username LIKE @l ESCAPE '\\' OR u.Email LIKE @l ESCAPE '\\' ORDER BY u.CreatedAt DESC, u.Id DESC OFFSET @off ROWS FETCH NEXT @n ROWS ONLY`, { l: like, off: (page - 1) * pageSize, n: pageSize });
  const [{ Total }] = await query(`SELECT COUNT(*) AS Total FROM dbo.Users u WHERE u.Username LIKE @l ESCAPE '\\' OR u.Email LIKE @l ESCAPE '\\'`, { l: like });
  res.json({ page, pageSize, total: Total, users: rows.map(u => ({ id: u.Id, username: u.Username, email: u.Email, isAdmin: !!u.IsAdmin, isDisabled: !!u.IsDisabled,
    createdAt: u.CreatedAt, lastLoginAt: u.LastLoginAt, studyHours: Math.round(u.Minutes / 6) / 10, exams: u.Exams })) });
}));

// Yönetici/askıya alma değişiklikleri. Kendini ve son yöneticiyi koruma kuralları sunucuda.
r.patch('/users/:id', validate(idParam, 'params'), validate(z.object({ isAdmin: z.boolean().optional(), isDisabled: z.boolean().optional() }).refine(d => Object.keys(d).length > 0)), wrap(async (req, res) => {
  const id = req.params.id, d = req.body;
  if (id === req.userId && (d.isAdmin === false || d.isDisabled === true)) return res.status(400).json({ error: 'Kendi yetkini kaldıramaz veya hesabını askıya alamazsın' });
  const ok = await tx(async q => {
    const [t] = await q(`SELECT IsAdmin FROM dbo.Users WHERE Id=@id`, { id });
    if (!t) return 404;
    if (t.IsAdmin && (d.isAdmin === false || d.isDisabled === true)) {
      const [c] = await q(`SELECT COUNT(*) AS C FROM dbo.Users WHERE IsAdmin=1 AND IsDisabled=0 AND Id<>@id`, { id });
      if (c.C === 0) return 409;
    }
    await q(`UPDATE dbo.Users SET IsAdmin=COALESCE(@a,IsAdmin), IsDisabled=COALESCE(@x,IsDisabled) WHERE Id=@id`,
      { id, a: d.isAdmin === undefined ? null : +d.isAdmin, x: d.isDisabled === undefined ? null : +d.isDisabled });
    return 200;
  });
  if (ok === 404) return res.status(404).json({ error: 'Bulunamadı' });
  if (ok === 409) return res.status(409).json({ error: 'Son aktif yönetici etkisizleştirilemez' });
  res.json({ ok: true });
}));

r.delete('/users/:id', validate(idParam, 'params'), wrap(async (req, res) => {
  const id = req.params.id;
  if (id === req.userId) return res.status(400).json({ error: 'Kendi hesabını silemezsin' });
  const [t] = await query(`SELECT IsAdmin FROM dbo.Users WHERE Id=@id`, { id });
  if (!t) return res.status(404).json({ error: 'Bulunamadı' });
  if (t.IsAdmin) return res.status(400).json({ error: 'Önce yönetici yetkisini kaldır' });
  await tx(async q => {
    await q(`DELETE FROM dbo.Friendships WHERE RequesterId=@id OR AddresseeId=@id`, { id });
    await q(`DELETE FROM dbo.Users WHERE Id=@id`, { id }); // diğer tablolar ON DELETE CASCADE
  });
  res.json({ ok: true });
}));

r.get('/feedback', validate(z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) }), 'query'), wrap(async (req, res) => {
  const page = req.query.page, size = 15;
  const rows = await query(`SELECT f.Id, u.Username, f.Category, f.Subject, f.Message, f.MailStatus, f.MailError, CONVERT(varchar(19), f.CreatedAt, 126) AS CreatedAt
    FROM dbo.Feedback f JOIN dbo.Users u ON u.Id=f.UserId ORDER BY f.CreatedAt DESC, f.Id DESC OFFSET @off ROWS FETCH NEXT @n ROWS ONLY`, { off: (page - 1) * size, n: size });
  const [{ Total }] = await query(`SELECT COUNT(*) AS Total FROM dbo.Feedback`);
  res.json({ page, pageSize: size, total: Total, items: rows.map(x => ({ id: x.Id, username: x.Username, category: x.Category, subject: x.Subject, message: x.Message, mailStatus: x.MailStatus, mailError: x.MailError, createdAt: x.CreatedAt })) });
}));

// Canlı etkinlik: son kayıtlar, çalışma/deneme içeriği olmadan (özet)
r.get('/activity', wrap(async (req, res) => {
  const rows = await query(`SELECT TOP 40 * FROM (
      SELECT 'signup' AS Kind, u.Username, NULL AS Detail, u.CreatedAt AS At FROM dbo.Users u
      UNION ALL SELECT 'login', u.Username, NULL, u.LastLoginAt FROM dbo.Users u WHERE u.LastLoginAt IS NOT NULL
      UNION ALL SELECT 'exam', u.Username, e.ExamName + ' · ' + e.ExamPart + ' · ' + CAST(e.TotalNet AS varchar(10)) + ' net', DATEADD(second, e.Id % 60, CAST(e.ExamDate AS datetime2)) FROM dbo.TrialExams e JOIN dbo.Users u ON u.Id=e.UserId
      UNION ALL SELECT 'session', u.Username, s.TopicKey + ' · ' + CAST(s.DurationMinutes AS varchar(10)) + ' dk', DATEADD(second, s.Id % 60, CAST(s.StudyDate AS datetime2)) FROM dbo.StudySessions s JOIN dbo.Users u ON u.Id=s.UserId
      UNION ALL SELECT 'friend', u.Username, 'arkadaşlık ' + f.Status, f.CreatedAt FROM dbo.Friendships f JOIN dbo.Users u ON u.Id=f.RequesterId
    ) a ORDER BY At DESC`);
  res.json({ events: rows.map(x => ({ kind: x.Kind, username: x.Username, detail: x.Detail, at: x.At })) });
}));

// ---------- Kurumlar (dershane satışı): oluştur, listele, pasife al / kota ----------
r.get('/institutions', wrap(async (req, res) => {
  const rows = await query(`SELECT i.Id, i.Name, i.Slug, i.ExamTrack, i.StudentLimit, i.IsActive, i.CreatedAt,
      (SELECT COUNT(*) FROM dbo.Users u WHERE u.InstitutionId=i.Id AND u.Role='student') AS Students,
      (SELECT COUNT(*) FROM dbo.Users u WHERE u.InstitutionId=i.Id AND u.Role='teacher') AS Teachers,
      (SELECT COUNT(*) FROM dbo.Classes c WHERE c.InstitutionId=i.Id) AS Classes
    FROM dbo.Institutions i ORDER BY i.CreatedAt DESC`);
  res.json({ institutions: rows.map(i => ({ id: i.Id, name: i.Name, slug: i.Slug, examTrack: i.ExamTrack, studentLimit: i.StudentLimit, isActive: !!i.IsActive, createdAt: i.CreatedAt, students: i.Students, teachers: i.Teachers, classes: i.Classes })) });
}));

r.post('/institutions', validate(z.object({
  name: z.string().trim().min(2).max(100), slug: z.string().trim().toLowerCase().regex(SLUG_RE, 'Adres 3-40 küçük harf/rakam olmalı').optional(),
  examTrack: z.enum(['DGS', 'YKS', 'BOTH']).default('BOTH'), studentLimit: z.number().int().min(1).max(100000).nullish(),
  ownerFirstName: z.string().trim().min(1).max(40), ownerLastName: z.string().trim().min(1).max(40),
}).strict()), wrap(async (req, res) => {
  const d = req.body, slug = d.slug ?? makeSlug(d.name);
  if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'Kurum adresi üretilemedi, elle girin (3-40 küçük harf/rakam)' });
  const taken = new Set((await query(`SELECT Username FROM dbo.Users WHERE Username LIKE @p`, { p: slug.slice(0, 8) + '.%' })).map(x => x.Username.toLowerCase()));
  const username = makeUsername(slug.slice(0, 8), d.ownerFirstName + d.ownerLastName, taken);
  const pw = genPassword(10), h = await bcrypt.hash(pw, 10);
  try {
    const out = await tx(async q => {
      const [i] = await q(`INSERT INTO dbo.Institutions (Name, Slug, ExamTrack, StudentLimit) OUTPUT INSERTED.Id VALUES (@n,@s,@t,@l)`, { n: d.name, s: slug, t: d.examTrack, l: d.studentLimit ?? null });
      const [u] = await q(`INSERT INTO dbo.Users (Username, Email, PasswordHash, FullName, InstitutionId, Role, MustChangePassword, ExamMode, ExamTrack)
        OUTPUT INSERTED.Id VALUES (@u,@e,@h,@f,@i,'owner',1,'DGS',@t)`,
        { u: username, e: `${username}@ogrenci.invalid`, h, f: `${d.ownerFirstName} ${d.ownerLastName}`.slice(0, 80), i: i.Id, t: d.examTrack });
      return { id: i.Id, ownerId: u.Id };
    });
    res.status(201).json({ ...out, slug, loginPath: `/k/${slug}`, owner: { username, password: pw } });   // şifre yalnızca bir kez gösterilir
  } catch (e) {
    if (e?.number === 2627 || e?.number === 2601) return res.status(409).json({ error: 'Bu kurum adresi zaten kullanılıyor' });
    throw e;
  }
}));

r.patch('/institutions/:id', validate(idParam, 'params'), validate(z.object({
  name: z.string().trim().min(2).max(100).optional(), isActive: z.boolean().optional(), studentLimit: z.number().int().min(1).max(100000).nullable().optional(),
  examTrack: z.enum(['DGS', 'YKS', 'BOTH']).optional(),
}).strict()), wrap(async (req, res) => {
  const d = req.body;
  const out = await query(`UPDATE dbo.Institutions SET Name=COALESCE(@n,Name), IsActive=COALESCE(@a,IsActive), ExamTrack=COALESCE(@t,ExamTrack),
      StudentLimit=CASE WHEN @setL=1 THEN @l ELSE StudentLimit END OUTPUT INSERTED.Id WHERE Id=@id`,
    { n: d.name ?? null, a: d.isActive == null ? null : (d.isActive ? 1 : 0), t: d.examTrack ?? null, setL: 'studentLimit' in d ? 1 : 0, l: d.studentLimit ?? null, id: req.params.id });
  if (!out.length) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ ok: true });
}));

// Kurum yöneticisinin şifresini sıfırla (kurum şifresini unutursa)
r.post('/institutions/:id/reset-owner', validate(idParam, 'params'), wrap(async (req, res) => {
  const [o] = await query(`SELECT TOP 1 Id, Username FROM dbo.Users WHERE InstitutionId=@id AND Role='owner' ORDER BY Id`, { id: req.params.id });
  if (!o) return res.status(404).json({ error: 'Bulunamadı' });
  const pw = genPassword(10);
  await query(`UPDATE dbo.Users SET PasswordHash=@h, MustChangePassword=1 WHERE Id=@id`, { h: await bcrypt.hash(pw, 10), id: o.Id });
  res.json({ username: o.Username, password: pw });
}));

// ---------- Platform sahibi: her şeyi gör (salt okunur, kurum süzgeci yok) ----------
const round2 = (v) => (v == null ? null : Math.round(Number(v) * 100) / 100);
const hiddenMail = (e) => (/@ogrenci\.invalid$/i.test(e ?? '') ? '' : e);

// Bir kurumun bütünü: sınıflar (öğrenci/deneme sayısı) ve tüm kişiler
r.get('/institutions/:id/detail', validate(idParam, 'params'), wrap(async (req, res) => {
  const id = req.params.id;
  const [inst] = await query(`SELECT Id, Name, Slug, ExamTrack, StudentLimit, IsActive, PrimaryColor, CreatedAt FROM dbo.Institutions WHERE Id=@id`, { id });
  if (!inst) return res.status(404).json({ error: 'Bulunamadı' });
  const classes = await query(`SELECT c.Id, c.Name, c.IsArchived,
      (SELECT COUNT(*) FROM dbo.Users u WHERE u.ClassId=c.Id AND u.Role='student') AS Students,
      (SELECT COUNT(*) FROM dbo.TrialExams e JOIN dbo.Users u ON u.Id=e.UserId WHERE u.ClassId=c.Id) AS Exams
    FROM dbo.Classes c WHERE c.InstitutionId=@id ORDER BY c.IsArchived, c.Name`, { id });
  const people = await query(`SELECT u.Id, u.Username, u.FullName, u.Role, u.StudentNo, u.IsDisabled, u.MustChangePassword, c.Name AS ClassName, CONVERT(char(10), u.LastLoginAt, 23) AS LastLogin,
      (SELECT COUNT(*) FROM dbo.TrialExams e WHERE e.UserId=u.Id) AS Exams
    FROM dbo.Users u LEFT JOIN dbo.Classes c ON c.Id=u.ClassId WHERE u.InstitutionId=@id ORDER BY u.Role, c.Name, u.FullName`, { id });
  res.json({
    institution: { id: inst.Id, name: inst.Name, slug: inst.Slug, examTrack: inst.ExamTrack, studentLimit: inst.StudentLimit, isActive: !!inst.IsActive, color: inst.PrimaryColor, createdAt: inst.CreatedAt },
    classes: classes.map(c => ({ id: c.Id, name: c.Name, archived: !!c.IsArchived, students: c.Students, exams: c.Exams })),
    people: people.map(p => ({ id: p.Id, username: p.Username, fullName: p.FullName ?? '', role: p.Role, studentNo: p.StudentNo ?? '', disabled: !!p.IsDisabled, mustChangePassword: !!p.MustChangePassword, className: p.ClassName ?? '', lastLogin: p.LastLogin ?? null, exams: p.Exams })),
  });
}));

// Tek kullanıcı: profil, kurum/sınıf, son denemeler (bölümleriyle) ve son çalışma oturumları
r.get('/users/:id/detail', validate(idParam, 'params'), wrap(async (req, res) => {
  const id = req.params.id;
  const [u] = await query(`SELECT u.Id, u.Username, u.Email, u.FullName, u.IsAdmin, u.IsDisabled, u.Role, u.StudentNo, u.ExamTrack, u.ExamMode, u.CreatedAt, CONVERT(char(10), u.LastLoginAt, 23) AS LastLogin,
      i.Name AS InstitutionName, c.Name AS ClassName
    FROM dbo.Users u LEFT JOIN dbo.Institutions i ON i.Id=u.InstitutionId LEFT JOIN dbo.Classes c ON c.Id=u.ClassId WHERE u.Id=@id`, { id });
  if (!u) return res.status(404).json({ error: 'Bulunamadı' });
  const exams = await query(`SELECT TOP 30 e.Id, e.ExamType, e.ExamPart, e.ExamName, CONVERT(char(10), e.ExamDate, 23) AS ExamDate, e.TotalNet FROM dbo.TrialExams e WHERE e.UserId=@id ORDER BY e.ExamDate DESC, e.Id DESC`, { id });
  const ids = exams.map(e => e.Id);
  const secs = ids.length ? await query(`SELECT ExamId, SectionKey, Correct, Wrong, Net FROM dbo.TrialExamSections WHERE ExamId IN (${ids.join(',')})`) : [];
  const sessions = await query(`SELECT TOP 30 CONVERT(char(10), StudyDate, 23) AS StudyDate, TopicKey, DurationMinutes FROM dbo.StudySessions WHERE UserId=@id ORDER BY StudyDate DESC, Id DESC`, { id });
  res.json({
    user: { id: u.Id, username: u.Username, email: hiddenMail(u.Email), fullName: u.FullName ?? '', isAdmin: !!u.IsAdmin, disabled: !!u.IsDisabled, role: u.Role ?? 'bireysel', studentNo: u.StudentNo ?? '', examTrack: u.ExamTrack, examMode: u.ExamMode, createdAt: u.CreatedAt, lastLogin: u.LastLogin ?? null, institution: u.InstitutionName ?? null, className: u.ClassName ?? null },
    exams: exams.map(e => ({ id: e.Id, type: e.ExamType, part: e.ExamPart, name: e.ExamName, date: e.ExamDate, totalNet: round2(e.TotalNet), sections: secs.filter(s => s.ExamId === e.Id).map(s => ({ key: s.SectionKey, correct: s.Correct, wrong: s.Wrong, net: round2(s.Net) })) })),
    sessions: sessions.map(s => ({ date: s.StudyDate, topic: s.TopicKey, minutes: s.DurationMinutes })),
  });
}));

// Tüm platform: tek Excel dosyasında kullanıcılar, kurumlar ve denemeler
r.get('/export/all.xlsx', wrap(async (req, res) => {
  const users = await query(`SELECT TOP 50000 u.Id, u.Username, u.Email, u.FullName, u.IsAdmin, u.IsDisabled, u.Role, u.ExamTrack, CONVERT(char(10), u.CreatedAt, 23) AS Created, CONVERT(char(10), u.LastLoginAt, 23) AS LastLogin,
      i.Name AS Inst, c.Name AS ClassName,
      (SELECT COUNT(*) FROM dbo.TrialExams e WHERE e.UserId=u.Id) AS Exams,
      (SELECT COALESCE(SUM(s.DurationMinutes),0) FROM dbo.StudySessions s WHERE s.UserId=u.Id) AS Minutes
    FROM dbo.Users u LEFT JOIN dbo.Institutions i ON i.Id=u.InstitutionId LEFT JOIN dbo.Classes c ON c.Id=u.ClassId ORDER BY u.Id`);
  const insts = await query(`SELECT i.Name, i.Slug, i.ExamTrack, i.StudentLimit, i.IsActive, CONVERT(char(10), i.CreatedAt, 23) AS Created,
      (SELECT COUNT(*) FROM dbo.Users u WHERE u.InstitutionId=i.Id AND u.Role='student') AS Students,
      (SELECT COUNT(*) FROM dbo.Users u WHERE u.InstitutionId=i.Id AND u.Role='teacher') AS Teachers,
      (SELECT COUNT(*) FROM dbo.Classes c WHERE c.InstitutionId=i.Id) AS Classes FROM dbo.Institutions i ORDER BY i.Name`);
  const exams = await query(`SELECT TOP 50000 u.Username, i.Name AS Inst, c.Name AS ClassName, e.ExamType, e.ExamPart, e.ExamName, CONVERT(char(10), e.ExamDate, 23) AS ExamDate, e.TotalNet
    FROM dbo.TrialExams e JOIN dbo.Users u ON u.Id=e.UserId LEFT JOIN dbo.Institutions i ON i.Id=u.InstitutionId LEFT JOIN dbo.Classes c ON c.Id=u.ClassId ORDER BY e.ExamDate DESC, e.Id DESC`);
  sendXlsx(res, 'auren-tum-veri', [
    { name: 'Kullanıcılar', widths: [8, 22, 28, 24, 8, 8, 10, 8, 12, 12, 22, 12, 10, 12], rows: [['Id', 'Kullanıcı adı', 'E-posta', 'Ad soyad', 'Yönetici', 'Pasif', 'Rol', 'Sınav', 'Kayıt', 'Son giriş', 'Kurum', 'Sınıf', 'Deneme', 'Çalışma (dk)'],
      ...users.map(u => [u.Id, u.Username, hiddenMail(u.Email), u.FullName ?? '', u.IsAdmin ? 'Evet' : '', u.IsDisabled ? 'Evet' : '', u.Role ?? 'bireysel', u.ExamTrack ?? '', u.Created, u.LastLogin ?? '', u.Inst ?? '', u.ClassName ?? '', u.Exams, u.Minutes])] },
    { name: 'Kurumlar', widths: [26, 16, 8, 10, 8, 12, 10, 10, 8], rows: [['Kurum', 'Kısa ad', 'Sınav', 'Kota', 'Aktif', 'Oluşturma', 'Öğrenci', 'Öğretmen', 'Sınıf'],
      ...insts.map(i => [i.Name, i.Slug, i.ExamTrack, i.StudentLimit ?? '', i.IsActive ? 'Evet' : 'Hayır', i.Created, i.Students, i.Teachers, i.Classes])] },
    { name: 'Denemeler', widths: [22, 22, 12, 8, 8, 28, 12, 10], rows: [['Kullanıcı adı', 'Kurum', 'Sınıf', 'Sınav', 'Bölüm', 'Deneme', 'Tarih', 'Toplam net'],
      ...exams.map(e => [e.Username, e.Inst ?? '', e.ClassName ?? '', e.ExamType, e.ExamPart, e.ExamName, e.ExamDate, round2(e.TotalNet)])] },
  ]);
}));

export default r;
