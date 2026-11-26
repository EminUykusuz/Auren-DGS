import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { TOPIC_KEYS, PARTS, partOf, defaultPartOf, EXAM_TYPES, WRONG_DIV } from '../exams.js';
import { net, sectionNets } from '../calc.js';
import { requireAuth, resolveExam, validate, wrap } from '../security.js';

const r = Router();
r.use(requireAuth, resolveExam); // req.examType: istekte belirtilen ya da kullanıcının kayıtlı modu

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)), 'Geçersiz tarih')
  .refine(s => Date.parse(s) <= Date.now() + 864e5, 'Gelecek tarih olamaz');
const examType = z.enum(EXAM_TYPES).optional();
const cnt = z.number().int().min(0).max(5000);
const idParam = z.object({ id: z.coerce.number().int().positive() });

// Ders/konu, seçili sınav türünün müfredatında olmalı
const topicOk = (x, part, subjectKey, topicKey) => !!TOPIC_KEYS[x]?.[part]?.[subjectKey]?.has(topicKey);
// Bölüm (DGS | TYT | AYT): istekte yoksa sınav türünün ilk bölümü; geçersizse 400
const partParam = z.string().max(3).optional();
const resolvePart = (req, res, raw) => {
  const part = raw ?? defaultPartOf(req.examType);
  if (!partOf(req.examType, part)) { res.status(400).json({ error: 'Geçersiz bölüm' }); return null; }
  return part;
};
const badTopic = res => res.status(400).json({ error: 'Geçersiz veri', details: [{ path: 'topicKey', message: 'Konu bu sınav türünün müfredatında yok' }] });

/* ---------- Çalışma oturumları ---------- */
const sessionSchema = z.object({
  examType, part: partParam, subjectKey: z.string().max(20), topicKey: z.string().max(60),
  durationMinutes: z.number().int().min(1).max(1440),
  questionsSolved: cnt, correctCount: cnt, wrongCount: cnt, studyDate: date,
}).strict().refine(d => d.correctCount + d.wrongCount <= d.questionsSolved, { message: 'Doğru + yanlış, çözülen sorudan fazla olamaz', path: ['questionsSolved'] });

r.get('/sessions', wrap(async (req, res) => {
  const part = req.query.part === undefined ? null : resolvePart(req, res, String(req.query.part)); if (req.query.part !== undefined && !part) return;
  const rows = await query(`SELECT TOP 200 Id, ExamPart, SubjectKey, TopicKey, DurationMinutes, QuestionsSolved, CorrectCount, WrongCount, CONVERT(char(10),StudyDate,23) AS StudyDate
    FROM dbo.StudySessions WHERE UserId=@me AND ExamType=@x AND (@p IS NULL OR ExamPart=@p) ORDER BY StudyDate DESC, Id DESC`, { me: req.userId, x: req.examType, p: part });
  res.json({ examType: req.examType, part, sessions: rows.map(x => ({ ...x, Net: net(x.CorrectCount, x.WrongCount, WRONG_DIV[req.examType]) })) });
}));

r.post('/sessions', validate(sessionSchema), wrap(async (req, res) => {
  const d = req.body, x = req.examType;
  const part = resolvePart(req, res, d.part); if (!part) return;
  if (!topicOk(x, part, d.subjectKey, d.topicKey)) return badTopic(res);
  const id = await tx(async q => {
    const [row] = await q(`INSERT INTO dbo.StudySessions (UserId,ExamType,ExamPart,SubjectKey,TopicKey,DurationMinutes,QuestionsSolved,CorrectCount,WrongCount,StudyDate)
      OUTPUT INSERTED.Id VALUES (@me,@x,@pt,@s,@t,@dur,@qs,@c,@w,CAST(@d AS date))`,
      { me: req.userId, x, pt: part, s: d.subjectKey, t: d.topicKey, dur: d.durationMinutes, qs: d.questionsSolved, c: d.correctCount, w: d.wrongCount, d: d.studyDate });
    // İlerlemeyi sunucu tarafında güncelle (istemciye güvenilmez)
    await q(`MERGE dbo.SubjectProgress AS t USING (SELECT @me AS UserId, @x AS ExamType, @pt AS ExamPart, @s AS SubjectKey, @t AS TopicKey) AS s
      ON t.UserId=s.UserId AND t.ExamType=s.ExamType AND t.ExamPart=s.ExamPart AND t.SubjectKey=s.SubjectKey AND t.TopicKey=s.TopicKey
      WHEN MATCHED THEN UPDATE SET CompletedQuestions = t.CompletedQuestions + @qs,
        Status = CASE WHEN t.CompletedQuestions + @qs >= t.TargetQuestions THEN 'completed' ELSE 'in_progress' END
      WHEN NOT MATCHED THEN INSERT (UserId,ExamType,ExamPart,SubjectKey,TopicKey,Status,CompletedQuestions)
        VALUES (@me,@x,@pt,@s,@t, CASE WHEN @qs >= 100 THEN 'completed' ELSE 'in_progress' END, @qs);`,
      { me: req.userId, x, pt: part, s: d.subjectKey, t: d.topicKey, qs: d.questionsSolved });
    return row.Id;
  });
  res.status(201).json({ id });
}));

r.delete('/sessions/:id', validate(idParam, 'params'), wrap(async (req, res) => {
  const out = await tx(async q => {
    const [s] = await q(`DELETE FROM dbo.StudySessions OUTPUT DELETED.ExamType, DELETED.ExamPart, DELETED.SubjectKey, DELETED.TopicKey, DELETED.QuestionsSolved WHERE Id=@id AND UserId=@me`, { id: req.params.id, me: req.userId });
    if (!s) return false;
    await q(`UPDATE dbo.SubjectProgress SET CompletedQuestions = CASE WHEN CompletedQuestions > @qs THEN CompletedQuestions - @qs ELSE 0 END,
      Status = CASE WHEN CompletedQuestions - @qs >= TargetQuestions THEN 'completed' WHEN CompletedQuestions - @qs > 0 THEN 'in_progress' ELSE 'not_started' END
      WHERE UserId=@me AND ExamType=@x AND ExamPart=@pt AND SubjectKey=@s AND TopicKey=@t`, { me: req.userId, x: s.ExamType, pt: s.ExamPart, s: s.SubjectKey, t: s.TopicKey, qs: s.QuestionsSolved });
    return true;
  });
  if (!out) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ ok: true });
}));

/* ---------- Deneme sınavları (net sunucuda hesaplanır: 4 yanlış 1 doğru) ---------- */
const REASONS = ['dikkat', 'islem', 'konu', 'sure', 'formul', 'diger'];
const errItem = z.object({ subject: z.string().max(10), reason: z.enum(REASONS), count: z.number().int().min(1).max(50) }).strict();
const errList = z.array(errItem).max(30);
const answer = z.object({ correct: z.number().int().min(0).max(120), wrong: z.number().int().min(0).max(120) }).strict();

// Hata nedenleri: bölüm geçerli olmalı, (bölüm, neden) tekil olmalı, bölüm toplamı o bölümdeki yanlışı aşamaz
function errorsOk(errors, sections, wrongBy) {
  const keys = new Set(sections.map(s => s.key)), seen = new Set(), sum = {};
  for (const e of errors) {
    const k = e.subject + ':' + e.reason;
    if (!keys.has(e.subject) || seen.has(k)) return false;
    seen.add(k); sum[e.subject] = (sum[e.subject] ?? 0) + e.count;
  }
  return Object.entries(sum).every(([k, v]) => v <= (wrongBy[k] ?? 0));
}

const examSchema = z.object({
  examType, part: z.string().max(3).optional(), errors: errList.optional(),
  examName: z.string().trim().min(1).max(100), examDate: date,
  results: z.record(z.string().max(10), answer),
}).strict(); // istemci net göndermeye çalışırsa reddedilir

const fail = (res, path, message) => res.status(400).json({ error: 'Geçersiz veri', details: [{ path, message }] });

r.get('/exams', wrap(async (req, res) => {
  const rows = await query(`SELECT Id, ExamName, ExamType, ExamPart, TotalNet, CONVERT(char(10),ExamDate,23) AS ExamDate
    FROM dbo.TrialExams WHERE UserId=@me AND ExamType=@x ORDER BY ExamDate DESC, Id DESC`, { me: req.userId, x: req.examType });
  const secs = await query(`SELECT s.ExamId, s.SectionKey, s.Correct, s.Wrong, s.Net FROM dbo.TrialExamSections s JOIN dbo.TrialExams t ON t.Id=s.ExamId WHERE t.UserId=@me AND t.ExamType=@x`, { me: req.userId, x: req.examType });
  const errs = await query(`SELECT e.ExamId, e.Subject, e.Reason, e.Cnt FROM dbo.TrialExamErrors e JOIN dbo.TrialExams t ON t.Id=e.ExamId WHERE t.UserId=@me AND t.ExamType=@x`, { me: req.userId, x: req.examType });
  res.json({ examType: req.examType, exams: rows.map(x => {
    const order = partOf(x.ExamType, x.ExamPart)?.sections.map(s => s.key) ?? [];
    return { Id: x.Id, ExamName: x.ExamName, ExamType: x.ExamType, ExamPart: x.ExamPart, ExamDate: x.ExamDate, TotalNet: Number(x.TotalNet),
      Sections: secs.filter(s => s.ExamId === x.Id).map(s => ({ key: s.SectionKey, correct: s.Correct, wrong: s.Wrong, net: Number(s.Net) }))
        .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)),
      Errors: errs.filter(e => e.ExamId === x.Id).map(e => ({ subject: e.Subject, reason: e.Reason, count: e.Cnt })) };
  }) });
}));

// Seçili sınav türündeki hata nedeni dağılımı (bölüm ve neden kırılımı)
r.get('/exams/error-summary', wrap(async (req, res) => {
  const rows = await query(`SELECT e.Subject, e.Reason, SUM(e.Cnt) AS Total FROM dbo.TrialExamErrors e JOIN dbo.TrialExams t ON t.Id=e.ExamId WHERE t.UserId=@me AND t.ExamType=@x GROUP BY e.Subject, e.Reason`, { me: req.userId, x: req.examType });
  const [w] = await query(`SELECT COALESCE(SUM(s.Wrong),0) AS W FROM dbo.TrialExamSections s JOIN dbo.TrialExams t ON t.Id=s.ExamId WHERE t.UserId=@me AND t.ExamType=@x`, { me: req.userId, x: req.examType });
  const total = rows.reduce((s, x) => s + x.Total, 0);
  res.json({ examType: req.examType, rows: rows.map(x => ({ subject: x.Subject, reason: x.Reason, total: x.Total })), categorized: total, totalWrong: w.W });
}));

// Mevcut denemenin hata nedenlerini değiştir (inceleme sırasında)
r.put('/exams/:id/errors', validate(idParam, 'params'), validate(z.object({ examType, errors: errList }).strict()), wrap(async (req, res) => {
  const [ex] = await query(`SELECT ExamType, ExamPart FROM dbo.TrialExams WHERE Id=@id AND UserId=@me`, { id: req.params.id, me: req.userId });
  if (!ex) return res.status(404).json({ error: 'Bulunamadı' });
  const secs = await query(`SELECT SectionKey, Wrong FROM dbo.TrialExamSections WHERE ExamId=@id`, { id: req.params.id });
  const wrongBy = Object.fromEntries(secs.map(s => [s.SectionKey, s.Wrong]));
  if (!errorsOk(req.body.errors, secs.map(s => ({ key: s.SectionKey })), wrongBy)) return fail(res, 'errors', 'Hata nedenleri toplamı yanlış sayısını aşamaz');
  await tx(async q => {
    await q(`DELETE FROM dbo.TrialExamErrors WHERE ExamId=@id`, { id: req.params.id });
    for (const e of req.body.errors) await q(`INSERT INTO dbo.TrialExamErrors (ExamId, Subject, Reason, Cnt) VALUES (@id,@s,@r,@c)`, { id: req.params.id, s: e.subject, r: e.reason, c: e.count });
  });
  res.json({ ok: true });
}));

r.post('/exams', validate(examSchema), wrap(async (req, res) => {
  const d = req.body, x = req.examType;
  const part = d.part ?? (Object.keys(PARTS[x]).length === 1 ? defaultPartOf(x) : null);
  const def = part && partOf(x, part);
  if (!def) return fail(res, 'part', `Geçerli bölümler: ${Object.keys(PARTS[x]).join(', ')}`);
  const keys = new Set(def.sections.map(s => s.key));
  for (const k of Object.keys(d.results)) if (!keys.has(k)) return fail(res, 'results.' + k, 'Bu bölümde böyle bir ders yok');
  for (const s of def.sections) {
    const a = d.results[s.key];
    if (a && a.correct + a.wrong > s.max) return fail(res, `results.${s.key}`, `${s.label}: doğru + yanlış en fazla ${s.max}`);
  }
  const { nets, totalNet } = sectionNets(def.sections, d.results, WRONG_DIV[x]);
  const wrongBy = Object.fromEntries(def.sections.map(s => [s.key, d.results[s.key]?.wrong ?? 0]));
  if (!errorsOk(d.errors ?? [], def.sections, wrongBy)) return fail(res, 'errors', 'Hata nedenleri toplamı yanlış sayısını aşamaz');
  const id = await tx(async q => {
    const [row] = await q(`INSERT INTO dbo.TrialExams (UserId,ExamType,ExamPart,ExamName,TotalNet,ExamDate)
      OUTPUT INSERTED.Id VALUES (@me,@x,@p,@n,@tn,CAST(@d AS date))`, { me: req.userId, x, p: part, n: d.examName, tn: totalNet, d: d.examDate });
    for (const s of def.sections) {
      const a = d.results[s.key] ?? { correct: 0, wrong: 0 };
      await q(`INSERT INTO dbo.TrialExamSections (ExamId,SectionKey,Correct,Wrong,Net) VALUES (@id,@k,@c,@w,@net)`, { id: row.Id, k: s.key, c: a.correct, w: a.wrong, net: nets[s.key] });
    }
    for (const e of d.errors ?? []) await q(`INSERT INTO dbo.TrialExamErrors (ExamId, Subject, Reason, Cnt) VALUES (@id,@s,@r,@c)`, { id: row.Id, s: e.subject, r: e.reason, c: e.count });
    return row.Id;
  });
  res.status(201).json({ id, part, nets, totalNet });
}));

r.delete('/exams/:id', validate(idParam, 'params'), wrap(async (req, res) => {
  const out = await query(`DELETE FROM dbo.TrialExams OUTPUT DELETED.Id WHERE Id=@id AND UserId=@me`, { id: req.params.id, me: req.userId });
  if (!out.length) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ ok: true });
}));

// Önizleme hesaplayıcı: istemci ile sunucu aynı formülü kullanır
r.post('/calc', validate(z.object({ correct: z.number().int().min(0).max(120), wrong: z.number().int().min(0).max(120), examType })), (req, res) =>
  res.json({ net: net(req.body.correct, req.body.wrong, WRONG_DIV[req.examType]) }));

/* ---------- Konu ilerlemesi ---------- */
r.get('/progress', wrap(async (req, res) => {
  const part = resolvePart(req, res, req.query.part === undefined ? undefined : String(req.query.part)); if (!part) return;
  const rows = await query(`SELECT SubjectKey, TopicKey, Status, TargetQuestions, CompletedQuestions FROM dbo.SubjectProgress WHERE UserId=@me AND ExamType=@x AND ExamPart=@p`, { me: req.userId, x: req.examType, p: part });
  res.json({ examType: req.examType, part, progress: rows });
}));

r.put('/progress', validate(z.object({
  examType, part: partParam, subjectKey: z.string().max(20), topicKey: z.string().max(60),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  targetQuestions: z.number().int().min(1).max(10000).optional(),
}).strict()), wrap(async (req, res) => {
  const d = req.body, x = req.examType;
  const part = resolvePart(req, res, d.part); if (!part) return;
  if (!topicOk(x, part, d.subjectKey, d.topicKey)) return badTopic(res);
  await query(`MERGE dbo.SubjectProgress AS t USING (SELECT @me AS UserId, @x AS ExamType, @pt AS ExamPart, @s AS SubjectKey, @t AS TopicKey) AS s
    ON t.UserId=s.UserId AND t.ExamType=s.ExamType AND t.ExamPart=s.ExamPart AND t.SubjectKey=s.SubjectKey AND t.TopicKey=s.TopicKey
    WHEN MATCHED THEN UPDATE SET Status=COALESCE(@st,t.Status), TargetQuestions=COALESCE(@tq,t.TargetQuestions)
    WHEN NOT MATCHED THEN INSERT (UserId,ExamType,ExamPart,SubjectKey,TopicKey,Status,TargetQuestions) VALUES (@me,@x,@pt,@s,@t,COALESCE(@st,'not_started'),COALESCE(@tq,100));`,
    { me: req.userId, x, pt: part, s: d.subjectKey, t: d.topicKey, st: d.status ?? null, tq: d.targetQuestions ?? null });
  res.json({ ok: true });
}));

export default r;
