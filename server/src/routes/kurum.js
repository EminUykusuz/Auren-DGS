// Kurum (dershane) paneli API'si. Her sorgu InstitutionId ile süzülür (anti-IDOR): başka kurumun kaydı 404 döner.
import { Router } from 'express';
import express from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { query, tx } from '../db.js';
import { requireStaff, requireOwner, validate, wrap, assignedClassIds } from '../security.js';
import { sendXlsx } from '../xlsx.js';
import { asciiFold, makeUsername, genPassword, parseStudentText, canTransfer, suggestPlacement, netDrop, MAX_BULK } from '../kurum-lib.js';

const r = Router();
const idParam = z.object({ id: z.coerce.number().int().positive() });
const isDup = (e) => e?.number === 2627 || e?.number === 2601;
// Geçici şifre: ilk girişte zorunlu değiştirilir; yüzlerce öğrenciyi makul sürede oluşturmak için maliyet 10
const TEMP_ROUNDS = 10;
const hashTemp = (pw) => bcrypt.hash(pw, TEMP_ROUNDS);
async function hashAll(pws) { // 4'erli gruplar: olay döngüsünü uzun süre kilitlemez
  const out = [];
  for (let i = 0; i < pws.length; i += 4) out.push(...await Promise.all(pws.slice(i, i + 4).map(hashTemp)));
  return out;
}

// ---------- Herkese açık: marka ve logo ----------
r.get('/brand/:slug', wrap(async (req, res) => {
  const [i] = await query(`SELECT Name, Slug, PrimaryColor, LogoVersion FROM dbo.Institutions WHERE Slug=@s AND IsActive=1`, { s: String(req.params.slug).toLowerCase().slice(0, 40) });
  if (!i) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ name: i.Name, slug: i.Slug, color: i.PrimaryColor ?? null, logoVersion: i.LogoVersion, hasLogo: i.LogoVersion > 0 });
}));

r.get('/logo/:slug', wrap(async (req, res) => {
  const [i] = await query(`SELECT LogoData, LogoType FROM dbo.Institutions WHERE Slug=@s AND IsActive=1 AND LogoData IS NOT NULL`, { s: String(req.params.slug).toLowerCase().slice(0, 40) });
  if (!i) return res.status(404).end();
  // İçerik sürümlü adresle (?v=) istendiği için uzun süre önbelleğe alınabilir
  res.set({ 'Content-Type': i.LogoType, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' }).send(Buffer.from(i.LogoData));
}));

// ---------- Logo ve renk (yalnızca yönetici) ----------
const MAGIC = {
  'image/png': (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
};
r.put('/logo', ...requireOwner, express.raw({ type: Object.keys(MAGIC), limit: 300 * 1024 }), wrap(async (req, res) => {
  const type = String(req.headers['content-type'] ?? '').split(';')[0].trim();
  if (!Buffer.isBuffer(req.body) || !req.body.length || !MAGIC[type]?.(req.body)) return res.status(400).json({ error: 'Logo png, jpeg veya webp olmalı (en çok 300 KB)' });
  const [row] = await query(`UPDATE dbo.Institutions SET LogoData=@d, LogoType=@t, LogoVersion=LogoVersion+1 OUTPUT INSERTED.LogoVersion WHERE Id=@i`,
    { d: req.body, t: type, i: req.institutionId });
  res.json({ ok: true, logoVersion: row.LogoVersion });
}));
r.delete('/logo', ...requireOwner, wrap(async (req, res) => {
  await query(`UPDATE dbo.Institutions SET LogoData=NULL, LogoType=NULL, LogoVersion=0 WHERE Id=@i`, { i: req.institutionId });
  res.json({ ok: true });
}));
r.put('/branding', ...requireOwner, validate(z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable() }).strict()), wrap(async (req, res) => {
  await query(`UPDATE dbo.Institutions SET PrimaryColor=@c WHERE Id=@i`, { c: req.body.color, i: req.institutionId });
  res.json({ ok: true });
}));

// ---------- Yardımcılar: erişim kapsamı ----------
// Personelin görebileceği öğrenci/sınıf kümesi: yönetici → kurumun tamamı, öğretmen → atandığı sınıflar
const scopeSql = (req, a = 'u') => req.role === 'owner'
  ? `${a}.InstitutionId=@inst`
  : `${a}.InstitutionId=@inst AND ${a}.ClassId IN (SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me)`;
const scopeParams = (req) => ({ inst: req.institutionId, me: req.userId });
const classIsMine = async (req, classId) => {
  const [c] = await query(`SELECT Id FROM dbo.Classes WHERE Id=@c AND InstitutionId=@inst ${req.role === 'owner' ? '' : 'AND Id IN (SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me)'}`,
    { c: classId, ...scopeParams(req) });
  return !!c;
};
async function getStudent(req, id) {
  const [s] = await query(`SELECT u.Id, u.Username, u.FullName, u.ClassId, u.StudentNo, u.IsDisabled FROM dbo.Users u WHERE u.Id=@id AND u.Role='student' AND ${scopeSql(req)}`, { id, ...scopeParams(req) });
  return s;
}

// ---------- Sınıflar ----------
r.get('/classes', ...requireStaff, wrap(async (req, res) => {
  const rows = await query(`SELECT c.Id, c.Name, c.IsArchived,
      (SELECT COUNT(*) FROM dbo.Users s WHERE s.ClassId=c.Id AND s.Role='student') AS StudentCount
    FROM dbo.Classes c WHERE c.InstitutionId=@inst
      ${req.role === 'owner' ? '' : 'AND c.Id IN (SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me)'}
    ORDER BY c.IsArchived, c.Name`, scopeParams(req));
  res.json({ classes: rows.map(c => ({ id: c.Id, name: c.Name, isArchived: !!c.IsArchived, studentCount: c.StudentCount })) });
}));

const className = z.string().trim().min(1).max(40);
r.post('/classes', ...requireOwner, validate(z.object({ name: className }).strict()), wrap(async (req, res) => {
  try {
    const [c] = await query(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@inst,@n)`, { inst: req.institutionId, n: req.body.name });
    res.status(201).json({ id: c.Id, name: req.body.name });
  } catch (e) { if (isDup(e)) return res.status(409).json({ error: 'Bu adla bir sınıf zaten var' }); throw e; }
}));
r.patch('/classes/:id', ...requireOwner, validate(idParam, 'params'), validate(z.object({ name: className.optional(), isArchived: z.boolean().optional() }).strict()), wrap(async (req, res) => {
  const { name, isArchived } = req.body;
  try {
    const out = await query(`UPDATE dbo.Classes SET Name=COALESCE(@n,Name), IsArchived=COALESCE(@a,IsArchived) OUTPUT INSERTED.Id WHERE Id=@id AND InstitutionId=@inst`,
      { n: name ?? null, a: isArchived == null ? null : (isArchived ? 1 : 0), id: req.params.id, inst: req.institutionId });
    if (!out.length) return res.status(404).json({ error: 'Bulunamadı' });
    res.json({ ok: true });
  } catch (e) { if (isDup(e)) return res.status(409).json({ error: 'Bu adla bir sınıf zaten var' }); throw e; }
}));

// ---------- Öğrenci oluşturma (tek ve toplu ortak) ----------
const rowSchema = z.object({
  firstName: z.string().trim().min(1).max(40), lastName: z.string().trim().min(1).max(40),
  studentNo: z.string().trim().regex(/^[\p{L}\p{N}_.-]{1,20}$/u).nullish(), className: z.string().trim().max(40).nullish(),
  line: z.number().int().optional(),
});

async function classMap(req) {
  const rows = await query(`SELECT Id, Name, IsArchived FROM dbo.Classes WHERE InstitutionId=@inst ${req.role === 'owner' ? '' : 'AND Id IN (SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me)'}`, scopeParams(req));
  return new Map(rows.map(c => [asciiFold(c.Name), c]));
}

// rows → { plan: [{...row, classId}], errors: [{line, message}], newClasses: [name] } — yazmadan önce doğrulama (önizleme de bunu kullanır)
async function planStudents(req, rows, { defaultClassId = null } = {}) {
  const classes = await classMap(req);
  const errors = [], plan = [], newClasses = new Map();
  const nos = rows.map(x => x.studentNo).filter(Boolean);
  const used = nos.length ? new Set((await query(`SELECT StudentNo FROM dbo.Users WHERE InstitutionId=@inst AND StudentNo IN (${nos.map((_, i) => '@n' + i).join(',')})`,
    { inst: req.institutionId, ...Object.fromEntries(nos.map((n, i) => ['n' + i, n])) })).map(x => x.StudentNo)) : new Set();
  let def = null;
  if (defaultClassId != null) {
    const [dc] = await query(`SELECT Id, IsArchived FROM dbo.Classes WHERE Id=@c AND InstitutionId=@inst ${req.role === 'owner' ? '' : 'AND Id IN (SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me)'}`, { c: defaultClassId, ...scopeParams(req) });
    if (!dc) throw Object.assign(new Error('Sınıf bulunamadı'), { status: 404 });
    if (dc.IsArchived) throw Object.assign(new Error('Arşivlenmiş sınıfa öğrenci eklenemez'), { status: 400 });
    def = defaultClassId;
  }
  rows.forEach((row, i) => {
    const line = row.line ?? i + 1;
    if (row.studentNo && used.has(row.studentNo)) return errors.push({ line, message: `Numara ${row.studentNo} kurumda zaten kayıtlı` });
    let classId = def;
    if (row.className) {
      const c = classes.get(asciiFold(row.className));
      if (c) { if (c.IsArchived) return errors.push({ line, message: `"${c.Name}" sınıfı arşivlenmiş` }); classId = c.Id; }
      else if (req.role === 'owner') { newClasses.set(asciiFold(row.className), row.className); classId = `new:${asciiFold(row.className)}`; }
      else return errors.push({ line, message: `"${row.className}" sınıfına erişiminiz yok` });
    }
    if (classId == null && req.role !== 'owner') return errors.push({ line, message: 'Sınıf seçilmedi' });
    plan.push({ ...row, line, classId });
  });
  return { plan, errors, newClasses: [...newClasses.values()] };
}

async function createStudents(req, rows, opts) {
  const { plan, errors, newClasses } = await planStudents(req, rows, opts);
  if (!plan.length) return { created: [], errors, newClasses };
  // Kurum öğrenci kotası
  const [lim] = await query(`SELECT i.StudentLimit, i.ExamTrack, (SELECT COUNT(*) FROM dbo.Users s WHERE s.InstitutionId=i.Id AND s.Role='student') AS Cnt FROM dbo.Institutions i WHERE i.Id=@inst`, { inst: req.institutionId });
  if (lim.StudentLimit != null && lim.Cnt + plan.length > lim.StudentLimit)
    throw Object.assign(new Error(`Öğrenci kotası aşılıyor (kota ${lim.StudentLimit}, mevcut ${lim.Cnt}, eklenecek ${plan.length})`), { status: 409 });
  // Kullanıcı adları: aday tabanlarla başlayan mevcut adlar tek sorguda okunur
  const folded = (x) => [asciiFold(x.firstName), asciiFold(x.lastName)].filter(Boolean).join('.').slice(0, 26);
  const bases = [...new Set(plan.map(folded))].filter(Boolean);
  const taken = new Set();
  for (let i = 0; i < bases.length; i += 200) {
    const part = bases.slice(i, i + 200);
    (await query(`SELECT Username FROM dbo.Users WHERE ${part.map((_, k) => `Username LIKE @lk${k}`).join(' OR ')}`, Object.fromEntries(part.map((b, k) => ['lk' + k, b + '%']))))
      .forEach(x => taken.add(x.Username.toLowerCase()));
  }
  const passwords = plan.map(() => genPassword());
  const hashes = await hashAll(passwords);
  const track = lim.ExamTrack, mode = track === 'BOTH' ? 'DGS' : track;
  const created = await tx(async q => {
    const ids = new Map();   // yeni sınıflar (yalnızca yönetici)
    for (const name of newClasses) {
      const [c] = await q(`INSERT INTO dbo.Classes (InstitutionId, Name) OUTPUT INSERTED.Id VALUES (@inst,@n)`, { inst: req.institutionId, n: name });
      ids.set(asciiFold(name), c.Id);
    }
    const out = [];
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      const username = makeUsername(p.firstName, p.lastName, taken);
      const classId = typeof p.classId === 'string' ? ids.get(p.classId.slice(4)) : p.classId;
      const full = `${p.firstName} ${p.lastName}`.slice(0, 80);
      const [u] = await q(`INSERT INTO dbo.Users (Username, Email, PasswordHash, FullName, InstitutionId, Role, ClassId, StudentNo, MustChangePassword, ExamMode, ExamTrack)
        OUTPUT INSERTED.Id VALUES (@u,@e,@h,@f,@inst,'student',@c,@no,1,@m,@t)`,
        { u: username, e: `${username}@ogrenci.invalid`, h: hashes[i], f: full, inst: req.institutionId, c: classId ?? null, no: p.studentNo ?? null, m: mode, t: track });
      out.push({ id: u.Id, username, fullName: full, studentNo: p.studentNo ?? null, classId: classId ?? null, password: passwords[i], line: p.line });
    }
    return out;
  }).catch(e => { if (isDup(e)) throw Object.assign(new Error('Çakışma oluştu (kullanıcı adı veya numara), lütfen tekrar deneyin'), { status: 409 }); throw e; });
  // Çıktı için sınıf adları
  const names = new Map((await query(`SELECT Id, Name FROM dbo.Classes WHERE InstitutionId=@inst`, { inst: req.institutionId })).map(c => [c.Id, c.Name]));
  return { created: created.map(c => ({ ...c, className: names.get(c.classId) ?? null })), errors, newClasses };
}

const onErr = (res, e) => e?.status ? res.status(e.status).json({ error: e.message }) : null;

// Excel'den yapıştırılan / CSV metni → ayrıştır + doğrula (veri yazılmaz)
r.post('/students/preview', ...requireStaff, validate(z.object({ text: z.string().max(200_000), defaultClassId: z.number().int().positive().nullish() }).strict()), wrap(async (req, res) => {
  const parsed = parseStudentText(req.body.text);
  try {
    const { plan, errors, newClasses } = await planStudents(req, parsed.rows, { defaultClassId: req.body.defaultClassId ?? null });
    res.json({ rows: plan.map(p => ({ line: p.line, firstName: p.firstName, lastName: p.lastName, studentNo: p.studentNo, className: p.className })),
      errors: [...parsed.errors, ...errors].sort((a, b) => a.line - b.line), newClasses, max: MAX_BULK });
  } catch (e) { if (!onErr(res, e)) throw e; }
}));

r.post('/students/bulk', ...requireStaff, validate(z.object({
  rows: z.array(rowSchema).min(1).max(MAX_BULK), defaultClassId: z.number().int().positive().nullish(),
}).strict()), wrap(async (req, res) => {
  try {
    const out = await createStudents(req, req.body.rows, { defaultClassId: req.body.defaultClassId ?? null });
    res.status(out.created.length ? 201 : 200).json(out);
  } catch (e) { if (!onErr(res, e)) throw e; }
}));

r.post('/students', ...requireStaff, validate(rowSchema.omit({ line: true }).extend({ classId: z.number().int().positive().nullish() }).strict()), wrap(async (req, res) => {
  const { classId, ...row } = req.body;
  try {
    const out = await createStudents(req, [{ ...row, className: null }], { defaultClassId: classId ?? null });
    if (!out.created.length) return res.status(400).json({ error: out.errors[0]?.message ?? 'Öğrenci eklenemedi' });
    res.status(201).json(out.created[0]);
  } catch (e) { if (!onErr(res, e)) throw e; }
}));

// ---------- Öğrenci listesi / düzenleme / şifre ----------
r.get('/students', ...requireStaff, validate(z.object({ classId: z.coerce.number().int().positive().optional(), unassigned: z.enum(['1']).optional(), q: z.string().trim().max(60).optional() }), 'query'), wrap(async (req, res) => {
  const { classId, unassigned, q } = req.query;
  const rows = await query(`SELECT TOP 2000 u.Id, u.Username, u.FullName, u.StudentNo, u.ClassId, c.Name AS ClassName, u.IsDisabled, u.MustChangePassword, u.LastLoginAt,
      (SELECT AVG(CAST(t.TotalNet AS float)) FROM (SELECT TOP 3 TotalNet FROM dbo.TrialExams WHERE UserId=u.Id ORDER BY ExamDate DESC, Id DESC) t) AS Avg3,
      (SELECT COUNT(*) FROM dbo.Homework h WHERE h.InstitutionId=u.InstitutionId AND ((h.ClassId IS NOT NULL AND h.ClassId=u.ClassId) OR h.UserId=u.Id)
         AND NOT EXISTS (SELECT 1 FROM dbo.HomeworkSubmissions s WHERE s.HomeworkId=h.Id AND s.UserId=u.Id)) AS OpenHw,
      (SELECT COUNT(*) FROM dbo.Homework h LEFT JOIN dbo.HomeworkDue du ON du.HomeworkId=h.Id AND du.UserId=u.Id WHERE h.InstitutionId=u.InstitutionId AND ((h.ClassId IS NOT NULL AND h.ClassId=u.ClassId) OR h.UserId=u.Id)
         AND COALESCE(du.DueDate, h.DueDate) < CAST(@today AS date) AND NOT EXISTS (SELECT 1 FROM dbo.HomeworkSubmissions s WHERE s.HomeworkId=h.Id AND s.UserId=u.Id)) AS LateHw
    FROM dbo.Users u LEFT JOIN dbo.Classes c ON c.Id=u.ClassId
    WHERE u.Role='student' AND ${scopeSql(req)} ${classId ? 'AND u.ClassId=@cls' : ''} ${unassigned && req.role === 'owner' ? 'AND u.ClassId IS NULL' : ''}
      ${q ? `AND (u.FullName LIKE @like ESCAPE '\\' OR u.Username LIKE @like ESCAPE '\\' OR u.StudentNo LIKE @like ESCAPE '\\')` : ''}
    ORDER BY c.Name, u.FullName`,
    { ...scopeParams(req), today: new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10), ...(classId ? { cls: classId } : {}), ...(q ? { like: '%' + q.replace(/[%_\\[]/g, '\\$&') + '%' } : {}) });
  res.json({ students: rows.map(s => ({ id: s.Id, username: s.Username, fullName: s.FullName ?? '', studentNo: s.StudentNo, classId: s.ClassId, className: s.ClassName,
    isDisabled: !!s.IsDisabled, mustChangePassword: !!s.MustChangePassword, lastLoginAt: s.LastLoginAt,
    avgNet: s.Avg3 == null ? null : Math.round(s.Avg3 * 100) / 100, openHomework: s.OpenHw, lateHomework: s.LateHw })) });
}));

r.patch('/students/:id', ...requireStaff, validate(idParam, 'params'), validate(z.object({
  fullName: z.string().trim().min(3).max(80).optional(),
  studentNo: z.string().trim().regex(/^[\p{L}\p{N}_.-]{1,20}$/u).nullable().optional(), isDisabled: z.boolean().optional(),
}).strict()), wrap(async (req, res) => {
  const s = await getStudent(req, req.params.id);
  if (!s) return res.status(404).json({ error: 'Bulunamadı' });
  const d = req.body;
  const full = d.fullName ?? null;
  try {
    await query(`UPDATE dbo.Users SET FullName=COALESCE(@f,FullName), StudentNo=CASE WHEN @setNo=1 THEN @no ELSE StudentNo END, IsDisabled=COALESCE(@dis,IsDisabled) WHERE Id=@id AND InstitutionId=@inst`,
      { f: full, setNo: 'studentNo' in d ? 1 : 0, no: d.studentNo ?? null, dis: d.isDisabled == null ? null : (d.isDisabled ? 1 : 0), id: s.Id, inst: req.institutionId });
  } catch (e) { if (isDup(e)) return res.status(409).json({ error: 'Bu numara kurumda zaten kayıtlı' }); throw e; }
  res.json({ ok: true });
}));

// Şifre sıfırlama: yeni geçici şifre bir kez döner (tekli ya da liste için toplu → yazdırılabilir çıktı)
r.post('/students/reset-passwords', ...requireStaff, validate(z.object({ studentIds: z.array(z.number().int().positive()).min(1).max(MAX_BULK) }).strict()), wrap(async (req, res) => {
  const ids = [...new Set(req.body.studentIds)];
  const rows = await query(`SELECT u.Id, u.Username, u.FullName, u.StudentNo, c.Name AS ClassName FROM dbo.Users u LEFT JOIN dbo.Classes c ON c.Id=u.ClassId
    WHERE u.Role='student' AND ${scopeSql(req)} AND u.Id IN (${ids.map((_, i) => '@i' + i).join(',')})`,
    { ...scopeParams(req), ...Object.fromEntries(ids.map((x, i) => ['i' + i, x])) });
  if (rows.length !== ids.length) return res.status(404).json({ error: 'Bulunamadı' });   // tek bir yabancı kimlik tüm isteği reddeder
  const pws = rows.map(() => genPassword()), hs = await hashAll(pws);
  await tx(async q => { for (let i = 0; i < rows.length; i++) await q(`UPDATE dbo.Users SET PasswordHash=@h, MustChangePassword=1 WHERE Id=@id AND InstitutionId=@inst`, { h: hs[i], id: rows[i].Id, inst: req.institutionId }); });
  res.json({ credentials: rows.map((s, i) => ({ id: s.Id, username: s.Username, fullName: s.FullName ?? '', studentNo: s.StudentNo, className: s.ClassName, password: pws[i] })) });
}));

// ---------- Sınıf değiştirme ----------
// moves: [{ studentId, toClassId|null }]. Her öğrencinin mevcut ve hedef sınıfı için yetki gerekir; hepsi ya da hiçbiri.
r.post('/students/transfer', ...requireStaff, validate(z.object({
  moves: z.array(z.object({ studentId: z.number().int().positive(), toClassId: z.number().int().positive().nullable() }).strict()).min(1).max(MAX_BULK),
  reason: z.string().trim().max(200).optional(),
}).strict()), wrap(async (req, res) => {
  const moves = req.body.moves;
  const ids = [...new Set(moves.map(m => m.studentId))];
  if (ids.length !== moves.length) return res.status(400).json({ error: 'Bir öğrenci yalnızca bir kez taşınabilir' });
  const studs = await query(`SELECT u.Id, u.ClassId FROM dbo.Users u WHERE u.Role='student' AND u.InstitutionId=@inst AND u.Id IN (${ids.map((_, i) => '@i' + i).join(',')})`,
    { inst: req.institutionId, ...Object.fromEntries(ids.map((x, i) => ['i' + i, x])) });
  if (studs.length !== ids.length) return res.status(404).json({ error: 'Bulunamadı' });
  const toIds = [...new Set(moves.map(m => m.toClassId).filter(x => x != null))];
  if (toIds.length) {
    const ok = await query(`SELECT Id FROM dbo.Classes WHERE InstitutionId=@inst AND IsArchived=0 AND Id IN (${toIds.map((_, i) => '@c' + i).join(',')})`,
      { inst: req.institutionId, ...Object.fromEntries(toIds.map((x, i) => ['c' + i, x])) });
    if (ok.length !== toIds.length) return res.status(404).json({ error: 'Hedef sınıf bulunamadı' });
  }
  const mine = req.role === 'owner' ? [] : await assignedClassIds(req.userId);
  const from = new Map(studs.map(s => [s.Id, s.ClassId]));
  for (const m of moves) if (!canTransfer(req.role, mine, from.get(m.studentId), m.toClassId)) return res.status(404).json({ error: 'Bulunamadı' });
  const changed = moves.filter(m => (from.get(m.studentId) ?? null) !== m.toClassId);
  await tx(async q => {
    for (const m of changed) {
      await q(`UPDATE dbo.Users SET ClassId=@to WHERE Id=@id AND InstitutionId=@inst`, { to: m.toClassId, id: m.studentId, inst: req.institutionId });
      await q(`INSERT INTO dbo.ClassTransfers (InstitutionId, UserId, FromClassId, ToClassId, MovedBy, Reason) VALUES (@inst,@id,@f,@to,@by,@why)`,
        { inst: req.institutionId, id: m.studentId, f: from.get(m.studentId) ?? null, to: m.toClassId, by: req.userId, why: req.body.reason ?? null });
    }
  });
  res.json({ moved: changed.length, unchanged: moves.length - changed.length });
}));

// Taşıma geçmişi (öğretmen yalnızca kendi sınıflarını içeren kayıtları görür)
r.get('/transfers', ...requireStaff, wrap(async (req, res) => {
  const mineSql = req.role === 'owner' ? '' : `AND (t.FromClassId IN (SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me) OR t.ToClassId IN (SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me))`;
  const rows = await query(`SELECT TOP 300 t.Id, t.UserId, u.FullName, u.Username, cf.Name AS FromName, ct.Name AS ToName, t.Reason, t.MovedAt, m.FullName AS ByName, m.Username AS ByUser
    FROM dbo.ClassTransfers t JOIN dbo.Users u ON u.Id=t.UserId LEFT JOIN dbo.Classes cf ON cf.Id=t.FromClassId LEFT JOIN dbo.Classes ct ON ct.Id=t.ToClassId LEFT JOIN dbo.Users m ON m.Id=t.MovedBy
    WHERE t.InstitutionId=@inst ${mineSql} ORDER BY t.MovedAt DESC, t.Id DESC`, scopeParams(req));
  res.json({ transfers: rows.map(t => ({ id: t.Id, studentId: t.UserId, student: t.FullName || t.Username, from: t.FromName, to: t.ToName, reason: t.Reason, at: t.MovedAt, by: t.ByName || t.ByUser })) });
}));

// Sınıf değiştirme sınavı önerisi: öğrencileri son N denemenin ortalama netine göre sıralar, kademelere böler.
// Yalnızca öneri döner; uygulamak için /students/transfer çağrılır (öğretmen onaylar).
r.post('/placement/suggest', ...requireStaff, validate(z.object({
  studentIds: z.array(z.number().int().positive()).min(1).max(MAX_BULK), lastN: z.number().int().min(1).max(20).default(3),
  tiers: z.array(z.object({ classId: z.number().int().positive(), size: z.number().int().min(0).max(MAX_BULK).nullable() }).strict()).min(1).max(20),
}).strict()), wrap(async (req, res) => {
  const ids = [...new Set(req.body.studentIds)];
  const rows = await query(`SELECT u.Id, u.FullName, u.Username, u.ClassId,
      (SELECT AVG(CAST(t.TotalNet AS float)) FROM (SELECT TOP (@n) TotalNet FROM dbo.TrialExams WHERE UserId=u.Id ORDER BY ExamDate DESC, Id DESC) t) AS Score
    FROM dbo.Users u WHERE u.Role='student' AND ${scopeSql(req)} AND u.Id IN (${ids.map((_, i) => '@i' + i).join(',')})`,
    { ...scopeParams(req), n: req.body.lastN, ...Object.fromEntries(ids.map((x, i) => ['i' + i, x])) });
  if (rows.length !== ids.length) return res.status(404).json({ error: 'Bulunamadı' });
  const tierIds = [...new Set(req.body.tiers.map(t => t.classId))];
  const ok = await query(`SELECT Id FROM dbo.Classes WHERE InstitutionId=@inst AND IsArchived=0 AND Id IN (${tierIds.map((_, i) => '@c' + i).join(',')})`,
    { inst: req.institutionId, ...Object.fromEntries(tierIds.map((x, i) => ['c' + i, x])) });
  if (ok.length !== tierIds.length) return res.status(404).json({ error: 'Hedef sınıf bulunamadı' });
  const byId = new Map(rows.map(s => [s.Id, s]));
  const plan = suggestPlacement(rows.map(s => ({ id: s.Id, score: s.Score == null ? null : Math.round(s.Score * 100) / 100 })), req.body.tiers);
  res.json({ suggestions: plan.map(p => ({ studentId: p.studentId, name: byId.get(p.studentId).FullName || byId.get(p.studentId).Username, fromClassId: byId.get(p.studentId).ClassId, toClassId: p.toClassId, rank: p.rank, score: p.score })) });
}));

// ---------- Öğretmenler (yalnızca yönetici) ----------
r.get('/teachers', ...requireOwner, wrap(async (req, res) => {
  const rows = await query(`SELECT u.Id, u.Username, u.FullName, u.IsDisabled, u.LastLoginAt FROM dbo.Users u WHERE u.InstitutionId=@inst AND u.Role='teacher' ORDER BY u.FullName`, { inst: req.institutionId });
  const asg = await query(`SELECT tc.TeacherId, tc.ClassId FROM dbo.TeacherClasses tc JOIN dbo.Classes c ON c.Id=tc.ClassId WHERE c.InstitutionId=@inst`, { inst: req.institutionId });
  res.json({ teachers: rows.map(t => ({ id: t.Id, username: t.Username, fullName: t.FullName ?? '', isDisabled: !!t.IsDisabled, lastLoginAt: t.LastLoginAt, classIds: asg.filter(a => a.TeacherId === t.Id).map(a => a.ClassId) })) });
}));

async function setTeacherClasses(q, req, teacherId, classIds) {
  const ids = [...new Set(classIds)];
  if (ids.length) {
    const ok = await q(`SELECT Id FROM dbo.Classes WHERE InstitutionId=@inst AND Id IN (${ids.map((_, i) => '@c' + i).join(',')})`, { inst: req.institutionId, ...Object.fromEntries(ids.map((x, i) => ['c' + i, x])) });
    if (ok.length !== ids.length) throw Object.assign(new Error('Sınıf bulunamadı'), { status: 404 });
  }
  await q(`DELETE FROM dbo.TeacherClasses WHERE TeacherId=@t`, { t: teacherId });
  for (const c of ids) await q(`INSERT INTO dbo.TeacherClasses (TeacherId, ClassId) VALUES (@t,@c)`, { t: teacherId, c });
}

r.post('/teachers', ...requireOwner, validate(z.object({
  firstName: z.string().trim().min(1).max(40), lastName: z.string().trim().min(1).max(40), classIds: z.array(z.number().int().positive()).max(100).default([]),
}).strict()), wrap(async (req, res) => {
  const { firstName, lastName, classIds } = req.body;
  const [inst] = await query(`SELECT Slug, ExamTrack FROM dbo.Institutions WHERE Id=@i`, { i: req.institutionId });
  const prefix = asciiFold(inst.Slug).slice(0, 8);
  const taken = new Set((await query(`SELECT Username FROM dbo.Users WHERE Username LIKE @p`, { p: prefix + '.%' })).map(x => x.Username.toLowerCase()));
  const username = makeUsername(prefix, firstName + lastName, taken);   // örn. isik.aliyilmaz
  const pw = genPassword(10), h = await hashTemp(pw);
  try {
    const id = await tx(async q => {
      const [u] = await q(`INSERT INTO dbo.Users (Username, Email, PasswordHash, FullName, InstitutionId, Role, MustChangePassword, ExamMode, ExamTrack)
        OUTPUT INSERTED.Id VALUES (@u,@e,@h,@f,@inst,'teacher',1,'DGS',@t)`,
        { u: username, e: `${username}@ogrenci.invalid`, h, f: `${firstName} ${lastName}`.slice(0, 80), inst: req.institutionId, t: inst.ExamTrack });
      await setTeacherClasses(q, req, u.Id, classIds);
      return u.Id;
    });
    res.status(201).json({ id, username, fullName: `${firstName} ${lastName}`, password: pw });
  } catch (e) { if (e?.status) return res.status(e.status).json({ error: e.message }); if (isDup(e)) return res.status(409).json({ error: 'Çakışma, tekrar deneyin' }); throw e; }
}));

async function getTeacher(req, id) {
  const [t] = await query(`SELECT Id FROM dbo.Users WHERE Id=@id AND InstitutionId=@inst AND Role='teacher'`, { id, inst: req.institutionId });
  return t;
}
r.put('/teachers/:id/classes', ...requireOwner, validate(idParam, 'params'), validate(z.object({ classIds: z.array(z.number().int().positive()).max(100) }).strict()), wrap(async (req, res) => {
  if (!(await getTeacher(req, req.params.id))) return res.status(404).json({ error: 'Bulunamadı' });
  try { await tx(q => setTeacherClasses(q, req, req.params.id, req.body.classIds)); }
  catch (e) { if (e?.status) return res.status(e.status).json({ error: e.message }); throw e; }
  res.json({ ok: true });
}));
r.patch('/teachers/:id', ...requireOwner, validate(idParam, 'params'), validate(z.object({ isDisabled: z.boolean() }).strict()), wrap(async (req, res) => {
  if (!(await getTeacher(req, req.params.id))) return res.status(404).json({ error: 'Bulunamadı' });
  await query(`UPDATE dbo.Users SET IsDisabled=@d WHERE Id=@id AND InstitutionId=@inst`, { d: req.body.isDisabled ? 1 : 0, id: req.params.id, inst: req.institutionId });
  res.json({ ok: true });
}));
r.post('/teachers/:id/reset-password', ...requireOwner, validate(idParam, 'params'), wrap(async (req, res) => {
  if (!(await getTeacher(req, req.params.id))) return res.status(404).json({ error: 'Bulunamadı' });
  const pw = genPassword(10);
  await query(`UPDATE dbo.Users SET PasswordHash=@h, MustChangePassword=1 WHERE Id=@id AND InstitutionId=@inst`, { h: await hashTemp(pw), id: req.params.id, inst: req.institutionId });
  res.json({ password: pw });
}));

// ---------- Özet ----------
r.get('/overview', ...requireStaff, wrap(async (req, res) => {
  const [o] = await query(`SELECT
    (SELECT COUNT(*) FROM dbo.Users u WHERE u.Role='student' AND ${scopeSql(req)}) AS Students,
    (SELECT COUNT(*) FROM dbo.Users u WHERE u.Role='student' AND ${scopeSql(req)} AND u.LastLoginAt >= DATEADD(day,-7,SYSUTCDATETIME())) AS ActiveWeek,
    (SELECT COUNT(*) FROM dbo.Users u WHERE u.Role='student' AND ${scopeSql(req)} AND u.MustChangePassword=1) AS NeverLoggedIn,
    (SELECT COUNT(*) FROM dbo.Classes c WHERE c.InstitutionId=@inst AND c.IsArchived=0 ${req.role === 'owner' ? '' : 'AND c.Id IN (SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me)'}) AS Classes,
    (SELECT StudentLimit FROM dbo.Institutions WHERE Id=@inst) AS StudentLimit`, scopeParams(req));
  res.json({ students: o.Students, activeWeek: o.ActiveWeek, pendingFirstLogin: o.NeverLoggedIn, classes: o.Classes, studentLimit: o.StudentLimit });
}));

// Dikkat gerektiren öğrenciler: 7+ gündür girmeyen, neti düşen, ödevi geciken (kapsam: yönetici → kurum, öğretmen → sınıfları)
r.get('/alerts', ...requireStaff, wrap(async (req, res) => {
  const p = { ...scopeParams(req), today: new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10) };
  const inactive = await query(`SELECT TOP 50 u.Id, COALESCE(u.FullName, u.Username) AS Name, c.Name AS ClassName, DATEDIFF(day, u.LastLoginAt, SYSUTCDATETIME()) AS Days
    FROM dbo.Users u LEFT JOIN dbo.Classes c ON c.Id=u.ClassId WHERE u.Role='student' AND u.IsDisabled=0 AND u.MustChangePassword=0 AND ${scopeSql(req)}
      AND (u.LastLoginAt IS NULL OR u.LastLoginAt < DATEADD(day,-7,SYSUTCDATETIME())) ORDER BY u.LastLoginAt`, p);
  const late = await query(`SELECT TOP 50 u.Id, COALESCE(u.FullName, u.Username) AS Name, c.Name AS ClassName, x.N
    FROM (SELECT u2.Id AS UserId, COUNT(*) AS N FROM dbo.Users u2 JOIN dbo.Homework h ON h.InstitutionId=u2.InstitutionId AND ((h.ClassId IS NOT NULL AND h.ClassId=u2.ClassId) OR h.UserId=u2.Id)
        LEFT JOIN dbo.HomeworkDue du ON du.HomeworkId=h.Id AND du.UserId=u2.Id
        WHERE u2.Role='student' AND u2.IsDisabled=0 AND COALESCE(du.DueDate, h.DueDate) < CAST(@today AS date)
          AND NOT EXISTS (SELECT 1 FROM dbo.HomeworkSubmissions s WHERE s.HomeworkId=h.Id AND s.UserId=u2.Id) GROUP BY u2.Id HAVING COUNT(*) >= 2) x
    JOIN dbo.Users u ON u.Id=x.UserId LEFT JOIN dbo.Classes c ON c.Id=u.ClassId WHERE ${scopeSql(req)} ORDER BY x.N DESC`, p);
  const ex = await query(`SELECT e.UserId, e.ExamPart, e.TotalNet, u.FullName, u.Username, c.Name AS ClassName,
      ROW_NUMBER() OVER (PARTITION BY e.UserId, e.ExamPart ORDER BY e.ExamDate DESC, e.Id DESC) AS rn
    FROM dbo.TrialExams e JOIN dbo.Users u ON u.Id=e.UserId LEFT JOIN dbo.Classes c ON c.Id=u.ClassId
    WHERE u.Role='student' AND u.IsDisabled=0 AND e.TotalNet IS NOT NULL AND ${scopeSql(req)}`, p);
  const groups = new Map();
  for (const e of ex) { if (e.rn > 4) continue; const k = e.UserId + ':' + e.ExamPart; if (!groups.has(k)) groups.set(k, { e, nets: [] }); groups.get(k).nets[e.rn - 1] = Number(e.TotalNet); }
  const drop = [];
  for (const { e, nets } of groups.values()) { const d = netDrop(nets); if (d) drop.push({ id: e.UserId, name: e.FullName || e.Username, className: e.ClassName ?? null, part: e.ExamPart, ...d }); }
  drop.sort((a, b) => b.drop - a.drop);
  res.json({
    inactive: inactive.map(s => ({ id: s.Id, name: s.Name, className: s.ClassName ?? null, days: s.Days })),
    drop: drop.slice(0, 50), late: late.map(s => ({ id: s.Id, name: s.Name, className: s.ClassName ?? null, count: s.N })),
  });
}));

// ---------- Excel dışa aktarma (kapsam: yönetici → kurum, öğretmen → atandığı sınıflar) ----------
const n2 = (v) => (v == null ? null : Math.round(Number(v) * 100) / 100);
const EXPORT_CAP = 20000;

r.get('/export/students.xlsx', ...requireStaff, wrap(async (req, res) => {
  const rows = await query(`SELECT u.Username, u.FullName, u.StudentNo, c.Name AS ClassName, u.IsDisabled, CONVERT(char(10), u.LastLoginAt, 23) AS LastLogin,
      (SELECT COUNT(*) FROM dbo.TrialExams e WHERE e.UserId=u.Id) AS ExamCount, le.ExamName AS LastExam, le.ExamPart AS LastPart, le.TotalNet AS LastNet, CONVERT(char(10), le.ExamDate, 23) AS LastExamDate,
      (SELECT COALESCE(SUM(s.DurationMinutes),0) FROM dbo.StudySessions s WHERE s.UserId=u.Id AND s.StudyDate >= DATEADD(day,-7,CAST(GETDATE() AS date))) AS WeekMin
    FROM dbo.Users u LEFT JOIN dbo.Classes c ON c.Id=u.ClassId
    OUTER APPLY (SELECT TOP 1 e.ExamName, e.ExamPart, e.TotalNet, e.ExamDate FROM dbo.TrialExams e WHERE e.UserId=u.Id ORDER BY e.ExamDate DESC, e.Id DESC) le
    WHERE u.Role='student' AND ${scopeSql(req)} ORDER BY c.Name, u.FullName`, scopeParams(req));
  sendXlsx(res, 'ogrenciler', [{ name: 'Öğrenciler', widths: [22, 26, 12, 12, 10, 14, 14, 24, 10, 10, 14, 16], rows: [
    ['Kullanıcı adı', 'Ad soyad', 'Öğrenci no', 'Sınıf', 'Durum', 'Son giriş', 'Deneme sayısı', 'Son deneme', 'Bölüm', 'Son net', 'Son deneme tarihi', 'Son 7 gün çalışma (dk)'],
    ...rows.map(s => [s.Username, s.FullName ?? '', s.StudentNo ?? '', s.ClassName ?? '', s.IsDisabled ? 'Pasif' : 'Aktif', s.LastLogin ?? '', s.ExamCount, s.LastExam ?? '', s.LastPart ?? '', n2(s.LastNet), s.LastExamDate ?? '', s.WeekMin]),
  ] }]);
}));

r.get('/export/exams.xlsx', ...requireStaff, wrap(async (req, res) => {
  const exams = await query(`SELECT TOP (${EXPORT_CAP}) u.Username, u.FullName, c.Name AS ClassName, e.Id AS ExamId, e.ExamType, e.ExamPart, e.ExamName, CONVERT(char(10), e.ExamDate, 23) AS ExamDate, e.TotalNet
    FROM dbo.TrialExams e JOIN dbo.Users u ON u.Id=e.UserId LEFT JOIN dbo.Classes c ON c.Id=u.ClassId
    WHERE u.Role='student' AND ${scopeSql(req)} ORDER BY e.ExamDate DESC, e.Id DESC`, scopeParams(req));
  const ids = exams.map(e => e.ExamId); // veritabanından gelen tam sayılar
  const secs = ids.length ? await query(`SELECT s.ExamId, s.SectionKey, s.Correct, s.Wrong, s.Net FROM dbo.TrialExamSections s WHERE s.ExamId IN (${ids.join(',')})`) : [];
  const byExam = new Map(exams.map(e => [e.ExamId, e]));
  sendXlsx(res, 'denemeler', [
    { name: 'Denemeler', widths: [22, 26, 12, 8, 8, 28, 12, 10], rows: [['Kullanıcı adı', 'Ad soyad', 'Sınıf', 'Sınav', 'Bölüm', 'Deneme', 'Tarih', 'Toplam net'],
      ...exams.map(e => [e.Username, e.FullName ?? '', e.ClassName ?? '', e.ExamType, e.ExamPart, e.ExamName, e.ExamDate, n2(e.TotalNet)])] },
    { name: 'Bölüm sonuçları', widths: [22, 26, 12, 28, 12, 14, 8, 8, 8], rows: [['Kullanıcı adı', 'Ad soyad', 'Sınıf', 'Deneme', 'Tarih', 'Bölüm', 'Doğru', 'Yanlış', 'Net'],
      ...secs.map(s => { const e = byExam.get(s.ExamId); return [e.Username, e.FullName ?? '', e.ClassName ?? '', e.ExamName, e.ExamDate, s.SectionKey, s.Correct, s.Wrong, n2(s.Net)]; })] },
  ]);
}));

export default r;
