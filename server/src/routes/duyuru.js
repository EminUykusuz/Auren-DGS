// Duyuru panosu (kurum). Yönetici: tüm kuruma ya da herhangi bir sınıfa. Öğretmen: yalnızca atandığı sınıflara.
// Öğrenci: kendi sınıfına ve tüm kuruma yazılanları görür, okundu işaretler. Başka kurumun kaydı 404 döner.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, requireStaff, validate, wrap } from '../security.js';

const r = Router();
const idParam = z.object({ id: z.coerce.number().int().positive() });
const MAX_PER_INST = 500;
const todayTR = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);

const TEACHER_CLASSES = `SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me`;
// Personelin gördüğü duyurular: yönetici hepsini; öğretmen kuruma yazılanları ve atandığı sınıflarınkini
const visible = (req) => (req.role === 'owner' ? 'a.InstitutionId=@inst' : `a.InstitutionId=@inst AND (a.ClassId IS NULL OR a.ClassId IN (${TEACHER_CLASSES}))`);
const dto = (a) => ({ id: a.Id, title: a.Title, body: a.Body, classId: a.ClassId ?? null, className: a.ClassName ?? null, author: a.AuthorName ?? '', expiresAt: a.ExpiresAt ?? null, createdAt: a.CreatedAt });

r.get('/', ...requireStaff, wrap(async (req, res) => {
  const rows = await query(`SELECT TOP 100 a.Id, a.ClassId, a.AuthorId, a.AuthorName, a.Title, a.Body, CONVERT(char(10), a.ExpiresAt, 23) AS ExpiresAt, a.CreatedAt, c.Name AS ClassName,
      (SELECT COUNT(*) FROM dbo.Users u WHERE u.InstitutionId=a.InstitutionId AND u.Role='student' AND u.IsDisabled=0 AND (a.ClassId IS NULL OR u.ClassId=a.ClassId)) AS Audience,
      (SELECT COUNT(*) FROM dbo.AnnouncementReads x JOIN dbo.Users u ON u.Id=x.UserId WHERE x.AnnouncementId=a.Id AND u.Role='student' AND u.IsDisabled=0 AND (a.ClassId IS NULL OR u.ClassId=a.ClassId)) AS ReadN
    FROM dbo.Announcements a LEFT JOIN dbo.Classes c ON c.Id=a.ClassId WHERE ${visible(req)} ORDER BY a.CreatedAt DESC`, { inst: req.institutionId, me: req.userId });
  res.json({ announcements: rows.map(a => ({ ...dto(a), audience: a.Audience, read: a.ReadN, mine: a.AuthorId === req.userId, expired: !!a.ExpiresAt && a.ExpiresAt < todayTR() })) });
}));

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(2000),
  classId: z.number().int().positive().nullish(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s, 'Geçersiz tarih').nullish(),
}).strict();

r.post('/', ...requireStaff, validate(createSchema), wrap(async (req, res) => {
  const d = req.body;
  if (d.classId) {
    const [c] = await query(`SELECT Id FROM dbo.Classes WHERE Id=@c AND InstitutionId=@inst AND IsArchived=0 ${req.role === 'owner' ? '' : `AND Id IN (${TEACHER_CLASSES})`}`, { c: d.classId, inst: req.institutionId, me: req.userId });
    if (!c) return res.status(404).json({ error: 'Sınıf bulunamadı' });
  } else if (req.role !== 'owner') return res.status(403).json({ error: 'Tüm kuruma duyuruyu yalnızca yönetici yazabilir; bir sınıf seç' });
  if (d.expiresAt && d.expiresAt < todayTR()) return res.status(400).json({ error: 'Bitiş tarihi geçmişte olamaz' });
  const [n] = await query(`SELECT COUNT(*) AS n FROM dbo.Announcements WHERE InstitutionId=@inst`, { inst: req.institutionId });
  if (n.n >= MAX_PER_INST) return res.status(429).json({ error: 'Duyuru sınırına ulaşıldı; eskilerini sil' });
  const [me] = await query(`SELECT COALESCE(FullName, Username) AS Name FROM dbo.Users WHERE Id=@me`, { me: req.userId });
  const [a] = await query(`INSERT INTO dbo.Announcements (InstitutionId, ClassId, AuthorId, AuthorName, Title, Body, ExpiresAt) OUTPUT INSERTED.Id VALUES (@inst,@c,@me,@an,@t,@b,CAST(@e AS date))`,
    { inst: req.institutionId, c: d.classId ?? null, me: req.userId, an: (me?.Name ?? '').slice(0, 80), t: d.title, b: d.body, e: d.expiresAt ?? null });
  res.status(201).json({ id: a.Id });
}));

r.delete('/:id', ...requireStaff, validate(idParam, 'params'), wrap(async (req, res) => {
  // Yönetici hepsini, öğretmen yalnızca kendi yazdığını silebilir
  const [a] = await query(`SELECT a.Id FROM dbo.Announcements a WHERE a.Id=@id AND ${visible(req)} ${req.role === 'owner' ? '' : 'AND a.AuthorId=@me'}`, { id: req.params.id, inst: req.institutionId, me: req.userId });
  if (!a) return res.status(404).json({ error: 'Bulunamadı' });
  await query(`DELETE FROM dbo.Announcements WHERE Id=@id`, { id: a.Id });
  res.json({ ok: true });
}));

/* ---------- Öğrenci ---------- */
const needStudent = (req, res, next) => (req.role === 'student' && req.institutionId ? next() : res.status(404).json({ error: 'Bulunamadı' }));
const forMe = `a.InstitutionId=@inst AND (a.ClassId IS NULL OR a.ClassId=@cls) AND (a.ExpiresAt IS NULL OR a.ExpiresAt >= CAST(@today AS date))`;
const myParams = (req) => ({ inst: req.institutionId, cls: req.classId ?? 0, me: req.userId, today: todayTR() });

r.get('/my', requireAuth, needStudent, wrap(async (req, res) => {
  const rows = await query(`SELECT TOP 20 a.Id, a.ClassId, a.AuthorName, a.Title, a.Body, CONVERT(char(10), a.ExpiresAt, 23) AS ExpiresAt, a.CreatedAt, c.Name AS ClassName,
      CASE WHEN EXISTS (SELECT 1 FROM dbo.AnnouncementReads x WHERE x.AnnouncementId=a.Id AND x.UserId=@me) THEN 1 ELSE 0 END AS IsRead
    FROM dbo.Announcements a LEFT JOIN dbo.Classes c ON c.Id=a.ClassId WHERE ${forMe} ORDER BY a.CreatedAt DESC`, myParams(req));
  res.json({ announcements: rows.map(a => ({ ...dto(a), read: !!a.IsRead })), unread: rows.filter(a => !a.IsRead).length });
}));

r.post('/my/:id/read', requireAuth, needStudent, validate(idParam, 'params'), wrap(async (req, res) => {
  const [a] = await query(`SELECT a.Id FROM dbo.Announcements a WHERE a.Id=@id AND ${forMe}`, { id: req.params.id, ...myParams(req) });
  if (!a) return res.status(404).json({ error: 'Bulunamadı' });
  await query(`IF NOT EXISTS (SELECT 1 FROM dbo.AnnouncementReads WHERE AnnouncementId=@id AND UserId=@me) INSERT INTO dbo.AnnouncementReads (AnnouncementId, UserId) VALUES (@id,@me)`, { id: a.Id, me: req.userId });
  res.json({ ok: true });
}));

export default r;
