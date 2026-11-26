import jwt from 'jsonwebtoken';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ZodError } from 'zod';
import { config } from './config.js';
import { query } from './db.js';
import { isExamType } from './exams.js';
import { isStaff } from './kurum-lib.js';

export const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: Number(process.env.AUTH_RATE_LIMIT) || 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.' } });
// Dershane/okul ağında onlarca öğrenci aynı IP'den bağlanır → IP başına sınırlar buna göre geniştir
export const apiLimiter = rateLimit({ windowMs: 60_000, limit: Number(process.env.API_RATE_LIMIT) || 600, standardHeaders: true, legacyHeaders: false });
// Giriş: kaba kuvvet koruması IP + hesap bazlıdır (aynı IP'den farklı öğrenciler birbirini kilitlemez); IP başına genel üst sınır ayrıca
const loginKey = (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.identifier ?? '').toLowerCase().slice(0, 254)}`;
export const loginLimiter = [
  rateLimit({ windowMs: 15 * 60_000, limit: Number(process.env.LOGIN_IP_RATE_LIMIT) || 400, standardHeaders: true, legacyHeaders: false, message: { error: 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.' } }),
  rateLimit({ windowMs: 15 * 60_000, limit: Number(process.env.AUTH_RATE_LIMIT) || 10, keyGenerator: loginKey, standardHeaders: true, legacyHeaders: false, message: { error: 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.' } }),
];
// Oturum açmış kullanıcı başına (şifre değiştirme vb.)
export const userLimiter = rateLimit({ windowMs: 15 * 60_000, limit: Number(process.env.AUTH_RATE_LIMIT) || 10, keyGenerator: (req) => `u${req.userId}`, standardHeaders: true, legacyHeaders: false, message: { error: 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.' } });

export function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.jwtTtl, algorithm: 'HS256' });
  res.cookie(config.cookieName, token, { httpOnly: true, secure: config.cookieSecure, sameSite: config.cookieSameSite, maxAge: 7 * 864e5, path: '/' });
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[config.cookieName];
    if (!token) return res.status(401).json({ error: 'Oturum gerekli' });
    const { sub } = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    // Yetki her istekte veritabanından okunur: askıya alınan / yetkisi alınan kullanıcı anında etkilenir
    const [u] = await query(`SELECT u.Id, u.IsAdmin, u.IsDisabled, u.ExamMode, u.ExamTrack, u.Role, u.InstitutionId, u.ClassId, u.MustChangePassword, i.IsActive AS InstActive
      FROM dbo.Users u LEFT JOIN dbo.Institutions i ON i.Id = u.InstitutionId WHERE u.Id=@id`, { id: sub });
    // Pasife alınan kurumun tüm kullanıcıları anında oturum dışı kalır
    if (!u || u.IsDisabled || (u.InstitutionId != null && !u.InstActive)) return res.status(401).json({ error: 'Oturum geçersiz' });
    req.userId = u.Id; req.isAdmin = !!u.IsAdmin; req.examMode = u.ExamMode; req.examTrack = u.ExamTrack;
    req.role = u.Role ?? 'student'; req.institutionId = u.InstitutionId ?? null; req.classId = u.ClassId ?? null; req.mustChangePassword = !!u.MustChangePassword;
    // Geçici şifreyle giren kullanıcı şifresini değiştirmeden başka hiçbir şey yapamaz (yalnız /api/auth/*)
    if (req.mustChangePassword && !req.originalUrl.startsWith('/api/auth/')) return res.status(403).json({ error: 'Önce şifrenizi değiştirin', code: 'PASSWORD_CHANGE_REQUIRED' });
    next();
  } catch { res.status(401).json({ error: 'Oturum geçersiz' }); }
}

export const requireAdmin = [requireAuth, (req, res, next) =>
  req.isAdmin ? next() : res.status(404).json({ error: 'Bulunamadı' })];

// Kurum personeli (yönetici/öğretmen): kurumsuz hesap veya öğrenci için 404 (panelin varlığı sızdırılmaz)
export const requireStaff = [requireAuth, (req, res, next) =>
  isStaff(req.role) && req.institutionId ? next() : res.status(404).json({ error: 'Bulunamadı' })];
export const requireOwner = [requireAuth, (req, res, next) =>
  req.role === 'owner' && req.institutionId ? next() : res.status(404).json({ error: 'Bulunamadı' })];

// Öğretmenin atandığı sınıf kimlikleri (owner için gerekmez)
export async function assignedClassIds(userId) {
  return (await query(`SELECT ClassId FROM dbo.TeacherClasses WHERE TeacherId=@id`, { id: userId })).map(r => r.ClassId);
}

// CSRF ek savunması: durum değiştiren isteklerde Origin beyaz listede olmalı
export function originGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const o = req.headers.origin;
  if (o && !config.origins.includes(o)) return res.status(403).json({ error: 'Yasak' });
  next();
}

export async function areFriends(a, b) {
  const r = await query(
    `SELECT 1 AS ok FROM dbo.Friendships WHERE Status='accepted' AND PairLow=@lo AND PairHigh=@hi`,
    { lo: Math.min(a, b), hi: Math.max(a, b) });
  return r.length > 0;
}

// Anti-IDOR: arkadaş değilse 404 (kullanıcının varlığı sızdırılmaz)
export const requireFriend = (param) => async (req, res, next) => {
  try {
    const other = Number(req.params[param]);
    if (!Number.isInteger(other) || other === req.userId || !(await areFriends(req.userId, other)))
      return res.status(404).json({ error: 'Bulunamadı' });
    req.otherId = other;
    next();
  } catch (e) { next(e); }
};

export const validate = (schema, where = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[where]);
  if (!r.success) return res.status(400).json({ error: 'Geçersiz veri', details: r.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
  // Express 5'te req.query salt okunur bir getter'dır; doğrulanmış veriyle üzerine yazılır
  Object.defineProperty(req, where, { value: r.data, writable: true, configurable: true, enumerable: true });
  next();
};

export const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) return res.status(400).json({ error: 'Geçersiz veri' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Geçersiz JSON' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Dosya çok büyük' });
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası' });
}

// Sınav türü: ?examType= (GET/DELETE) veya gövdedeki examType; yoksa kullanıcının kayıtlı modu.
// Geçersiz değer sessizce yok sayılmaz, 400 döner.
export function resolveExam(req, res, next) {
  const raw = req.query?.examType ?? req.body?.examType;
  if (raw !== undefined && !isExamType(raw)) return res.status(400).json({ error: 'Geçersiz sınav türü' });
  // Tek sınava kayıtlı hesap yalnızca o sınavın verisine erişir; hibrit hesap ikisi arasında geçebilir
  const t = req.examTrack;
  req.examType = (t === 'DGS' || t === 'YKS') ? t : (raw ?? req.examMode ?? 'DGS');
  next();
}
