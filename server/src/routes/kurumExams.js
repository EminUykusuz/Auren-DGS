// Kurum denemeleri: personel deneme tanımlar, sonuçları toplu yapıştırır; sonuçlar öğrencilerin Denemeler listesine düşer.
// Kapsam kuralları kurum.js ile aynı: yönetici kurumun tamamı, öğretmen yalnız atandığı sınıflar; başka kurumun kaydı 404.
import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { requireStaff, validate, wrap } from '../security.js';
import { PARTS, partOf, WRONG_DIV } from '../exams.js';
import { sectionNets } from '../calc.js';
import { parseExamResults } from '../kurum-lib.js';
import { scopeSql, scopeParams, classIsMine } from './kurum.js';

const r = Router();
const idParam = z.object({ id: z.coerce.number().int().positive() });
const round2 = (n) => Math.round(n * 100) / 100;
const visible = (req) => req.role === 'owner' ? '' : 'AND (e.ClassId IS NULL OR e.ClassId IN (SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@me))';

// Personelin görebileceği deneme: kendi kurumu + (yönetici → hepsi; öğretmen → atandığı sınıflar ya da tüm kuruma açık olanlar)
async function getExam(req, id) {
  const [e] = await query(`SELECT e.Id, e.ClassId, e.ExamType, e.ExamPart, e.ExamName, CONVERT(char(10), e.ExamDate, 23) AS ExamDate, c.Name AS ClassName
    FROM dbo.InstExams e LEFT JOIN dbo.Classes c ON c.Id=e.ClassId
    WHERE e.Id=@id AND e.InstitutionId=@inst ${visible(req)}`, { id, ...scopeParams(req) });
  return e;
}

r.get('/', ...requireStaff, wrap(async (req, res) => {
  const rows = await query(`SELECT e.Id, e.ClassId, c.Name AS ClassName, e.ExamType, e.ExamPart, e.ExamName, CONVERT(char(10), e.ExamDate, 23) AS ExamDate,
      (SELECT COUNT(*) FROM dbo.TrialExams t JOIN dbo.Users u ON u.Id=t.UserId WHERE t.InstExamId=e.Id AND ${scopeSql(req)}) AS Results,
      (SELECT AVG(CAST(t.TotalNet AS float)) FROM dbo.TrialExams t JOIN dbo.Users u ON u.Id=t.UserId WHERE t.InstExamId=e.Id AND ${scopeSql(req)}) AS AvgNet
    FROM dbo.InstExams e LEFT JOIN dbo.Classes c ON c.Id=e.ClassId
    WHERE e.InstitutionId=@inst ${visible(req)}
    ORDER BY e.ExamDate DESC, e.Id DESC`, scopeParams(req));
  res.json({ exams: rows.map(e => ({ id: e.Id, classId: e.ClassId, className: e.ClassName, examType: e.ExamType, part: e.ExamPart, name: e.ExamName, date: e.ExamDate,
    results: e.Results, avgNet: e.AvgNet == null ? null : round2(e.AvgNet) })) });
}));

const createSchema = z.object({
  examType: z.enum(['DGS', 'YKS', 'LGS']), part: z.string().max(3), examName: z.string().trim().min(2).max(60),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), classId: z.number().int().positive().nullish(),
}).strict();
r.post('/', ...requireStaff, validate(createSchema), wrap(async (req, res) => {
  const d = req.body, def = partOf(d.examType, d.part);
  if (!def) return res.status(400).json({ error: `Geçerli bölümler: ${Object.keys(PARTS[d.examType]).join(', ')}` });
  if (d.classId == null && req.role !== 'owner') return res.status(400).json({ error: 'Sınıf seçin' });
  if (d.classId != null && !(await classIsMine(req, d.classId))) return res.status(404).json({ error: 'Sınıf bulunamadı' });
  const [row] = await query(`INSERT INTO dbo.InstExams (InstitutionId, ClassId, ExamType, ExamPart, ExamName, ExamDate, CreatedBy)
    OUTPUT INSERTED.Id VALUES (@inst,@c,@x,@p,@n,CAST(@d AS date),@me)`, { ...scopeParams(req), c: d.classId ?? null, x: d.examType, p: d.part, n: d.examName, d: d.examDate });
  res.status(201).json({ id: row.Id });
}));

r.delete('/:id', ...requireStaff, validate(idParam, 'params'), wrap(async (req, res) => {
  const e = await getExam(req, req.params.id);
  if (!e) return res.status(404).json({ error: 'Bulunamadı' });
  // Tüm kuruma açık denemeyi yalnız yönetici siler
  if (req.role !== 'owner' && e.ClassId == null) return res.status(403).json({ error: 'Kurum geneli denemeyi yalnız yönetici silebilir' });
  await tx(async q => {
    await q(`DELETE FROM dbo.TrialExams WHERE InstExamId=@id`, { id: e.Id });
    await q(`DELETE FROM dbo.InstExams WHERE Id=@id AND InstitutionId=@inst`, { id: e.Id, inst: req.institutionId });
  });
  res.json({ ok: true });
}));

// Sonuç girişi: dryRun ile önizleme, değilse kaydeder. Bir öğrencinin aynı denemedeki eski sonucu değiştirilir.
r.post('/:id/results', ...requireStaff, validate(idParam, 'params'), validate(z.object({ text: z.string().max(200_000), dryRun: z.boolean().optional() }).strict()), wrap(async (req, res) => {
  const e = await getExam(req, req.params.id);
  if (!e) return res.status(404).json({ error: 'Bulunamadı' });
  const def = partOf(e.ExamType, e.ExamPart);
  const { rows, errors } = parseExamResults(req.body.text, def.sections);
  const studs = await query(`SELECT u.Id, u.FullName, u.StudentNo FROM dbo.Users u WHERE u.Role='student' AND u.StudentNo IS NOT NULL AND ${scopeSql(req)} ${e.ClassId ? 'AND u.ClassId=@ec' : ''}`,
    { ...scopeParams(req), ...(e.ClassId ? { ec: e.ClassId } : {}) });
  const byNo = new Map(studs.map(s => [String(s.StudentNo), s]));
  const ok = [], missing = [];
  for (const row of rows) {
    const s = byNo.get(row.studentNo);
    if (!s) { missing.push({ line: row.line, message: `${row.studentNo} numaralı öğrenci bulunamadı (kapsamınızda yok)` }); continue; }
    const { nets, totalNet } = sectionNets(def.sections, row.results, WRONG_DIV[e.ExamType]);
    ok.push({ userId: s.Id, fullName: s.FullName ?? '', studentNo: row.studentNo, results: row.results, nets, totalNet });
  }
  const allErrors = [...errors, ...missing].sort((a, b) => a.line - b.line);
  if (req.body.dryRun || !ok.length) return res.json({ saved: 0, preview: ok.map(o => ({ studentNo: o.studentNo, fullName: o.fullName, totalNet: o.totalNet })), errors: allErrors });
  await tx(async q => {
    for (const o of ok) {
      await q(`DELETE FROM dbo.TrialExams WHERE UserId=@u AND InstExamId=@e`, { u: o.userId, e: e.Id });
      const [row] = await q(`INSERT INTO dbo.TrialExams (UserId, ExamType, ExamPart, ExamName, TotalNet, ExamDate, InstExamId)
        OUTPUT INSERTED.Id VALUES (@u,@x,@p,@n,@tn,CAST(@d AS date),@e)`, { u: o.userId, x: e.ExamType, p: e.ExamPart, n: e.ExamName, tn: o.totalNet, d: e.ExamDate, e: e.Id });
      for (const s of def.sections) {
        const a = o.results[s.key];
        await q(`INSERT INTO dbo.TrialExamSections (ExamId,SectionKey,Correct,Wrong,Net) VALUES (@id,@k,@c,@w,@net)`, { id: row.Id, k: s.key, c: a.correct, w: a.wrong, net: o.nets[s.key] });
      }
    }
  });
  res.status(201).json({ saved: ok.length, errors: allErrors });
}));

// Sıralama: kapsamdaki öğrenciler net'e göre; aynı net aynı sıra. Sınıf ve ders ortalamaları birlikte.
r.get('/:id', ...requireStaff, validate(idParam, 'params'), wrap(async (req, res) => {
  const e = await getExam(req, req.params.id);
  if (!e) return res.status(404).json({ error: 'Bulunamadı' });
  const def = partOf(e.ExamType, e.ExamPart);
  const rows = await query(`SELECT t.Id AS TId, u.Id, u.FullName, u.StudentNo, c.Name AS ClassName, t.TotalNet
    FROM dbo.TrialExams t JOIN dbo.Users u ON u.Id=t.UserId LEFT JOIN dbo.Classes c ON c.Id=u.ClassId
    WHERE t.InstExamId=@e AND ${scopeSql(req)} ORDER BY t.TotalNet DESC, u.FullName`, { e: e.Id, ...scopeParams(req) });
  const secs = rows.length ? await query(`SELECT s.ExamId, s.SectionKey, s.Net FROM dbo.TrialExamSections s JOIN dbo.TrialExams t ON t.Id=s.ExamId JOIN dbo.Users u ON u.Id=t.UserId
    WHERE t.InstExamId=@e AND ${scopeSql(req)}`, { e: e.Id, ...scopeParams(req) }) : [];
  const byExam = new Map();
  for (const s of secs) { if (!byExam.has(s.ExamId)) byExam.set(s.ExamId, {}); byExam.get(s.ExamId)[s.SectionKey] = round2(Number(s.Net)); }
  let rank = 0, prev = null;
  const students = rows.map((x, i) => {
    const n = round2(Number(x.TotalNet)); if (n !== prev) { rank = i + 1; prev = n; }
    return { rank, userId: x.Id, fullName: x.FullName ?? '', studentNo: x.StudentNo, className: x.ClassName, totalNet: n, nets: byExam.get(x.TId) ?? {} };
  });
  const classes = Object.values(students.reduce((m, s) => { const c = (m[s.className ?? '—'] ??= { name: s.className ?? '—', n: 0, sum: 0 }); c.n++; c.sum += s.totalNet; return m; }, {}))
    .map(c => ({ name: c.name, count: c.n, avgNet: round2(c.sum / c.n) })).sort((a, b) => b.avgNet - a.avgNet);
  const sectionAvg = def.sections.map(s => { const v = students.map(x => x.nets[s.key]).filter(n => n != null); return { key: s.key, label: s.label, max: s.max, avg: v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : null }; });
  res.json({ exam: { id: e.Id, name: e.ExamName, date: e.ExamDate, examType: e.ExamType, part: e.ExamPart, classId: e.ClassId, className: e.ClassName, sections: def.sections }, students, classes, sectionAvg });
}));

export default r;
