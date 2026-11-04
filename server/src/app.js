import express from 'express';
import compression from 'compression';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { DGS_TOPIC_GROUPS } from './curriculum.js';
import { apiLimiter, originGuard, errorHandler } from './security.js';
import auth from './routes/auth.js';
import friends from './routes/friends.js';
import study from './routes/study.js';
import social from './routes/social.js';
import admin from './routes/admin.js';
import profile from './routes/profile.js';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(compression());
app.use(helmet());
app.use(cors({
  origin: (o, cb) => (!o || config.origins.includes(o)) ? cb(null, true) : cb(new Error('CORS')),
  credentials: true,
}));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
// Kişisel veriler: tarayıcı/ara önbellek asla saklamasın
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api', apiLimiter, originGuard);

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/curriculum', (req, res) => res.json(DGS_TOPIC_GROUPS));
app.use('/api/auth', auth);
app.use('/api/friends', friends);
app.use('/api', study);
app.use('/api', social);
app.use('/api', profile);
app.use('/api/admin', admin);

// Derlenmiş istemci (client/dist) varsa aynı portta sun: sıkıştırma + uzun süreli önbellek
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  // Derleme sırasında üretilen .br/.gz dosyalarını doğrudan sun (çalışma anında sıkıştırma maliyeti yok)
  app.get('/assets/*splat', (req, res, next) => {
    const enc = String(req.headers['accept-encoding'] || '');
    const pick = enc.includes('br') ? ['br', '.br'] : enc.includes('gzip') ? ['gzip', '.gz'] : null;
    const file = path.join(dist, req.path);
    if (!pick || !file.startsWith(dist) || !fs.existsSync(file + pick[1])) return next();
    res.set({ 'Content-Encoding': pick[0], 'Vary': 'Accept-Encoding', 'Cache-Control': 'public, max-age=31536000, immutable' });
    res.type(path.extname(file)).sendFile(file + pick[1]);
  });
  app.use(express.static(dist, {
    index: false, etag: true,
    setHeaders: (res, file) => {
      // /assets/* içerik hash'li: değişmez → 1 yıl; diğerleri her seferinde doğrulanır
      res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
    },
  }));
  app.get(/^\/(?!api\/).*/, (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')); });
}

app.use((req, res) => res.status(404).json({ error: 'Bulunamadı' }));
app.use(errorHandler);
