import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Ön ayarlar: swatch yalnızca ayarlar ekranındaki önizleme içindir
export const THEMES = [
  { id: 'obsidian', label: 'Derin Obsidyen', dark: true,  swatch: ['#090A0F', '#10B981', '#06B6D4'] },
  { id: 'emerald',  label: 'Siberpunk Zümrüt', dark: true, swatch: ['#030C0A', '#34D399', '#A3E635'] },
  { id: 'midnight', label: 'Gece Mavisi', dark: true,    swatch: ['#080C1C', '#3B82F6', '#38BDF8'] },
  { id: 'light',    label: 'Temiz Açık', dark: false,    swatch: ['#F1F5F9', '#059669', '#0891B2'] },
];
const ids = THEMES.map(t => t.id);

// Hazır duvar kâğıtları (CSS gradyan; dış bağlantı yok, çevrimdışı çalışır)
export const BACKGROUNDS = [
  { id: 'none',   label: 'Yok',          css: null },
  { id: 'aurora', label: 'Aurora',       css: 'radial-gradient(60% 50% at 20% 15%, #10b98155, transparent), radial-gradient(55% 50% at 85% 20%, #06b6d444, transparent), linear-gradient(160deg, #04141a, #08201f 55%, #05100f)' },
  { id: 'ocean',  label: 'Okyanus',      css: 'radial-gradient(70% 60% at 80% 10%, #3b82f655, transparent), radial-gradient(60% 60% at 10% 90%, #0ea5e944, transparent), linear-gradient(170deg, #050b1f, #0a1a3a 60%, #050b1f)' },
  { id: 'dusk',   label: 'Gün batımı',   css: 'radial-gradient(60% 55% at 85% 85%, #f9731655, transparent), radial-gradient(55% 55% at 10% 10%, #a855f755, transparent), linear-gradient(160deg, #150a22, #26112e 55%, #1a0b17)' },
  { id: 'forest', label: 'Orman',        css: 'radial-gradient(60% 60% at 30% 20%, #84cc1633, transparent), radial-gradient(60% 60% at 80% 80%, #05966955, transparent), linear-gradient(160deg, #06120a, #0b2214 60%, #050d07)' },
  { id: 'mist',   label: 'Mor sis',      css: 'radial-gradient(60% 60% at 70% 20%, #818cf855, transparent), radial-gradient(60% 60% at 20% 80%, #c084fc44, transparent), linear-gradient(160deg, #0d0b1f, #1a1538 60%, #0b0a1a)' },
];
export const bgCss = (s) => s.bg === 'custom' ? (s.bgImage ? `url(${s.bgImage})` : null) : (BACKGROUNDS.find(b => b.id === s.bg)?.css ?? null);

// Seçilen görseli küçültüp JPEG data URL'e çevirir (localStorage kotasını korur).
// NOT: createObjectURL (blob:) kullanılmaz; sunucunun CSP img-src kuralı blob:'u engelleyip "okunamadı" hatası verir.
const decode = (file) => {
  if (window.createImageBitmap) return createImageBitmap(file).catch(() => viaReader(file));
  return viaReader(file);
};
const viaReader = (file) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onerror = () => reject(new Error('Dosya okunamadı, tekrar dene.'));
  fr.onload = () => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('unsupported')); img.src = fr.result; };
  fr.readAsDataURL(file);
});

export async function fileToBg(file, max = 1600) {
  if (!file) throw new Error('Dosya seçilmedi.');
  if (file.type && !file.type.startsWith('image/')) throw new Error('Lütfen bir görsel dosyası seç.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Görsel çok büyük (en fazla 25 MB).');
  let img;
  try { img = await decode(file); }
  catch (e) {
    if (/heic|heif/i.test(file.type + file.name)) throw new Error('HEIC biçimi tarayıcıda açılamıyor. JPG, PNG veya WebP seç.');
    throw new Error(e.message === 'unsupported' || !e.message ? 'Bu görsel biçimi desteklenmiyor. JPG, PNG veya WebP dene.' : e.message);
  }
  const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
  let k = Math.min(1, max / Math.max(w, h)), q = 0.78, out;
  const c = document.createElement('canvas'), g = c.getContext('2d');
  // localStorage kotası için ~1,2 MB altına inene kadar kalite/boyut düşür
  for (let i = 0; i < 5; i++) {
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    g.drawImage(img, 0, 0, c.width, c.height);
    out = c.toDataURL('image/jpeg', q);
    if (out.length <= 1_200_000) break;
    q = Math.max(0.45, q - 0.12); k *= 0.82;
  }
  img.close?.();
  if (out.length > 2_500_000) throw new Error('Görsel çok büyük, daha küçük bir dosya dene.');
  return out;
}

export function applyTheme({ theme, glow, perf }) {
  const el = document.documentElement;
  el.dataset.theme = theme; el.dataset.glow = glow ? 'on' : 'off'; el.dataset.perf = perf ? 'on' : 'off';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', { obsidian: '#090A0F', emerald: '#030C0A', midnight: '#080C1C', light: '#F1F5F9' }[theme] ?? '#090A0F');
}

export const useTheme = create(persist((set, get) => ({
  theme: 'obsidian', lastDark: 'obsidian', glow: true, perf: false, bg: 'none', bgImage: null,
  setTheme: (theme) => set(s => ({ theme: ids.includes(theme) ? theme : s.theme, lastDark: theme !== 'light' && ids.includes(theme) ? theme : s.lastDark })),
  setGlow: (glow) => set({ glow: !!glow }),
  setPerf: (perf) => set({ perf: !!perf }),
  setBg: (bg) => set({ bg }),
  setCustomBg: (bgImage) => set({ bg: 'custom', bgImage }),
  clearBg: () => set({ bg: 'none', bgImage: null }),
  toggleMode: () => { const s = get(); set({ theme: s.theme === 'light' ? s.lastDark : 'light' }); },
}), {
  name: 'dgs_theme', version: 1,
  merge: (saved, cur) => ({ ...cur, ...saved, theme: ids.includes(saved?.theme) ? saved.theme : 'obsidian' }),
}));

// İlk boyamadan önce uygula, değişimleri izle
applyTheme(useTheme.getState());
useTheme.subscribe(applyTheme);
