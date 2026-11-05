import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { config } from './config.js';
import { query } from './db.js';

export const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: Number(process.env.AUTH_RATE_LIMIT) || 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.' } });
export const apiLimiter = rateLimit({ windowMs: 60_000, limit: 200, standardHeaders: true, legacyHeaders: false });

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
    const [u] = await query(`SELECT Id, IsAdmin, IsDisabled FROM dbo.Users WHERE Id=@id`, { id: sub });
    if (!u || u.IsDisabled) return res.status(401).json({ error: 'Oturum geçersiz' });
    req.userId = u.Id; req.isAdmin = !!u.IsAdmin;
    next();
  } catch { res.status(401).json({ error: 'Oturum geçersiz' }); }
}

export const requireAdmin = [requireAuth, (req, res, next) =>
  req.isAdmin ? next() : res.status(404).json({ error: 'Bulunamadı' })];

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
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası' });
}
