import express from 'express';
import compression from 'compression';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { publicConfig } from './exams.js';
import { apiLimiter, originGuard, errorHandler } from './security.js';
import auth from './routes/auth.js';
import friends from './routes/friends.js';
import study from './routes/study.js';
import social from './routes/social.js';
import admin from './routes/admin.js';
import profile from './routes/profile.js';
import kurum from './routes/kurum.js';
import odev from './routes/odev.js';
import duyuru from './routes/duyuru.js';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(compression());
// Avatarlar api.dicebear.com'dan SVG olarak yüklenir; diğer varsayılanlar korunur.
// 3B sahneler: meshopt çözücüsü WebAssembly kullanır ('wasm-unsafe-eval' yalnızca WASM derlemeye izin verir, eval()'i açmaz);
// GLB içindeki dokular blob: adresiyle çözülür (img-src/connect-src).
app.use(helmet({ contentSecurityPolicy: { directives: {
  ...helmet.contentSecurityPolicy.getDefaultDirectives(),
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https://api.dicebear.com'],
  'connect-src': ["'self'", 'blob:'],
} } }));
// Aynı kaynaktan (Origin host'u = istek Host'u) ya da CORS_ORIGINS listesinden gelen istekler geçer. Listede olmayan kaynağa hata FIRLATILMAZ:
// tarayıcı <script type="module"> isteğine Origin ekler; www./IP/eski alan adıyla açılan sitede varlıklar 500 verip sayfa tamamen boş kalıyordu.
// Başka kaynaktan çağrıda yalnızca CORS başlıkları verilmez (tarayıcı yanıtı okutmaz); durum değiştirenleri originGuard 403 ile reddeder.
export const sameOrigin = (req) => { const o = req.headers.origin; if (!o) return false; try { return new URL(o).host === req.headers.host; } catch { return false; } };
app.use(cors((req, cb) => cb(null, { origin: !req.headers.origin || sameOrigin(req) || config.origins.includes(req.headers.origin), credentials: true })));
// Kurum içe aktarma (yüzlerce öğrenci) ve toplu kişisel ödev (≤200 öğrenci × ≤60 madde) için daha büyük gövde; yalnızca bu yollarda. Genel ayrıştırıcı zaten ayrışmış gövdeyi atlar.
app.use('/api/kurum', express.json({ limit: '256kb' }));
app.use('/api/odev', express.json({ limit: '1mb' }));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
// İndekslenecek herkese açık sayfalar (client/public/sitemap.xml ile aynı). Diğer her yol (API, panel, giriş, kayıt, bilinmeyen) noindex:
// JS çalıştırmayan tarayıcılar için de geçerli olsun diye meta etiketine ek olarak başlıkla da bildirilir.
const INDEXABLE = new Set(['/', '/gizlilik', '/kvkk', '/kosullar', '/cerez', '/robots.txt', '/sitemap.xml', '/favicon.svg', '/og-image.png', '/apple-touch-icon.png']);
app.use((req, res, next) => {
  if (!INDEXABLE.has(req.path) && !req.path.startsWith('/assets/')) res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});
// Kişisel veriler: tarayıcı/ara önbellek asla saklamasın
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api', apiLimiter, originGuard);

app.get('/api/health', (req, res) => res.json({ ok: true }));
// Sınav türleri, bölümler, soru sayıları ve müfredat (herkese açık, kişisel veri yok)
const examConfig = publicConfig();
app.get('/api/exams-config', (req, res) => res.json(examConfig));
app.use('/api/auth', auth);
app.use('/api/friends', friends);
app.use('/api', study);
app.use('/api', social);
app.use('/api', profile);
app.use('/api/admin', admin);
app.use('/api/kurum', kurum);
app.use('/api/odev', odev);
app.use('/api/duyuru', duyuru);

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
  // Olmayan dosya (yeni yayından sonra silinen eski hash'li /assets/*.js vb.) index.html OLARAK dönmesin: tarayıcı "geçersiz MIME" hatasıyla çöker.
  // Gerçek 404 dönünce istemci bunu algılayıp sayfayı yeniler (main.jsx → vite:preloadError).
  app.get(/^\/(assets\/.*|.*\.(js|mjs|css|map|png|jpe?g|svg|webp|ico|woff2?|json|txt|xml))$/i, (req, res) => res.status(404).type('text/plain').set('Cache-Control', 'no-store').send('Bulunamadı'));
  app.get(/^\/(?!api\/).*/, (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')); });
}

app.use((req, res) => res.status(404).json({ error: 'Bulunamadı' }));
app.use(errorHandler);
