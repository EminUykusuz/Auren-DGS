import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { requireAdmin, validate, wrap } from '../security.js';

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
    (SELECT COALESCE(AVG(CAST(MathNet + TurkceNet AS float)),0) FROM dbo.TrialExams) AS AvgNet,
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
      UNION ALL SELECT 'exam', u.Username, e.ExamName + ' · ' + CAST(e.MathNet + e.TurkceNet AS varchar(10)) + ' net', DATEADD(second, e.Id % 60, CAST(e.ExamDate AS datetime2)) FROM dbo.TrialExams e JOIN dbo.Users u ON u.Id=e.UserId
      UNION ALL SELECT 'session', u.Username, s.TopicKey + ' · ' + CAST(s.DurationMinutes AS varchar(10)) + ' dk', DATEADD(second, s.Id % 60, CAST(s.StudyDate AS datetime2)) FROM dbo.StudySessions s JOIN dbo.Users u ON u.Id=s.UserId
      UNION ALL SELECT 'friend', u.Username, 'arkadaşlık ' + f.Status, f.CreatedAt FROM dbo.Friendships f JOIN dbo.Users u ON u.Id=f.RequesterId
    ) a ORDER BY At DESC`);
  res.json({ events: rows.map(x => ({ kind: x.Kind, username: x.Username, detail: x.Detail, at: x.At })) });
}));

export default r;
