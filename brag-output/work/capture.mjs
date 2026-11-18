// Kare yakalama: her kare, zamanın saf bir fonksiyonu (window.seek(t)). Kullanım:
//   node capture.mjs stills 0.5 2 4.8 ...   -> stills/t_XX.XX.png
//   node capture.mjs render [fps=30]        -> frames/f_0000.png ...
import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const [mode, ...rest] = process.argv.slice(2);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const here = path.resolve('.');
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars', '--font-render-hinting=none'] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERROR', e.message));
page.on('console', m => m.type() === 'error' && console.error('CONSOLE', m.text()));
await page.goto(pathToFileURL(path.join(here, 'video.html')).href, { waitUntil: 'load' });
await page.evaluate(async () => { await Promise.all([400, 500, 600, 700, 800].map(w => document.fonts.load(`${w} 40px Inter`, 'Çalışmanı ğüşiöı İ'))); await document.fonts.ready; });

const shot = async (t, file) => { await page.evaluate(t => window.seek(t), t); await page.screenshot({ path: file, type: 'png' }); };

if (mode === 'stills') {
  mkdirSync('stills', { recursive: true });
  for (const t of rest.map(Number)) await shot(t, `stills/t_${t.toFixed(2).padStart(5, '0')}.png`);
} else if (mode === 'render') {
  const fps = Number(rest[0] || 30); const dur = await page.evaluate(() => window.DURATION); const n = Math.round(dur * fps); const from = Number(rest[1] || 0), to = Math.min(n, Number(rest[2] || n));
  mkdirSync('frames', { recursive: true });
  for (let i = from; i < to; i++) { await shot(i / fps, `frames/f_${String(i).padStart(4, '0')}.png`); if (i % 60 === 0) console.log(`kare ${i}/${n}`); }
  console.log('bitti', n);
}
await browser.close();
