// Haftalık ödev (kurum). İki tür: SINIF ödevi (sınıftaki herkese) ve KİŞİYE ÖZEL ödev (tek öğrenciye; Excel'den toplu verilebilir).
// Personel (yönetici/öğretmen) kendi kapsamına ödev verir; öğrenci kendi ödevini görür, maddeleri işaretler, "bitirdim" der ve
// teslim tarihini öğretmenle konuşur (talep → kabul/ret/yeni tarih). Kapsam kuralı kurum.js ile aynı: yönetici → kurumun tümü,
// öğretmen → atandığı sınıflar (kişisel ödevde öğrencinin O ANKİ sınıfı). Başka kurumun kaydı 404 döner.
import { Router } from 'express';
import express from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { requireAuth, requireStaff, validate, wrap } from '../security.js';
import { isStaff } from '../kurum-lib.js';
import { sendXlsx } from '../xlsx.js';
import { notifyHomework } from '../mailer.js';
import { readXlsx } from '../xlsx-read.js';
import { parseDelimited, parseRecords, buildAssignments, parseDate, hwStatus, MAX_ASSIGN, MAX_ITEMS } from '../odev-lib.js';

const r = Router();
const idParam = z.object({ id: z.coerce.number().int().positive() });
const itemParam = z.object({ id: z.coerce.number().int().positive(), itemId: z.coerce.number().int().positive() });
const batchParam = z.object({ batchId: z.string().uuid() });
const threadParam = z.object({ id: z.coerce.number().int().positive(), userId: z.coerce.number().int().positive() });
const MAX_FILE = 2 * 1024 * 1024, MAX_THREAD = 100;
const todayTR = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);   // Türkiye saati (UTC+3)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => parseDate(s) === s, 'Geçersiz tarih');
const itemsSchema = z.array(z.object({ topic: z.string().trim().min(1).max(150), target: z.number().int().min(1).max(5000).nullish() })).min(1).max(MAX_ITEMS);

// Ödevin kapsamı: yönetici → kurumun tüm ödevleri; öğretmen → atandığı sınıfların sınıf ödevleri + o sınıflardaki öğrencilerin kişisel ödevleri
const TEACHER_CLASSES = `SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me`;
const hwScope = (req, a = 'h') => req.role === 'owner'
  ? `${a}.InstitutionId=@inst`
  : `${a}.InstitutionId=@inst AND ((${a}.ClassId IS NOT NULL AND ${a}.ClassId IN (${TEACHER_CLASSES})) OR (${a}.UserId IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Users su WHERE su.Id=${a}.UserId AND su.ClassId IN (${TEACHER_CLASSES}))))`;
const studentScope = (req, a = 'u') => req.role === 'owner'
  ? `${a}.InstitutionId=@inst`
  : `${a}.InstitutionId=@inst AND ${a}.ClassId IN (${TEACHER_CLASSES})`;
const scopeParams = (req) => ({ inst: req.institutionId, me: req.userId });
// (ödev, öğrenci) için yanıt bekleyen tarih talebi: son "request"ten sonra kabul/ret/yeni tarih yok
const openReq = (hw, uid) => `EXISTS (SELECT 1 FROM dbo.HomeworkThread t WHERE t.HomeworkId=${hw} AND t.UserId=${uid} AND t.Kind='request' AND NOT EXISTS (SELECT 1 FROM dbo.HomeworkThread t2 WHERE t2.HomeworkId=t.HomeworkId AND t2.UserId=t.UserId AND t2.Id>t.Id AND t2.Kind IN ('accept','reject','set')))`;

const HW_COLS = `h.Id, h.ClassId, h.UserId, h.Title, h.Note, CONVERT(char(10), h.DueDate, 23) AS DueDate, h.FileName, h.FileType, h.CreatedAt, c.Name AS ClassName, COALESCE(su.FullName, su.Username) AS StudentName`;
const HW_FROM = `dbo.Homework h LEFT JOIN dbo.Classes c ON c.Id=h.ClassId LEFT JOIN dbo.Users su ON su.Id=h.UserId`;

// Personel: kapsamındaki ödev. Öğrenci: yalnızca kendi sınıfının ya da kendine özel ödevi. Aksi halde null (→ 404).
async function loadHw(req, id, withFile = false) {
  const cols = HW_COLS + (withFile ? ', h.FileData' : '');
  if (isStaff(req.role)) {
    const [h] = await query(`SELECT ${cols} FROM ${HW_FROM} WHERE h.Id=@id AND ${hwScope(req)}`, { id, ...scopeParams(req) });
    return h ?? null;
  }
  if (req.role === 'student' && req.institutionId) {
    const [h] = await query(`SELECT ${cols} FROM ${HW_FROM} WHERE h.Id=@id AND h.InstitutionId=@inst AND ((h.ClassId IS NOT NULL AND h.ClassId=@cls) OR h.UserId=@me)`,
      { id, inst: req.institutionId, cls: req.classId ?? 0, me: req.userId });
    return h ?? null;
  }
  return null;
}
const itemsOf = (hwId) => query(`SELECT Id, Pos, Topic, Target FROM dbo.HomeworkItems WHERE HomeworkId=@h ORDER BY Pos`, { h: hwId });
const dto = (h) => ({ id: h.Id, kind: h.UserId ? 'personal' : 'class', classId: h.ClassId ?? null, className: h.ClassName ?? null, studentId: h.UserId ?? null, studentName: h.StudentName ?? null,
  title: h.Title, note: h.Note ?? '', dueDate: h.DueDate ?? null, fileName: h.FileName ?? null, createdAt: h.CreatedAt });
const tdto = (t) => ({ id: t.Id, role: t.AuthorRole, kind: t.Kind, body: t.Body ?? '', proposedDue: t.ProposedDue ?? null, at: t.CreatedAt, author: t.AuthorName ?? '' });
const THREAD_SQL = `SELECT t.Id, t.HomeworkId, t.UserId, t.AuthorRole, t.Kind, t.Body, CONVERT(char(10), t.ProposedDue, 23) AS ProposedDue, t.CreatedAt, COALESCE(a.FullName, a.Username) AS AuthorName
  FROM dbo.HomeworkThread t LEFT JOIN dbo.Users a ON a.Id=t.AuthorId`;
const threadOf = (hwId, userId) => query(`${THREAD_SQL} WHERE t.HomeworkId=@h AND t.UserId=@u ORDER BY t.Id`, { h: hwId, u: userId });

// Ödevin hedefindeki öğrenci mi? (sınıf ödevi → şu an o sınıfta; kişisel → ödevin sahibi)
async function targetStudent(req, h, userId) {
  const [u] = await query(`SELECT Id, FullName, Username, ClassId FROM dbo.Users WHERE Id=@u AND Role='student' AND InstitutionId=@inst AND IsDisabled=0`, { u: userId, inst: req.institutionId });
  if (!u) return null;
  return h.UserId ? (h.UserId === u.Id ? u : null) : (u.ClassId === h.ClassId ? u : null);
}

/* ---------- Personel: liste ---------- */
r.get('/homework', ...requireStaff, wrap(async (req, res) => {
  const rows = await query(`SELECT TOP 100 h.Id, h.ClassId, h.Title, h.Note, CONVERT(char(10), h.DueDate, 23) AS DueDate, h.FileName, h.CreatedAt, c.Name AS ClassName,
      (SELECT COUNT(*) FROM dbo.HomeworkItems i WHERE i.HomeworkId=h.Id) AS Items,
      (SELECT COUNT(*) FROM dbo.Users u WHERE u.ClassId=h.ClassId AND u.Role='student' AND u.IsDisabled=0) AS Students,
      (SELECT COUNT(*) FROM dbo.Users u JOIN dbo.HomeworkSubmissions s ON s.UserId=u.Id AND s.HomeworkId=h.Id WHERE u.ClassId=h.ClassId AND u.Role='student' AND u.IsDisabled=0) AS Finished,
      (SELECT COUNT(DISTINCT t.UserId) FROM dbo.HomeworkThread t WHERE t.HomeworkId=h.Id AND t.Kind='request'
         AND NOT EXISTS (SELECT 1 FROM dbo.HomeworkThread t2 WHERE t2.HomeworkId=t.HomeworkId AND t2.UserId=t.UserId AND t2.Id>t.Id AND t2.Kind IN ('accept','reject','set'))) AS Requests
    FROM dbo.Homework h JOIN dbo.Classes c ON c.Id=h.ClassId WHERE h.ClassId IS NOT NULL AND ${hwScope(req)} ORDER BY h.CreatedAt DESC`, scopeParams(req));
  const batches = await query(`SELECT TOP 100 LOWER(CONVERT(varchar(36), BatchId)) AS BatchId, MIN(Title) AS Title, MIN(CreatedAt) AS CreatedAt, COUNT(*) AS Students, SUM(Items) AS Items, SUM(Submitted) AS Finished, SUM(Req) AS Requests,
      CONVERT(char(10), MIN(DueDate), 23) AS DueFrom, CONVERT(char(10), MAX(DueDate), 23) AS DueTo
    FROM (SELECT h.BatchId, h.Title, h.CreatedAt, h.DueDate,
        (SELECT COUNT(*) FROM dbo.HomeworkItems i WHERE i.HomeworkId=h.Id) AS Items,
        CASE WHEN EXISTS (SELECT 1 FROM dbo.HomeworkSubmissions s WHERE s.HomeworkId=h.Id AND s.UserId=h.UserId) THEN 1 ELSE 0 END AS Submitted,
        CASE WHEN ${openReq('h.Id', 'h.UserId')} THEN 1 ELSE 0 END AS Req
      FROM dbo.Homework h WHERE h.UserId IS NOT NULL AND ${hwScope(req)}) x
    GROUP BY BatchId ORDER BY MIN(CreatedAt) DESC`, scopeParams(req));
  res.json({
    homework: rows.map(h => ({ ...dto(h), items: h.Items, students: h.Students, finished: h.Finished, requests: h.Requests })),
    batches: batches.map(b => ({ batchId: b.BatchId, title: b.Title, createdAt: b.CreatedAt, students: b.Students, items: b.Items, finished: b.Finished, requests: b.Requests, dueFrom: b.DueFrom ?? null, dueTo: b.DueTo ?? null })),
  });
}));

// Sekme rozeti: yanıt bekleyen tarih talepleri
r.get('/requests-count', ...requireStaff, wrap(async (req, res) => {
  const [x] = await query(`SELECT COUNT(*) AS n FROM (SELECT DISTINCT t.HomeworkId, t.UserId FROM dbo.HomeworkThread t JOIN dbo.Homework h ON h.Id=t.HomeworkId
    WHERE t.Kind='request' AND ${hwScope(req)} AND NOT EXISTS (SELECT 1 FROM dbo.HomeworkThread t2 WHERE t2.HomeworkId=t.HomeworkId AND t2.UserId=t.UserId AND t2.Id>t.Id AND t2.Kind IN ('accept','reject','set'))) x`, scopeParams(req));
  res.json({ open: x.n });
}));

// Öğrencilere "yeni ödevin var" e-postası (SMTP ayarlıysa; e-postası olmayan atlanır). Beklenmez: yanıt gecikmez, hata ödevi bozmaz.
// Kişisel pakette her öğrencinin maddesi farklı olduğundan çağrılar sıraya girer (her biri kendi aralığıyla gönderir).
let mailQueue = Promise.resolve();
function mailAssigned(req, targets, hw) {
  const ctx = { inst: req.institutionId, me: req.userId };
  mailQueue = mailQueue.then(async () => {
    const [m] = await query(`SELECT COALESCE(u.FullName, u.Username) AS Name, i.Name AS Inst FROM dbo.Users u JOIN dbo.Institutions i ON i.Id=@inst WHERE u.Id=@me`, ctx);
    await notifyHomework(targets, { ...hw, teacher: m?.Name ?? 'Öğretmenin', inst: m?.Inst ?? '' });
  }).catch(e => console.error('[mail] kuyruk hatası:', String(e.message).slice(0, 160)));
}

/* ---------- Personel: sınıf ödevi ver ---------- */
const createSchema = z.object({
  classId: z.number().int().positive(),
  title: z.string().trim().min(2).max(120),
  note: z.string().trim().max(1000).optional().default(''),
  dueDate: isoDate.nullish(),
  items: itemsSchema,
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
  const classStu = await query(`SELECT Id FROM dbo.Users WHERE ClassId=@c AND Role='student' AND IsDisabled=0`, { c: d.classId });
  mailAssigned(req, classStu.map(s => ({ id: s.Id, due: d.dueDate })), { title: d.title, items: d.items, personal: false });
  res.status(201).json({ id });
}));

/* ---------- Personel: kişiye özel ödev ---------- */
// Kapsamdaki aktif öğrenciler (Excel eşlemesi ve şablon için)
const scopeStudents = (req) => query(`SELECT u.Id, u.Username, u.FullName, u.StudentNo, c.Name AS ClassName FROM dbo.Users u LEFT JOIN dbo.Classes c ON c.Id=u.ClassId
  WHERE u.Role='student' AND u.IsDisabled=0 AND ${studentScope(req)} ORDER BY c.Name, u.FullName, u.Username`, scopeParams(req));

// Excel/CSV şablonu: kapsamdaki her öğrenci bir satır; öğretmen Konu / Hedef / Teslim sütunlarını doldurur
r.get('/homework/personal/template.xlsx', ...requireStaff, wrap(async (req, res) => {
  const ss = await scopeStudents(req);
  sendXlsx(res, 'kisiye-ozel-odev-sablonu', [{ name: 'Ödev', widths: [14, 26, 12, 36, 12, 16], rows: [
    ['Öğrenci no', 'Ad soyad', 'Sınıf', 'Konu', 'Hedef soru', 'Teslim tarihi'],
    ...ss.map(s => [s.StudentNo ?? '', s.FullName || s.Username, s.ClassName ?? '', '', '', '']),
  ] }, { name: 'Nasıl doldurulur', widths: [90], rows: [
    ['Nasıl doldurulur'],
    ['Her satır bir öğrencinin bir konusudur. Aynı öğrenciye birden fazla konu vermek için satırı kopyala (öğrenci no ve ad aynı kalsın).'],
    ['Konu sütunu boş bırakılan satır ödev almaz; ödev vermeyeceğin öğrencilerin satırını boş bırakabilirsin.'],
    ['Hedef soru ve Teslim tarihi isteğe bağlıdır. Tarihi 18.12.2026 ya da 2026-12-18 biçiminde yaz.'],
    ['Öğrenci eşleşmesi önce öğrenci numarasıyla, numara yoksa ad soyadla yapılır. Sınıf sütunu yalnızca bilgi içindir.'],
  ] }]);
}));

// Önizleme: Excel (.xlsx, ham bayt) ya da yapıştırılan/CSV metin gönderilir; kimse kaydedilmez
r.post('/homework/personal/preview', ...requireStaff, express.raw({ type: () => true, limit: MAX_FILE }), wrap(async (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length === 0) return res.status(400).json({ error: 'Dosya ya da metin boş' });
  let rows;
  try { rows = buf[0] === 0x50 && buf[1] === 0x4b ? readXlsx(buf).rows : parseDelimited(buf.toString('utf8')); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!rows.length) return res.status(400).json({ error: 'Dosyada satır bulunamadı' });
  const { records, errors: e1, header } = parseRecords(rows);
  const ss = await scopeStudents(req);
  const { assignments, errors: e2 } = buildAssignments(records, ss.map(s => ({ id: s.Id, name: s.FullName || s.Username, no: s.StudentNo, username: s.Username })));
  const byId = new Map(ss.map(s => [s.Id, s]));
  res.json({ header, assignments: assignments.map(a => ({ ...a, className: byId.get(a.studentId)?.ClassName ?? null })), errors: [...e1, ...e2].sort((a, b) => a.line - b.line), rowCount: rows.length });
}));

const personalSchema = z.object({
  title: z.string().trim().min(2).max(120),
  note: z.string().trim().max(1000).optional().default(''),
  dueDate: isoDate.nullish(),
  assignments: z.array(z.object({ studentId: z.number().int().positive(), dueDate: isoDate.nullish(), items: itemsSchema }).strict()).min(1).max(MAX_ASSIGN),
}).strict();

r.post('/homework/personal', ...requireStaff, validate(personalSchema), wrap(async (req, res) => {
  const d = req.body;
  const ids = [...new Set(d.assignments.map(a => a.studentId))];
  if (ids.length !== d.assignments.length) return res.status(400).json({ error: 'Aynı öğrenci iki kez seçilmiş' });
  const ok = await query(`SELECT u.Id FROM dbo.Users u WHERE u.Role='student' AND u.IsDisabled=0 AND ${studentScope(req)} AND u.Id IN (${ids.map((_, i) => '@s' + i).join(',')})`,
    { ...scopeParams(req), ...Object.fromEntries(ids.map((x, i) => ['s' + i, x])) });
  if (ok.length !== ids.length) return res.status(404).json({ error: 'Öğrenci bulunamadı' });
  const batchId = crypto.randomUUID();
  const created = await tx(async q => {
    for (const a of d.assignments) {
      const [h] = await q(`INSERT INTO dbo.Homework (InstitutionId, ClassId, UserId, BatchId, CreatedBy, Title, Note, DueDate) OUTPUT INSERTED.Id VALUES (@inst,NULL,@u,@b,@me,@t,@n,CAST(@due AS date))`,
        { inst: req.institutionId, u: a.studentId, b: batchId, me: req.userId, t: d.title, n: d.note || null, due: a.dueDate ?? d.dueDate ?? null });
      for (let i = 0; i < a.items.length; i++) await q(`INSERT INTO dbo.HomeworkItems (HomeworkId, Pos, Topic, Target) VALUES (@h,@p,@t,@g)`, { h: h.Id, p: i + 1, t: a.items[i].topic, g: a.items[i].target ?? null });
    }
    return d.assignments.length;
  });
  for (const a of d.assignments) mailAssigned(req, [{ id: a.studentId, due: a.dueDate ?? d.dueDate }], { title: d.title, items: a.items, personal: true });
  res.status(201).json({ batchId, created });
}));

/* ---------- Personel: kişisel ödev paketi (aynı yüklemeden çıkan ödevler) ---------- */
async function loadBatch(req, batchId) {
  const hws = await query(`SELECT ${HW_COLS}, su.StudentNo, c2.Name AS StudentClass FROM ${HW_FROM} LEFT JOIN dbo.Classes c2 ON c2.Id=su.ClassId
    WHERE h.BatchId=@b AND h.UserId IS NOT NULL AND ${hwScope(req)} ORDER BY COALESCE(su.FullName, su.Username)`, { b: batchId, ...scopeParams(req) });
  if (!hws.length) return null;
  const ids = hws.map(h => h.Id);   // veritabanından gelen tam sayılar
  const items = await query(`SELECT Id, HomeworkId, Pos, Topic, Target FROM dbo.HomeworkItems WHERE HomeworkId IN (${ids.join(',')}) ORDER BY HomeworkId, Pos`);
  const done = await query(`SELECT d.ItemId, d.UserId FROM dbo.HomeworkDone d JOIN dbo.HomeworkItems i ON i.Id=d.ItemId WHERE i.HomeworkId IN (${ids.join(',')})`);
  const subs = await query(`SELECT HomeworkId, SubmittedAt FROM dbo.HomeworkSubmissions WHERE HomeworkId IN (${ids.join(',')})`);
  const dues = await query(`SELECT HomeworkId, CONVERT(char(10), DueDate, 23) AS DueDate FROM dbo.HomeworkDue WHERE HomeworkId IN (${ids.join(',')})`);
  const reqs = await query(`SELECT h.Id FROM dbo.Homework h WHERE h.Id IN (${ids.join(',')}) AND ${openReq('h.Id', 'h.UserId')}`);
  const doneSet = new Set(done.map(x => `${x.ItemId}:${x.UserId}`)), subBy = new Map(subs.map(s => [s.HomeworkId, s.SubmittedAt])), dueBy = new Map(dues.map(x => [x.HomeworkId, x.DueDate])), reqSet = new Set(reqs.map(x => x.Id));
  return { title: hws[0].Title, note: hws[0].Note ?? '', createdAt: hws[0].CreatedAt, students: hws.map(h => {
    const its = items.filter(i => i.HomeworkId === h.Id).map(i => ({ id: i.Id, topic: i.Topic, target: i.Target, done: doneSet.has(`${i.Id}:${h.UserId}`) }));
    return { homeworkId: h.Id, id: h.UserId, name: h.StudentName, studentNo: h.StudentNo ?? '', className: h.StudentClass ?? null, items: its, originalDue: h.DueDate ?? null, dueDate: dueBy.get(h.Id) ?? h.DueDate ?? null,
      submittedAt: subBy.get(h.Id) ?? null, requestOpen: reqSet.has(h.Id) };
  }) };
}

r.get('/batch/:batchId', ...requireStaff, validate(batchParam, 'params'), wrap(async (req, res) => {
  const b = await loadBatch(req, req.params.batchId);
  if (!b) return res.status(404).json({ error: 'Bulunamadı' });
  res.json(b);
}));

r.delete('/batch/:batchId', ...requireStaff, validate(batchParam, 'params'), wrap(async (req, res) => {
  const b = await query(`SELECT h.Id FROM dbo.Homework h WHERE h.BatchId=@b AND h.UserId IS NOT NULL AND ${hwScope(req)}`, { b: req.params.batchId, ...scopeParams(req) });
  if (!b.length) return res.status(404).json({ error: 'Bulunamadı' });
  await query(`DELETE FROM dbo.Homework WHERE Id IN (${b.map(x => x.Id).join(',')})`);
  res.json({ ok: true, deleted: b.length });
}));

r.get('/batch/:batchId/results.xlsx', ...requireStaff, validate(batchParam, 'params'), wrap(async (req, res) => {
  const b = await loadBatch(req, req.params.batchId);
  if (!b) return res.status(404).json({ error: 'Bulunamadı' });
  sendXlsx(res, 'kisiye-ozel-odev-sonuc', [{ name: 'Sonuç', widths: [12, 26, 12, 50, 12, 12, 14, 14], rows: [
    ['Öğrenci no', 'Ad soyad', 'Sınıf', 'Konular', 'Tamamlanan', 'Yüzde', 'Teslim tarihi', 'Bitirdi'],
    ...b.students.map(s => { const n = s.items.filter(i => i.done).length; return [s.studentNo, s.name, s.className ?? '', s.items.map(i => i.topic + (i.target ? ` (${i.target})` : '')).join('; '), n, s.items.length ? Math.round(n / s.items.length * 100) : 0, s.dueDate ?? '', s.submittedAt ? 'Evet' : '']; }),
  ] }]);
}));

/* ---------- Personel: tek ödev ---------- */
async function classStudents(h) {
  if (h.UserId) return query(`SELECT Id, Username, FullName, StudentNo FROM dbo.Users WHERE Id=@u`, { u: h.UserId });
  return query(`SELECT Id, Username, FullName, StudentNo FROM dbo.Users WHERE ClassId=@c AND Role='student' AND IsDisabled=0 ORDER BY FullName, Username`, { c: h.ClassId });
}

r.get('/homework/:id', ...requireStaff, validate(idParam, 'params'), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);
  if (!h) return res.status(404).json({ error: 'Bulunamadı' });
  const items = await itemsOf(h.Id);
  const students = await classStudents(h);
  const done = items.length ? await query(`SELECT d.ItemId, d.UserId FROM dbo.HomeworkDone d JOIN dbo.HomeworkItems i ON i.Id=d.ItemId WHERE i.HomeworkId=@h`, { h: h.Id }) : [];
  const subs = await query(`SELECT UserId, SubmittedAt FROM dbo.HomeworkSubmissions WHERE HomeworkId=@h`, { h: h.Id });
  const dues = await query(`SELECT UserId, CONVERT(char(10), DueDate, 23) AS DueDate FROM dbo.HomeworkDue WHERE HomeworkId=@h`, { h: h.Id });
  const reqs = await query(`SELECT DISTINCT t.UserId FROM dbo.HomeworkThread t WHERE t.HomeworkId=@h AND ${openReq('t.HomeworkId', 't.UserId')}`, { h: h.Id });
  const set = new Set(done.map(x => `${x.ItemId}:${x.UserId}`)), subBy = new Map(subs.map(s => [s.UserId, s.SubmittedAt])), dueBy = new Map(dues.map(x => [x.UserId, x.DueDate])), reqSet = new Set(reqs.map(x => x.UserId));
  res.json({ ...dto(h), items: items.map(i => ({ id: i.Id, topic: i.Topic, target: i.Target })),
    students: students.map(s => ({ id: s.Id, name: s.FullName || s.Username, studentNo: s.StudentNo ?? '', done: items.map(i => set.has(`${i.Id}:${s.Id}`)),
      submittedAt: subBy.get(s.Id) ?? null, dueDate: dueBy.get(s.Id) ?? h.DueDate ?? null, requestOpen: reqSet.has(s.Id) })) });
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

// Personelin Excel raporu: öğrenci × madde (✓), tamamlama yüzdesi, öğrencinin "bitirdim" onayı ve teslim tarihi
r.get('/homework/:id/results.xlsx', ...requireStaff, validate(idParam, 'params'), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);
  if (!h) return res.status(404).json({ error: 'Bulunamadı' });
  const items = await itemsOf(h.Id);
  const students = await classStudents(h);
  const done = items.length ? await query(`SELECT d.ItemId, d.UserId FROM dbo.HomeworkDone d JOIN dbo.HomeworkItems i ON i.Id=d.ItemId WHERE i.HomeworkId=@h`, { h: h.Id }) : [];
  const subs = new Set((await query(`SELECT UserId FROM dbo.HomeworkSubmissions WHERE HomeworkId=@h`, { h: h.Id })).map(x => x.UserId));
  const dues = new Map((await query(`SELECT UserId, CONVERT(char(10), DueDate, 23) AS DueDate FROM dbo.HomeworkDue WHERE HomeworkId=@h`, { h: h.Id })).map(x => [x.UserId, x.DueDate]));
  const set = new Set(done.map(x => `${x.ItemId}:${x.UserId}`));
  sendXlsx(res, `odev-sonuc-${h.Id}`, [{ name: 'Sonuç', widths: [12, 26, ...items.map(() => 18), 12, 10, 14, 14], rows: [
    ['Öğrenci no', 'Ad soyad', ...items.map(i => i.Topic + (i.Target ? ` (${i.Target})` : '')), 'Tamamlanan', 'Yüzde', 'Bitirdi', 'Teslim tarihi'],
    ...students.map(s => { const n = items.filter(i => set.has(`${i.Id}:${s.Id}`)).length; return [s.StudentNo ?? '', s.FullName || s.Username, ...items.map(i => (set.has(`${i.Id}:${s.Id}`) ? 'Evet' : '')), n, items.length ? Math.round(n / items.length * 100) : 0, subs.has(s.Id) ? 'Evet' : '', dues.get(s.Id) ?? h.DueDate ?? '']; }),
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

/* ---------- Teslim tarihi görüşmesi (personel tarafı) ---------- */
r.get('/homework/:id/thread/:userId', ...requireStaff, validate(threadParam, 'params'), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);
  const u = h && await targetStudent(req, h, req.params.userId);
  if (!u) return res.status(404).json({ error: 'Bulunamadı' });
  const [due] = await query(`SELECT CONVERT(char(10), DueDate, 23) AS DueDate FROM dbo.HomeworkDue WHERE HomeworkId=@h AND UserId=@u`, { h: h.Id, u: u.Id });
  const thread = await threadOf(h.Id, u.Id);
  res.json({ student: { id: u.Id, name: u.FullName || u.Username }, title: h.Title, originalDue: h.DueDate ?? null, dueDate: due?.DueDate ?? h.DueDate ?? null, thread: thread.map(tdto) });
}));

const staffThreadSchema = z.object({
  action: z.enum(['msg', 'accept', 'reject', 'set']),
  body: z.string().trim().max(500).optional().default(''),
  dueDate: isoDate.nullish(),
}).strict();

r.post('/homework/:id/thread/:userId', ...requireStaff, validate(threadParam, 'params'), validate(staffThreadSchema), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);
  const u = h && await targetStudent(req, h, req.params.userId);
  if (!u) return res.status(404).json({ error: 'Bulunamadı' });
  const { action, body, dueDate } = req.body;
  const thread = await threadOf(h.Id, u.Id);
  if (thread.length >= MAX_THREAD) return res.status(429).json({ error: 'Bu ödev için yazışma sınırına ulaşıldı' });
  const open = [...thread].reverse().find(t => t.Kind === 'request' || ['accept', 'reject', 'set'].includes(t.Kind));
  const pending = open?.Kind === 'request' ? open : null;
  let newDue = null;
  if (action === 'msg') { if (!body) return res.status(400).json({ error: 'Mesaj boş' }); }
  else if (action === 'set') { if (!dueDate) return res.status(400).json({ error: 'Yeni teslim tarihini seç' }); newDue = dueDate; }
  else { if (!pending) return res.status(409).json({ error: 'Yanıtlanacak bir tarih talebi yok' }); if (action === 'accept') newDue = pending.ProposedDue; }
  await tx(async q => {
    if (newDue) await q(`MERGE dbo.HomeworkDue AS t USING (SELECT @h AS HomeworkId, @u AS UserId) AS s ON t.HomeworkId=s.HomeworkId AND t.UserId=s.UserId
      WHEN MATCHED THEN UPDATE SET DueDate=CAST(@d AS date), SetAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT (HomeworkId, UserId, DueDate) VALUES (@h,@u,CAST(@d AS date));`, { h: h.Id, u: u.Id, d: newDue });
    await q(`INSERT INTO dbo.HomeworkThread (HomeworkId, UserId, AuthorId, AuthorRole, Kind, Body, ProposedDue) VALUES (@h,@u,@me,'staff',@k,@b,CAST(@d AS date))`,
      { h: h.Id, u: u.Id, me: req.userId, k: action, b: body || null, d: newDue });
  });
  res.status(201).json({ ok: true, dueDate: newDue ?? undefined });
}));

/* ---------- Öğrenci ---------- */
const needStudent = (req, res, next) => (req.role === 'student' && req.institutionId ? next() : res.status(404).json({ error: 'Bulunamadı' }));

// Öğrencinin tüm ödevleri (sınıf + kişisel), kendi teslim tarihi ve yazışmasıyla
async function studentHomework(req) {
  const hws = await query(`SELECT TOP 80 h.Id, h.ClassId, h.UserId, h.Title, h.Note, CONVERT(char(10), h.DueDate, 23) AS DueDate, CONVERT(char(10), du.DueDate, 23) AS MyDue, h.FileName, h.CreatedAt,
      c.Name AS ClassName, s.SubmittedAt
    FROM dbo.Homework h LEFT JOIN dbo.Classes c ON c.Id=h.ClassId
      LEFT JOIN dbo.HomeworkDue du ON du.HomeworkId=h.Id AND du.UserId=@me LEFT JOIN dbo.HomeworkSubmissions s ON s.HomeworkId=h.Id AND s.UserId=@me
    WHERE h.InstitutionId=@inst AND ((h.ClassId IS NOT NULL AND h.ClassId=@cls) OR h.UserId=@me) ORDER BY h.CreatedAt DESC`, { inst: req.institutionId, cls: req.classId ?? 0, me: req.userId });
  const ids = hws.map(h => h.Id);   // ids: veritabanından gelen tam sayılar
  const items = ids.length ? await query(`SELECT Id, HomeworkId, Pos, Topic, Target FROM dbo.HomeworkItems WHERE HomeworkId IN (${ids.join(',')}) ORDER BY HomeworkId, Pos`) : [];
  const done = ids.length ? await query(`SELECT ItemId FROM dbo.HomeworkDone WHERE UserId=@me`, { me: req.userId }) : [];
  const threads = ids.length ? await query(`${THREAD_SQL} WHERE t.UserId=@me AND t.HomeworkId IN (${ids.join(',')}) ORDER BY t.Id`, { me: req.userId }) : [];
  const mine = new Set(done.map(d => d.ItemId)), today = todayTR();
  return hws.map(h => {
    const th = threads.filter(t => t.HomeworkId === h.Id), due = h.MyDue ?? h.DueDate ?? null;
    const last = [...th].reverse().find(t => t.Kind === 'request' || ['accept', 'reject', 'set'].includes(t.Kind));
    return { id: h.Id, kind: h.UserId ? 'personal' : 'class', className: h.ClassName ?? null, title: h.Title, note: h.Note ?? '', dueDate: due, originalDue: h.DueDate ?? null, fileName: h.FileName ?? null, createdAt: h.CreatedAt,
      submittedAt: h.SubmittedAt ?? null, status: hwStatus({ submitted: !!h.SubmittedAt, due }, today), requestOpen: last?.Kind === 'request',
      items: items.filter(i => i.HomeworkId === h.Id).map(i => ({ id: i.Id, topic: i.Topic, target: i.Target, done: mine.has(i.Id) })), thread: th.map(tdto) };
  });
}

r.get('/my', requireAuth, needStudent, wrap(async (req, res) => {
  const homework = await studentHomework(req);
  const open = homework.filter(h => h.status !== 'done');
  const next = open.map(h => h.dueDate).filter(Boolean).sort()[0] ?? null;
  res.json({ homework, summary: { total: homework.length, open: open.length, late: homework.filter(h => h.status === 'late').length, submitted: homework.length - open.length,
    items: homework.reduce((n, h) => n + h.items.length, 0), itemsDone: homework.reduce((n, h) => n + h.items.filter(i => i.done).length, 0), nextDue: next } });
}));

// Rozet için hafif sayım
r.get('/my/summary', requireAuth, needStudent, wrap(async (req, res) => {
  const [x] = await query(`SELECT COUNT(*) AS OpenN, SUM(CASE WHEN COALESCE(du.DueDate, h.DueDate) < CAST(@today AS date) THEN 1 ELSE 0 END) AS LateN
    FROM dbo.Homework h LEFT JOIN dbo.HomeworkDue du ON du.HomeworkId=h.Id AND du.UserId=@me
    WHERE h.InstitutionId=@inst AND ((h.ClassId IS NOT NULL AND h.ClassId=@cls) OR h.UserId=@me)
      AND NOT EXISTS (SELECT 1 FROM dbo.HomeworkSubmissions s WHERE s.HomeworkId=h.Id AND s.UserId=@me)`, { inst: req.institutionId, cls: req.classId ?? 0, me: req.userId, today: todayTR() });
  res.json({ open: x.OpenN ?? 0, late: x.LateN ?? 0 });
}));

r.put('/my/:id/items/:itemId', requireAuth, needStudent, validate(itemParam, 'params'), validate(z.object({ done: z.boolean() }).strict()), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);                       // kapsam: başka sınıfın / başka öğrencinin ödevi 404
  if (!h) return res.status(404).json({ error: 'Bulunamadı' });
  const [it] = await query(`SELECT Id FROM dbo.HomeworkItems WHERE Id=@i AND HomeworkId=@h`, { i: req.params.itemId, h: h.Id });
  if (!it) return res.status(404).json({ error: 'Bulunamadı' });
  if (req.body.done) await query(`IF NOT EXISTS (SELECT 1 FROM dbo.HomeworkDone WHERE ItemId=@i AND UserId=@u) INSERT INTO dbo.HomeworkDone (ItemId, UserId) VALUES (@i,@u)`, { i: it.Id, u: req.userId });
  else {
    await query(`DELETE FROM dbo.HomeworkDone WHERE ItemId=@i AND UserId=@u`, { i: it.Id, u: req.userId });
    await query(`DELETE FROM dbo.HomeworkSubmissions WHERE HomeworkId=@h AND UserId=@u`, { h: h.Id, u: req.userId });   // madde geri alınınca "bitirdim" onayı da düşer
  }
  res.json({ ok: true, done: req.body.done });
}));

// "Ödevi bitirdim": tüm maddeleri tamamlandı sayar ve onay kaydeder. { done:false } onayı geri alır.
r.post('/my/:id/submit', requireAuth, needStudent, validate(idParam, 'params'), validate(z.object({ done: z.boolean() }).strict()), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);
  if (!h) return res.status(404).json({ error: 'Bulunamadı' });
  if (req.body.done) {
    await tx(async q => {
      await q(`INSERT INTO dbo.HomeworkDone (ItemId, UserId) SELECT i.Id, @u FROM dbo.HomeworkItems i WHERE i.HomeworkId=@h AND NOT EXISTS (SELECT 1 FROM dbo.HomeworkDone d WHERE d.ItemId=i.Id AND d.UserId=@u)`, { h: h.Id, u: req.userId });
      await q(`IF NOT EXISTS (SELECT 1 FROM dbo.HomeworkSubmissions WHERE HomeworkId=@h AND UserId=@u) INSERT INTO dbo.HomeworkSubmissions (HomeworkId, UserId) VALUES (@h,@u)`, { h: h.Id, u: req.userId });
    });
  } else await query(`DELETE FROM dbo.HomeworkSubmissions WHERE HomeworkId=@h AND UserId=@u`, { h: h.Id, u: req.userId });
  res.json({ ok: true, done: req.body.done });
}));

// Öğrenci → öğretmen: not ya da yeni teslim tarihi talebi
const studentThreadSchema = z.object({ body: z.string().trim().max(500).optional().default(''), proposedDue: isoDate.nullish() }).strict();
r.post('/my/:id/thread', requireAuth, needStudent, validate(idParam, 'params'), validate(studentThreadSchema), wrap(async (req, res) => {
  const h = await loadHw(req, req.params.id);
  if (!h) return res.status(404).json({ error: 'Bulunamadı' });
  const { body, proposedDue } = req.body;
  if (!body && !proposedDue) return res.status(400).json({ error: 'Bir mesaj yaz ya da yeni bir tarih seç' });
  if (proposedDue) {
    const today = todayTR(), max = new Date(Date.parse(today) + 365 * 86400000).toISOString().slice(0, 10);
    if (proposedDue < today || proposedDue > max) return res.status(400).json({ error: 'Tarih bugünden sonra ve bir yıl içinde olmalı' });
  }
  const thread = await threadOf(h.Id, req.userId);
  if (thread.length >= MAX_THREAD) return res.status(429).json({ error: 'Bu ödev için yazışma sınırına ulaşıldı' });
  if (proposedDue) {
    const last = [...thread].reverse().find(t => t.Kind === 'request' || ['accept', 'reject', 'set'].includes(t.Kind));
    if (last?.Kind === 'request') return res.status(409).json({ error: 'Bekleyen bir tarih talebin var; öğretmenin yanıtını bekle' });
  }
  await query(`INSERT INTO dbo.HomeworkThread (HomeworkId, UserId, AuthorId, AuthorRole, Kind, Body, ProposedDue) VALUES (@h,@u,@u,'student',@k,@b,CAST(@d AS date))`,
    { h: h.Id, u: req.userId, k: proposedDue ? 'request' : 'msg', b: body || null, d: proposedDue ?? null });
  res.status(201).json({ ok: true });
}));

export default r;
