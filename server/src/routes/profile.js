import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { requireAuth, validate, wrap } from '../security.js';
import { sendFeedbackMail, mailConfigured } from '../mailer.js';

const r = Router();
r.use(requireAuth);

const text = (max) => z.string().trim().max(max).transform(s => s.replace(/\s+/g, ' '));

r.get('/profile', wrap(async (req, res) => {
  const [u] = await query(`SELECT Username, Email, TargetUniversity, TargetDepartment, CONVERT(char(10), ExamDate, 23) AS ExamDate FROM dbo.Users WHERE Id=@id`, { id: req.userId });
  res.json({ username: u.Username, email: u.Email, targetUniversity: u.TargetUniversity ?? '', targetDepartment: u.TargetDepartment ?? '', examDate: u.ExamDate ?? null });
}));

r.put('/profile', validate(z.object({ targetUniversity: text(120), targetDepartment: text(120),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const t = Date.parse(s + 'T00:00:00Z'); return !Number.isNaN(t) && t > Date.now() - 864e5 && t < Date.now() + 800 * 864e5; }, 'Sınav tarihi geçmişte olamaz ve en fazla ~2 yıl sonrası olabilir').nullable().optional() }).strict()), wrap(async (req, res) => {
  const { targetUniversity: tu, targetDepartment: td, examDate } = req.body;
  await query(`UPDATE dbo.Users SET TargetUniversity=@tu, TargetDepartment=@td, ExamDate=CASE WHEN @set=1 THEN CAST(@ed AS date) ELSE ExamDate END WHERE Id=@id`,
    { tu: tu || null, td: td || null, set: examDate === undefined ? 0 : 1, ed: examDate ?? null, id: req.userId });
  res.json({ ok: true });
}));

// Kullanıcı başına saatte 5 geri bildirim (kimlik doğrulamadan sonra çalışır)
const limiter = rateLimit({ windowMs: 60 * 60_000, limit: Number(process.env.FEEDBACK_RATE_LIMIT) || 5, keyGenerator: req => `u${req.userId}`, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Saatlik geri bildirim sınırına ulaştın. Lütfen daha sonra tekrar dene.' } });

r.post('/feedback', limiter, validate(z.object({
  category: z.enum(['oneri', 'hata', 'soru', 'diger']),
  subject: text(100).refine(s => s.length >= 3, 'Konu en az 3 karakter olmalı'),
  message: z.string().trim().min(10, 'Mesaj en az 10 karakter olmalı').max(2000, 'Mesaj en fazla 2000 karakter olabilir'),
}).strict()), wrap(async (req, res) => {
  const d = req.body;
  const [row] = await query(`INSERT INTO dbo.Feedback (UserId, Category, Subject, Message) OUTPUT INSERTED.Id VALUES (@u,@c,@s,@m)`, { u: req.userId, c: d.category, s: d.subject, m: d.message });
  const [u] = await query(`SELECT Username, Email FROM dbo.Users WHERE Id=@id`, { id: req.userId });
  const m = await sendFeedbackMail({ id: row.Id, username: u.Username, email: u.Email, ...d });
  if (m.status !== 'queued') await query(`UPDATE dbo.Feedback SET MailStatus=@s, MailError=@e WHERE Id=@id`, { s: m.status, e: m.error ?? null, id: row.Id });
  res.status(201).json({ id: row.Id, mail: m.status, mailConfigured });
}));

export default r;
