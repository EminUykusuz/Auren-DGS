import 'dotenv/config';
import crypto from 'node:crypto';

const isProd = process.env.NODE_ENV === 'production';
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProd) throw new Error('JWT_SECRET zorunlu (production).');
  jwtSecret = crypto.randomBytes(48).toString('hex'); // dev: her açılışta yeni
  console.warn('[uyarı] JWT_SECRET tanımsız; geçici anahtar üretildi.');
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 5050,
  jwtSecret,
  jwtTtl: '7d',
  cookieName: 'dgs_token',
  origins: (process.env.CORS_ORIGINS || 'http://localhost:5050,http://127.0.0.1:5050,http://localhost:5173,http://127.0.0.1:5173').split(',').map(s => s.trim()),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  bcryptRounds: 12,
  resetTtlMinutes: 15,
  mail: {
    host: process.env.SMTP_HOST || '', port: Number(process.env.SMTP_PORT) || 587, secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '', to: process.env.FEEDBACK_TO || '',
  },
  db: {
    database: process.env.DB_NAME || 'DgsTouch',
    server: process.env.DB_SERVER || 'localhost',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
  },
};
