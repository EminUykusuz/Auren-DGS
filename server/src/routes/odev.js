// Haftalık ödev (kurum). Personel (yönetici/öğretmen) kendi kapsamındaki sınıflara ödev verir; öğrenci kendi sınıfının ödevlerini görür ve maddeleri işaretler.
// Kapsam kuralı kurum.js ile aynı: yönetici → kurumun tüm sınıfları, öğretmen → atandığı sınıflar. Başka kurumun kaydı 404 döner.
import { Router } from 'express';
import express from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { requireAuth, requireStaff, validate, wrap } from '../security.js';
import { isStaff } from '../kurum-lib.js';
import { sendXlsx } from '../xlsx.js';

const r = Router();
const idParam = z.object({ id: z.coerce.number().int().positive() });
const itemParam = z.object({ id: z.coerce.number().int().positive(), itemId: z.coerce.number().int().positive() });
const MAX_FILE = 2 * 1024 * 1024;

const classScope = (req, a = 'h') => req.role === 'owner'
  ? `${a}.InstitutionId=@inst`
  : `${a}.InstitutionId=@inst AND ${a}.ClassId IN (SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me)`;
const scopeParams = (req) => ({ inst: req.institutionId, me: req.userId });

// Personel: kapsamındaki ödev. Öğrenci: yalnızca kendi sınıfının ödevi. Aksi halde null (→ 404).
async function loadHw(req, id, withFile = false) {
  const cols = `h.Id, h.ClassId, h.Title, h.Note, CONVERT(char(10), h.DueDate, 23) AS DueDate, h.FileName, h.FileType, h.CreatedAt, c.Name AS ClassName${withFile ? ', h.FileData' : ''}`;
  if (isStaff(req.role)) {
    const [h] = await query(`SELECT ${cols} FROM dbo.Homework h JOIN dbo.Classes c ON c.Id=h.ClassId WHERE h.Id=@id AND ${classScope(req)}`, { id, ...scopeParams(req) });
    return h ?? null;
  }
  if (req.role === 'student' && req.institutionId && req.classId) {
    const [h] = await query(`SELECT ${cols} FROM dbo.Homework h JOIN dbo.Classes c ON c.Id=h.ClassId WHERE h.Id=@id AND h.InstitutionId=@inst AND h.ClassId=@cls`, { id, inst: req.institutionId, cls: req.classId });
    return h ?? null;
  }
  return null;
}
const itemsOf = (hwId) => query(`SELECT Id, Pos, Topic, Target FROM dbo.HomeworkItems WHERE HomeworkId=@h ORDER BY Pos`, { h: hwId });
const dto = (h) => ({ id: h.Id, classId: h.ClassId, className: h.ClassName, title: h.Title, note: h.Note ?? '', dueDate: h.DueDate ?? null, fileName: h.FileName ?? null, createdAt: h.CreatedAt });

/* ---------- Personel ---------- */
r.get('/homework', ...requireStaff, wrap(async (req, res) => {
  const rows = await query(`SELECT TOP 100 h.Id, h.ClassId, h.Title, h.Note, CONVERT(char(10), h.DueDate, 23) AS DueDate, h.FileName, h.CreatedAt, c.Name AS ClassName,
      (SELECT COUNT(*) FROM dbo.HomeworkItems i WHERE i.HomeworkId=h.Id) AS Items,
      (SELECT COUNT(*) FROM dbo.Users u WHERE u.ClassId=h.ClassId AND u.Role='student' AND u.IsDisabled=0) AS Students,
      (SELECT COUNT(*) FROM dbo.Users u WHERE u.ClassId=h.ClassId AND u.Role='student' AND u.IsDisabled=0
         AND (SELECT COUNT(*) FROM dbo.HomeworkItems i WHERE i.HomeworkId=h.Id) > 0
         AND (SELECT COUNT(*) FROM dbo.HomeworkItems i WHERE i.HomeworkId=h.Id) = (SELECT COUNT(*) FROM dbo.HomeworkDone d JOIN dbo.HomeworkItems i2 ON i2.Id=d.ItemId WHERE i2.HomeworkId=h.Id AND d.UserId=u.Id)) AS Finished
    FROM dbo.Homework h JOIN dbo.Classes c ON c.Id=h.ClassId WHERE ${classScope(req)} ORDER BY h.CreatedAt DESC`, scopeParams(req));
  res.json({ homework: rows.map(h => ({ ...dto(h), items: h.Items, students: h.Students, finished: h.Finished })) });
}));

const createSchema = z.object({
  classId: z.number().int().positive(),
  title: z.string().trim().min(2).max(120),
  note: z.string().trim().max(1000).optional().default(''),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  items: z.array(z.object({ topic: z.string().trim().min(1).max(150), target: z.number().int().min(1).max(5000).nullish() })).min(1).max(60),
}).strict();

r.post('/homework', ...requireStaff, validate(createSchema), wrap(async (req, res) => {
  const d = req.body;
  const [c] = await query(`SELECT Id FROM dbo.Classes WHERE Id=@c AND InstitutionId=@inst AND IsArchived=0 ${req.role === 'owner' ? '' : 'AND Id IN (SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me)'}`, { c: d.classId, ...scopeParams(req) });
  if (!c) return res.status(404).json({ error: 'Sınıf bulunamadı' });
  const id = await tx(async q => {
    const [h] = await q(`INSERT INTO dbo.Homework (InstitutionId, ClassId, CreatedBy, Title, Note, DueDate) OUTPUT INSERTED.Id VALUES (@inst,@c,@me,@t,@n,CAST(@due AS date))`,
      { inst: req.institutionId, c: d.classId, me: req.userId, t: d.title, n: d.note || null, due: d.dueDate ?? null });
    for (let i = 0; i < d.items.length; i++) await q(`INSERT INTO dbo.HomeworkItems (HomeworkId, Pos, Topic, Target) VALUES (@h,@p,@t,@g)`, { h: h.Id, p: i + 1, t: d.items[i].topic, g: d.items[i].target ?? null });
    return h.Id;
  });
  res.status(201).json({ id });
}));

r.get('/homework/:id', ...requireStaff, validate(idParam, 'params'), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);
  if (!h) return res.status(404).json({ error: 'Bulunamadı' });
  const items = await itemsOf(h.Id);
  const students = await query(`SELECT Id, Username, FullName, StudentNo FROM dbo.Users WHERE ClassId=@c AND Role='student' AND IsDisabled=0 ORDER BY FullName, Username`, { c: h.ClassId });
  const done = items.length ? await query(`SELECT d.ItemId, d.UserId FROM dbo.HomeworkDone d JOIN dbo.HomeworkItems i ON i.Id=d.ItemId WHERE i.HomeworkId=@h`, { h: h.Id }) : [];
  const set = new Set(done.map(x => `${x.ItemId}:${x.UserId}`));
  res.json({ ...dto(h), items: items.map(i => ({ id: i.Id, topic: i.Topic, target: i.Target })),
    students: students.map(s => ({ id: s.Id, name: s.FullName || s.Username, studentNo: s.StudentNo ?? '', done: items.map(i => set.has(`${i.Id}:${s.Id}`)) })) });
}));

r.delete('/homework/:id', ...requireStaff, validate(idParam, 'params'), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);
  if (!h) return res.status(404).json({ error: 'Bulunamadı' });
  await query(`DELETE FROM dbo.Homework WHERE Id=@id`, { id: h.Id });
  res.json({ ok: true });
}));

// Dosya eki: yalnızca .xlsx ve .pdf, ≤2 MB, içerik imzası kontrol edilir (uzantı yalan söyleyemez)
const TYPES = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pdf: 'application/pdf' };
const sig = (b) => (b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4 ? 'xlsx' : b.length > 5 && b.toString('latin1', 0, 5) === '%PDF-' ? 'pdf' : null);
const safeName = (n, ext) => (String(n ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\.+/g, '.').trim().slice(0, 80).replace(/\.(xlsx|pdf)$/i, '') || 'odev') + '.' + ext;

r.put('/homework/:id/file', ...requireStaff, validate(idParam, 'params'), express.raw({ type: () => true, limit: MAX_FILE }), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);
  if (!h) return res.status(404).json({ error: 'Bulunamadı' });
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) return res.status(400).json({ error: 'Dosya boş' });
  const ext = sig(buf);
  if (!ext) return res.status(400).json({ error: 'Yalnızca .xlsx (Excel) ve .pdf dosyaları yüklenebilir' });
  const name = safeName(req.query.name, ext);
  await query(`UPDATE dbo.Homework SET FileName=@n, FileType=@t, FileData=@d WHERE Id=@id`, { n: name, t: TYPES[ext], d: buf, id: h.Id });
  res.json({ ok: true, fileName: name });
}));

r.delete('/homework/:id/file', ...requireStaff, validate(idParam, 'params'), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);
  if (!h) return res.status(404).json({ error: 'Bulunamadı' });
  await query(`UPDATE dbo.Homework SET FileName=NULL, FileType=NULL, FileData=NULL WHERE Id=@id`, { id: h.Id });
  res.json({ ok: true });
}));

// Personelin Excel raporu: öğrenci × madde (✓), tamamlama yüzdesi
r.get('/homework/:id/results.xlsx', ...requireStaff, validate(idParam, 'params'), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);
  if (!h) return res.status(404).json({ error: 'Bulunamadı' });
  const items = await itemsOf(h.Id);
  const students = await query(`SELECT Id, Username, FullName, StudentNo FROM dbo.Users WHERE ClassId=@c AND Role='student' AND IsDisabled=0 ORDER BY FullName, Username`, { c: h.ClassId });
  const done = items.length ? await query(`SELECT d.ItemId, d.UserId FROM dbo.HomeworkDone d JOIN dbo.HomeworkItems i ON i.Id=d.ItemId WHERE i.HomeworkId=@h`, { h: h.Id }) : [];
  const set = new Set(done.map(x => `${x.ItemId}:${x.UserId}`));
  sendXlsx(res, `odev-sonuc-${h.Id}`, [{ name: 'Sonuç', widths: [12, 26, ...items.map(() => 18), 12, 10], rows: [
    ['Öğrenci no', 'Ad soyad', ...items.map(i => i.Topic + (i.Target ? ` (${i.Target})` : '')), 'Tamamlanan', 'Yüzde'],
    ...students.map(s => { const n = items.filter(i => set.has(`${i.Id}:${s.Id}`)).length; return [s.StudentNo ?? '', s.FullName || s.Username, ...items.map(i => (set.has(`${i.Id}:${s.Id}`) ? 'Evet' : '')), n, items.length ? Math.round(n / items.length * 100) : 0]; }),
  ] }]);
}));

/* ---------- Personel + öğrenci: ödev kâğıdı (Excel) ve dosya eki ---------- */
r.get('/homework/:id/sheet.xlsx', requireAuth, validate(idParam, 'params'), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);
  if (!h) return res.status(404).json({ error: 'Bulunamadı' });
  const items = await itemsOf(h.Id);
  sendXlsx(res, `odev-${h.Id}`, [{ name: 'Ödev', widths: [6, 46, 14, 14], rows: [
    ['Sıra', h.Title + (h.DueDate ? ` · teslim ${h.DueDate}` : ''), 'Hedef soru', 'Yapılan soru'],
    ...items.map(i => [i.Pos, i.Topic, i.Target ?? '', '']),
    ...(h.Note ? [[], ['', h.Note]] : []),
  ] }]);
}));

r.get('/homework/:id/file', requireAuth, validate(idParam, 'params'), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id, true);
  if (!h || !h.FileData) return res.status(404).json({ error: 'Bulunamadı' });
  res.set({ 'Content-Type': h.FileType, 'Content-Disposition': `attachment; filename="odev.${h.FileType.includes('pdf') ? 'pdf' : 'xlsx'}"; filename*=UTF-8''${encodeURIComponent(h.FileName)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' })
    .send(Buffer.from(h.FileData));
}));

/* ---------- Öğrenci ---------- */
const needStudent = (req, res, next) => (req.role === 'student' && req.institutionId && req.classId ? next() : res.status(404).json({ error: 'Bulunamadı' }));

r.get('/my', requireAuth, needStudent, wrap(async (req, res) => {
  const hws = await query(`SELECT TOP 50 h.Id, h.ClassId, h.Title, h.Note, CONVERT(char(10), h.DueDate, 23) AS DueDate, h.FileName, h.CreatedAt, c.Name AS ClassName
    FROM dbo.Homework h JOIN dbo.Classes c ON c.Id=h.ClassId WHERE h.InstitutionId=@inst AND h.ClassId=@cls ORDER BY h.CreatedAt DESC`, { inst: req.institutionId, cls: req.classId });
  const ids = hws.map(h => h.Id);
  const items = ids.length ? await query(`SELECT Id, HomeworkId, Pos, Topic, Target FROM dbo.HomeworkItems WHERE HomeworkId IN (${ids.join(',')}) ORDER BY HomeworkId, Pos`) : []; // ids: veritabanından gelen tam sayılar
  const done = ids.length ? await query(`SELECT ItemId FROM dbo.HomeworkDone WHERE UserId=@me`, { me: req.userId }) : [];
  const mine = new Set(done.map(d => d.ItemId));
  res.json({ homework: hws.map(h => ({ ...dto(h), items: items.filter(i => i.HomeworkId === h.Id).map(i => ({ id: i.Id, topic: i.Topic, target: i.Target, done: mine.has(i.Id) })) })) });
}));

r.put('/my/:id/items/:itemId', requireAuth, needStudent, validate(itemParam, 'params'), validate(z.object({ done: z.boolean() }).strict()), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);                       // sınıf kapsamı: başka sınıfın ödevi 404
  if (!h) return res.status(404).json({ error: 'Bulunamadı' });
  const [it] = await query(`SELECT Id FROM dbo.HomeworkItems WHERE Id=@i AND HomeworkId=@h`, { i: req.params.itemId, h: h.Id });
  if (!it) return res.status(404).json({ error: 'Bulunamadı' });
  if (req.body.done) await query(`IF NOT EXISTS (SELECT 1 FROM dbo.HomeworkDone WHERE ItemId=@i AND UserId=@u) INSERT INTO dbo.HomeworkDone (ItemId, UserId) VALUES (@i,@u)`, { i: it.Id, u: req.userId });
  else await query(`DELETE FROM dbo.HomeworkDone WHERE ItemId=@i AND UserId=@u`, { i: it.Id, u: req.userId });
  res.json({ ok: true, done: req.body.done });
}));

export default r;
