import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { query } from '../db.js';
import { config } from '../config.js';
import bcrypt from 'bcryptjs';
import { EXAM_TYPES } from '../exams.js';
import { isAvatar } from '../avatars.js';
import { requireAuth, validate, wrap } from '../security.js';
import { sendFeedbackMail, mailConfigured } from '../mailer.js';

const r = Router();
r.use(requireAuth);

const text = (max) => z.string().trim().max(max).transform(s => s.replace(/\s+/g, ' '));

const dateCol = { DGS: 'ExamDate', YKS: 'YksExamDate' }; // sabit sütun adları (kullanıcı girdisi SQL'e girmez)
const examDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const t = Date.parse(s + 'T00:00:00Z'); return !Number.isNaN(t) && t > Date.now() - 864e5 && t < Date.now() + 800 * 864e5; }, 'Sınav tarihi geçmişte olamaz ve en fazla ~2 yıl sonrası olabilir');

r.get('/profile', wrap(async (req, res) => {
  const [u] = await query(`SELECT Username, Email, FullName, AvatarUrl, TargetUniversity, TargetDepartment, ExamMode, CONVERT(char(10), ExamDate, 23) AS ExamDate, CONVERT(char(10), YksExamDate, 23) AS YksExamDate FROM dbo.Users WHERE Id=@id`, { id: req.userId });
  const examDates = { DGS: u.ExamDate ?? null, YKS: u.YksExamDate ?? null };
  res.json({ username: u.Username, email: u.Email, fullName: u.FullName ?? '', avatarUrl: u.AvatarUrl ?? null, targetUniversity: u.TargetUniversity ?? '', targetDepartment: u.TargetDepartment ?? '',
    examMode: u.ExamMode, examDates, examDate: examDates[u.ExamMode] });
}));

// Hesap bilgileri: ad soyad, e-posta, avatar. E-posta değişimi mevcut şifre ister (oturum çalınsa bile hesap devralınamaz).
const fullName = z.string().trim().max(80).regex(/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u, 'Ad soyad yalnızca harf, boşluk, nokta, kesme ve tire içerebilir').or(z.literal(''));
r.put('/profile/account', validate(z.object({
  fullName, avatarUrl: z.string().refine(isAvatar, 'Geçersiz avatar').nullable(),
  email: z.string().trim().toLowerCase().email().max(254), currentPassword: z.string().max(72).optional(),
}).strict()), wrap(async (req, res) => {
  const d = req.body;
  const [u] = await query(`SELECT Email, PasswordHash FROM dbo.Users WHERE Id=@id`, { id: req.userId });
  if (d.email !== u.Email.toLowerCase()) {
    if (!d.currentPassword || !(await bcrypt.compare(d.currentPassword, u.PasswordHash))) return res.status(403).json({ error: 'E-postayı değiştirmek için mevcut şifreni doğru girmelisin' });
  }
  try {
    await query(`UPDATE dbo.Users SET FullName=@f, AvatarUrl=@a, Email=@e, ProfileUpdatedAt=SYSUTCDATETIME() WHERE Id=@id`,
      { f: d.fullName || null, a: d.avatarUrl, e: d.email, id: req.userId });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) return res.status(409).json({ error: 'Bu e-posta başka bir hesapta kullanılıyor' });
    throw err;
  }
  res.json({ ok: true, fullName: d.fullName, email: d.email, avatarUrl: d.avatarUrl });
}));

// Kalıcı mod tercihi (navbar toggle): sunucuda saklanır, cihazlar arası senkron olur
r.put('/profile/mode', validate(z.object({ examMode: z.enum(EXAM_TYPES) }).strict()), wrap(async (req, res) => {
  await query(`UPDATE dbo.Users SET ExamMode=@m WHERE Id=@id`, { m: req.body.examMode, id: req.userId });
  res.json({ ok: true, examMode: req.body.examMode });
}));

r.put('/profile', validate(z.object({ targetUniversity: text(120), targetDepartment: text(120),
  examType: z.enum(EXAM_TYPES).optional(), examDate: examDate.nullable().optional() }).strict()), wrap(async (req, res) => {
  const { targetUniversity: tu, targetDepartment: td, examDate: ed } = req.body;
  const col = dateCol[req.body.examType ?? req.examMode] ?? 'ExamDate';
  await query(`UPDATE dbo.Users SET TargetUniversity=@tu, TargetDepartment=@td, ${col}=CASE WHEN @set=1 THEN CAST(@ed AS date) ELSE ${col} END WHERE Id=@id`,
    { tu: tu || null, td: td || null, set: ed === undefined ? 0 : 1, ed: ed ?? null, id: req.userId });
  res.json({ ok: true });
}));

/* ---------- Destek (bağış): IBAN + kullanıcıya özel açıklama kodu ---------- */
// IBAN bilgileri ortam değişkenlerinden gelir (SUPPORT_IBAN, SUPPORT_HOLDER, SUPPORT_BANK); tanımsızsa modül "yakında" gösterir.
const supportCode = id => `AUR-${id.toString(36).toUpperCase()}-${crypto.createHmac('sha256', config.jwtSecret).update('support:' + id).digest('hex').slice(0, 4).toUpperCase()}`;
r.get('/support', wrap(async (req, res) => {
  const { iban, holder, bank } = config.support;
  res.json({ configured: !!iban, iban: iban || null, holder: holder || null, bank: bank || null, code: supportCode(req.userId) });
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
