import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { TOPIC_KEYS } from '../curriculum.js';
import { net, examNets, MAX_Q } from '../calc.js';
import { requireAuth, validate, wrap } from '../security.js';

const r = Router();
r.use(requireAuth);

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)), 'Geçersiz tarih')
  .refine(s => Date.parse(s) <= Date.now() + 864e5, 'Gelecek tarih olamaz');
const subject = z.enum(['matematik', 'turkce']);
const cnt = z.number().int().min(0).max(5000);
const idParam = z.object({ id: z.coerce.number().int().positive() });
const isoDay = s => s.slice(0, 10);

const topicOk = (d, ctx) => {
  if (!TOPIC_KEYS[d.subjectKey].has(d.topicKey)) ctx.addIssue({ code: 'custom', path: ['topicKey'], message: 'Konu bu derse ait değil' });
};

/* ---------- Çalışma oturumları ---------- */
const sessionSchema = z.object({
  subjectKey: subject, topicKey: z.string().max(60),
  durationMinutes: z.number().int().min(1).max(1440),
  questionsSolved: cnt, correctCount: cnt, wrongCount: cnt, studyDate: date,
}).superRefine(topicOk).refine(d => d.correctCount + d.wrongCount <= d.questionsSolved, { message: 'Doğru + yanlış, çözülen sorudan fazla olamaz', path: ['questionsSolved'] });

r.get('/sessions', wrap(async (req, res) => {
  const rows = await query(`SELECT TOP 200 Id, SubjectKey, TopicKey, DurationMinutes, QuestionsSolved, CorrectCount, WrongCount, CONVERT(char(10),StudyDate,23) AS StudyDate
    FROM dbo.StudySessions WHERE UserId=@me ORDER BY StudyDate DESC, Id DESC`, { me: req.userId });
  res.json({ sessions: rows.map(x => ({ ...x, Net: net(x.CorrectCount, x.WrongCount) })) });
}));

r.post('/sessions', validate(sessionSchema), wrap(async (req, res) => {
  const d = req.body;
  const id = await tx(async q => {
    const [row] = await q(`INSERT INTO dbo.StudySessions (UserId,SubjectKey,TopicKey,DurationMinutes,QuestionsSolved,CorrectCount,WrongCount,StudyDate)
      OUTPUT INSERTED.Id VALUES (@me,@s,@t,@dur,@qs,@c,@w,CAST(@d AS date))`,
      { me: req.userId, s: d.subjectKey, t: d.topicKey, dur: d.durationMinutes, qs: d.questionsSolved, c: d.correctCount, w: d.wrongCount, d: d.studyDate });
    // İlerlemeyi sunucu tarafında güncelle (istemciye güvenilmez)
    await q(`MERGE dbo.SubjectProgress AS t USING (SELECT @me AS UserId, @s AS SubjectKey, @t AS TopicKey) AS s
      ON t.UserId=s.UserId AND t.SubjectKey=s.SubjectKey AND t.TopicKey=s.TopicKey
      WHEN MATCHED THEN UPDATE SET CompletedQuestions = t.CompletedQuestions + @qs,
        Status = CASE WHEN t.CompletedQuestions + @qs >= t.TargetQuestions THEN 'completed' ELSE 'in_progress' END
      WHEN NOT MATCHED THEN INSERT (UserId,SubjectKey,TopicKey,Status,CompletedQuestions)
        VALUES (@me,@s,@t, CASE WHEN @qs >= 100 THEN 'completed' ELSE 'in_progress' END, @qs);`,
      { me: req.userId, s: d.subjectKey, t: d.topicKey, qs: d.questionsSolved });
    return row.Id;
  });
  res.status(201).json({ id });
}));

r.delete('/sessions/:id', validate(idParam, 'params'), wrap(async (req, res) => {
  const out = await tx(async q => {
    const [s] = await q(`DELETE FROM dbo.StudySessions OUTPUT DELETED.SubjectKey, DELETED.TopicKey, DELETED.QuestionsSolved WHERE Id=@id AND UserId=@me`, { id: req.params.id, me: req.userId });
    if (!s) return false;
    await q(`UPDATE dbo.SubjectProgress SET CompletedQuestions = CASE WHEN CompletedQuestions > @qs THEN CompletedQuestions - @qs ELSE 0 END,
      Status = CASE WHEN CompletedQuestions - @qs >= TargetQuestions THEN 'completed' WHEN CompletedQuestions - @qs > 0 THEN 'in_progress' ELSE 'not_started' END
      WHERE UserId=@me AND SubjectKey=@s AND TopicKey=@t`, { me: req.userId, s: s.SubjectKey, t: s.TopicKey, qs: s.QuestionsSolved });
    return true;
  });
  if (!out) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ ok: true });
}));

/* ---------- Deneme sınavları (net sunucuda hesaplanır) ---------- */
const q50 = z.number().int().min(0).max(MAX_Q);
const REASONS = ['dikkat', 'konu', 'sure', 'formul', 'diger'];
const errItem = z.object({ subject: subject, reason: z.enum(REASONS), count: z.number().int().min(1).max(50) }).strict();
const errList = z.array(errItem).max(10);
// Hata nedenleri: (ders, neden) tekil olmalı ve ders başına toplam, o dersteki yanlış sayısını aşamaz
function errorsOk(errors, wrong) {
  const seen = new Set(), sum = { matematik: 0, turkce: 0 };
  for (const e of errors) { const k = e.subject + e.reason; if (seen.has(k)) return false; seen.add(k); sum[e.subject] += e.count; }
  return sum.matematik <= wrong.matematik && sum.turkce <= wrong.turkce;
}
const examSchema = z.object({
  errors: errList.optional(),
  examName: z.string().trim().min(1).max(100),
  mathCorrect: q50, mathWrong: q50, turkceCorrect: q50, turkceWrong: q50, examDate: date,
}).strict() // istemci net göndermeye çalışırsa reddedilir
  .refine(d => d.mathCorrect + d.mathWrong <= MAX_Q, { message: 'Matematik: doğru + yanlış en fazla 50', path: ['mathWrong'] })
  .refine(d => d.turkceCorrect + d.turkceWrong <= MAX_Q, { message: 'Türkçe: doğru + yanlış en fazla 50', path: ['turkceWrong'] })
  .refine(d => errorsOk(d.errors ?? [], { matematik: d.mathWrong, turkce: d.turkceWrong }), { message: 'Hata nedenleri toplamı yanlış sayısını aşamaz', path: ['errors'] });

r.get('/exams', wrap(async (req, res) => {
  const rows = await query(`SELECT Id, ExamName, MathCorrect, MathWrong, MathNet, TurkceCorrect, TurkceWrong, TurkceNet, CONVERT(char(10),ExamDate,23) AS ExamDate
    FROM dbo.TrialExams WHERE UserId=@me ORDER BY ExamDate DESC, Id DESC`, { me: req.userId });
  const errs = await query(`SELECT e.ExamId, e.Subject, e.Reason, e.Cnt FROM dbo.TrialExamErrors e JOIN dbo.TrialExams t ON t.Id=e.ExamId WHERE t.UserId=@me`, { me: req.userId });
  res.json({ exams: rows.map(x => ({ ...x, MathNet: Number(x.MathNet), TurkceNet: Number(x.TurkceNet), TotalNet: Number(x.MathNet) + Number(x.TurkceNet),
    Errors: errs.filter(e => e.ExamId === x.Id).map(e => ({ subject: e.Subject, reason: e.Reason, count: e.Cnt })) })) });
}));

// Tüm denemelerdeki hata nedeni dağılımı (ders ve neden kırılımı)
r.get('/exams/error-summary', wrap(async (req, res) => {
  const rows = await query(`SELECT e.Subject, e.Reason, SUM(e.Cnt) AS Total FROM dbo.TrialExamErrors e JOIN dbo.TrialExams t ON t.Id=e.ExamId WHERE t.UserId=@me GROUP BY e.Subject, e.Reason`, { me: req.userId });
  const [w] = await query(`SELECT COALESCE(SUM(MathWrong),0) AS M, COALESCE(SUM(TurkceWrong),0) AS T FROM dbo.TrialExams WHERE UserId=@me`, { me: req.userId });
  const total = rows.reduce((s, x) => s + x.Total, 0);
  res.json({ rows: rows.map(x => ({ subject: x.Subject, reason: x.Reason, total: x.Total })), categorized: total, totalWrong: w.M + w.T });
}));

// Mevcut denemenin hata nedenlerini değiştir (inceleme sırasında)
r.put('/exams/:id/errors', validate(idParam, 'params'), validate(z.object({ errors: errList }).strict()), wrap(async (req, res) => {
  const [ex] = await query(`SELECT MathWrong, TurkceWrong FROM dbo.TrialExams WHERE Id=@id AND UserId=@me`, { id: req.params.id, me: req.userId });
  if (!ex) return res.status(404).json({ error: 'Bulunamadı' });
  if (!errorsOk(req.body.errors, { matematik: ex.MathWrong, turkce: ex.TurkceWrong })) return res.status(400).json({ error: 'Hata nedenleri toplamı yanlış sayısını aşamaz' });
  await tx(async q => {
    await q(`DELETE FROM dbo.TrialExamErrors WHERE ExamId=@id`, { id: req.params.id });
    for (const e of req.body.errors) await q(`INSERT INTO dbo.TrialExamErrors (ExamId, Subject, Reason, Cnt) VALUES (@id,@s,@r,@c)`, { id: req.params.id, s: e.subject, r: e.reason, c: e.count });
  });
  res.json({ ok: true });
}));

r.post('/exams', validate(examSchema), wrap(async (req, res) => {
  const d = req.body, n = examNets(d);
  const id = await tx(async q => {
    const [row] = await q(`INSERT INTO dbo.TrialExams (UserId,ExamName,MathCorrect,MathWrong,MathNet,TurkceCorrect,TurkceWrong,TurkceNet,ExamDate)
      OUTPUT INSERTED.Id VALUES (@me,@n,@mc,@mw,@mn,@tc,@tw,@tn,CAST(@d AS date))`,
      { me: req.userId, n: d.examName, mc: d.mathCorrect, mw: d.mathWrong, mn: n.mathNet, tc: d.turkceCorrect, tw: d.turkceWrong, tn: n.turkceNet, d: d.examDate });
    for (const e of d.errors ?? []) await q(`INSERT INTO dbo.TrialExamErrors (ExamId, Subject, Reason, Cnt) VALUES (@id,@s,@r,@c)`, { id: row.Id, s: e.subject, r: e.reason, c: e.count });
    return row.Id;
  });
  res.status(201).json({ id, ...n });
}));

r.delete('/exams/:id', validate(idParam, 'params'), wrap(async (req, res) => {
  const out = await query(`DELETE FROM dbo.TrialExams OUTPUT DELETED.Id WHERE Id=@id AND UserId=@me`, { id: req.params.id, me: req.userId });
  if (!out.length) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ ok: true });
}));

// Önizleme hesaplayıcı: istemci ile sunucu aynı formülü kullanır
r.post('/calc', validate(z.object({ correct: q50, wrong: q50 }).refine(d => d.correct + d.wrong <= MAX_Q)), (req, res) =>
  res.json({ net: net(req.body.correct, req.body.wrong) }));

/* ---------- Konu ilerlemesi ---------- */
r.get('/progress', wrap(async (req, res) => {
  const rows = await query(`SELECT SubjectKey, TopicKey, Status, TargetQuestions, CompletedQuestions FROM dbo.SubjectProgress WHERE UserId=@me`, { me: req.userId });
  res.json({ progress: rows });
}));

r.put('/progress', validate(z.object({
  subjectKey: subject, topicKey: z.string().max(60),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  targetQuestions: z.number().int().min(1).max(10000).optional(),
}).superRefine(topicOk)), wrap(async (req, res) => {
  const d = req.body;
  await query(`MERGE dbo.SubjectProgress AS t USING (SELECT @me AS UserId, @s AS SubjectKey, @t AS TopicKey) AS s
    ON t.UserId=s.UserId AND t.SubjectKey=s.SubjectKey AND t.TopicKey=s.TopicKey
    WHEN MATCHED THEN UPDATE SET Status=COALESCE(@st,t.Status), TargetQuestions=COALESCE(@tq,t.TargetQuestions)
    WHEN NOT MATCHED THEN INSERT (UserId,SubjectKey,TopicKey,Status,TargetQuestions) VALUES (@me,@s,@t,COALESCE(@st,'not_started'),COALESCE(@tq,100));`,
    { me: req.userId, s: d.subjectKey, t: d.topicKey, st: d.status ?? null, tq: d.targetQuestions ?? null });
  res.json({ ok: true });
}));

export default r;
