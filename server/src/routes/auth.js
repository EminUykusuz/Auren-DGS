import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { query, tx } from '../db.js';
import { authLimiter, loginLimiter, userLimiter, setAuthCookie, requireAuth, validate, wrap } from '../security.js';

const r = Router();
const username = z.string().trim().regex(/^[\p{L}\p{N}_.-]{3,30}$/u, 'Kullanıcı adı: 3-30 karakter; harf, rakam, _ . - kullanılabilir (boşluk olmaz)');
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8, 'En az 8 karakter').max(72, 'En fazla 72 karakter')
  .regex(/[A-Za-z]/, 'Harf içermeli').regex(/\d/, 'Rakam içermeli');

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const DUMMY_HASH = bcrypt.hashSync('dummy-password-1', config.bcryptRounds); // zamanlama eşitleme
// Kurum öğrencisinin yer tutucu e-postası arayüzde gösterilmez
const isPlaceholderEmail = e => typeof e === 'string' && e.endsWith('@ogrenci.invalid');
const pub = u => ({ id: u.Id, username: u.Username, email: isPlaceholderEmail(u.Email) ? null : u.Email, isAdmin: !!u.IsAdmin, examMode: u.ExamMode ?? 'DGS', examTrack: u.ExamTrack ?? 'BOTH', fullName: u.FullName ?? '', avatarUrl: u.AvatarUrl ?? null,
  role: u.Role ?? 'student', mustChangePassword: !!u.MustChangePassword, classId: u.ClassId ?? null,
  institution: u.InstitutionId ? { id: u.InstitutionId, name: u.InstName, slug: u.InstSlug, color: u.InstColor ?? null, logoVersion: u.InstLogoVersion ?? 0, hasLogo: (u.InstLogoVersion ?? 0) > 0 } : null });
// pub() için gereken sütunlar (kurum markası dahil)
const USER_COLS = `u.Id, u.Username, u.Email, u.IsAdmin, u.ExamMode, u.ExamTrack, u.FullName, u.AvatarUrl, u.Role, u.InstitutionId, u.ClassId, u.MustChangePassword,
  i.Name AS InstName, i.Slug AS InstSlug, i.PrimaryColor AS InstColor, i.LogoVersion AS InstLogoVersion`;
const USER_FROM = `dbo.Users u LEFT JOIN dbo.Institutions i ON i.Id = u.InstitutionId`;

r.post('/register', authLimiter, validate(z.object({ username, email, password, examTrack: z.enum(['DGS', 'YKS', 'BOTH']).default('BOTH'), examMode: z.enum(['DGS', 'YKS']).optional() })), wrap(async (req, res) => {
  const { username: u, email: e, password: p, examTrack: t } = req.body;
  const x = t === 'BOTH' ? (req.body.examMode ?? 'DGS') : t;   // tek sınav seçildiyse mod sabittir; hibritte başlangıç modu
  const h = await bcrypt.hash(p, config.bcryptRounds);
  try {
    const [row] = await query(`INSERT INTO dbo.Users (Username, Email, PasswordHash, ExamMode, ExamTrack) OUTPUT INSERTED.Id VALUES (@u,@e,@h,@x,@t)`, { u, e, h, x, t });
    setAuthCookie(res, row.Id);
    res.status(201).json({ user: { id: row.Id, username: u, email: e, examMode: x, examTrack: t } });
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) return res.status(409).json({ error: 'Kullanıcı adı veya e-posta kullanımda' });
    throw err;
  }
}));

r.post('/login', ...loginLimiter, validate(z.object({ identifier: z.string().trim().min(1).max(254), password: z.string().min(1).max(72) })), wrap(async (req, res) => {
  const { identifier, password: p } = req.body;
  const [u] = await query(`SELECT ${USER_COLS}, u.PasswordHash, u.IsDisabled, i.IsActive AS InstActive FROM ${USER_FROM} WHERE u.Email=@i OR u.Username=@i`, { i: identifier });
  const ok = await bcrypt.compare(p, u?.PasswordHash ?? DUMMY_HASH);
  if (!u || !ok || u.IsDisabled || (u.InstitutionId != null && !u.InstActive)) return res.status(401).json({ error: 'Kullanıcı adı/e-posta veya şifre hatalı' });
  await query(`UPDATE dbo.Users SET LastLoginAt=SYSUTCDATETIME() WHERE Id=@id`, { id: u.Id });
  setAuthCookie(res, u.Id);
  res.json({ user: pub(u) });
}));

r.post('/logout', (req, res) => { res.clearCookie(config.cookieName, { path: '/', secure: config.cookieSecure, sameSite: config.cookieSameSite }); res.json({ ok: true }); });

r.get('/me', requireAuth, wrap(async (req, res) => {
  const [u] = await query(`SELECT ${USER_COLS} FROM ${USER_FROM} WHERE u.Id=@id`, { id: req.userId });
  if (!u) return res.status(401).json({ error: 'Oturum geçersiz' });
  res.json({ user: pub(u) });
}));

// Şifre değiştirme (kurum öğrencisinin ilk girişteki zorunlu değişimi dahil)
r.post('/change-password', requireAuth, userLimiter, validate(z.object({ currentPassword: z.string().min(1).max(72), newPassword: password }).strict()), wrap(async (req, res) => {
  const [u] = await query(`SELECT PasswordHash FROM dbo.Users WHERE Id=@id`, { id: req.userId });
  if (!u || !(await bcrypt.compare(req.body.currentPassword, u.PasswordHash))) return res.status(403).json({ error: 'Mevcut şifre yanlış' });
  if (req.body.currentPassword === req.body.newPassword) return res.status(400).json({ error: 'Yeni şifre eskisinden farklı olmalı' });
  const h = await bcrypt.hash(req.body.newPassword, config.bcryptRounds);
  await query(`UPDATE dbo.Users SET PasswordHash=@h, MustChangePassword=0 WHERE Id=@id`, { h, id: req.userId });
  res.json({ ok: true });
}));

// Kullanıcı numaralandırmayı önlemek için her zaman aynı yanıt.
r.post('/forgot-password', authLimiter, validate(z.object({ email })), wrap(async (req, res) => {
  const [u] = await query(`SELECT Id FROM dbo.Users WHERE Email=@e`, { e: req.body.email });
  if (u) {
    const token = crypto.randomBytes(32).toString('base64url');
    const th = sha256(token);
    const m = config.resetTtlMinutes;
    await tx(async q => {
      await q(`UPDATE dbo.PasswordResets SET IsUsed=1 WHERE UserId=@id AND IsUsed=0`, { id: u.Id });
      await q(`INSERT INTO dbo.PasswordResets (UserId, TokenHash, ExpiresAt) VALUES (@id,@th,DATEADD(minute,@m,SYSUTCDATETIME()))`, { id: u.Id, th, m });
      await q(`UPDATE dbo.Users SET ResetTokenHash=@th, ResetTokenExpires=DATEADD(minute,@m,SYSUTCDATETIME()) WHERE Id=@id`, { id: u.Id, th, m });
    });
    // SMTP entegrasyonu yok: bağlantı yalnızca geliştirme konsoluna yazılır.
    if (!config.isProd) console.log(`[şifre sıfırlama] ${config.appUrl}/reset-password?token=${token}`);
  } else {
    await bcrypt.compare('x', DUMMY_HASH); // zamanlama benzerliği
  }
  res.json({ message: 'E-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi.' });
}));

r.post('/reset-password', authLimiter, validate(z.object({ token: z.string().min(20).max(100), password })), wrap(async (req, res) => {
  const th = sha256(req.body.token);
  const h = await bcrypt.hash(req.body.password, config.bcryptRounds);
  const done = await tx(async q => {
    // Atomik tüketim: yalnızca kullanılmamış ve süresi dolmamış token
    const used = await q(
      `UPDATE dbo.PasswordResets SET IsUsed=1 OUTPUT INSERTED.UserId
       WHERE TokenHash=@th AND IsUsed=0 AND ExpiresAt > SYSUTCDATETIME()`, { th });
    if (!used.length) return false;
    await q(`UPDATE dbo.Users SET PasswordHash=@h, ResetTokenHash=NULL, ResetTokenExpires=NULL WHERE Id=@id`, { h, id: used[0].UserId });
    return true;
  });
  if (!done) return res.status(400).json({ error: 'Bağlantı geçersiz veya süresi dolmuş' });
  res.json({ message: 'Şifre güncellendi' });
}));

export default r;
