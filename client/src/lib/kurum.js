import { useEffect } from 'react';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const logoUrl = (inst) => inst?.hasLogo ? `${BASE}/api/kurum/logo/${inst.slug}?v=${inst.logoVersion}` : null;
export const isStaff = (u) => u?.role === 'owner' || u?.role === 'teacher';

// Kurum rengi: vurgu rengi (--accent, "r g b") ve üzerindeki yazı rengi (açık renkte koyu, koyu renkte beyaz)
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export function useBrandColor(hex) {
  useEffect(() => {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return;
    const [r, g, b] = rgb(hex), lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const el = document.documentElement.style;
    el.setProperty('--accent', `${r} ${g} ${b}`);
    el.setProperty('--onaccent', lum > 0.55 ? '9 10 15' : '255 255 255');
    return () => { el.removeProperty('--accent'); el.removeProperty('--onaccent'); };
  }, [hex]);
}

// CSV/metin dosyası: önce UTF-8, olmazsa Türkçe Excel'in ANSI (windows-1254) çıktısı
export async function readTextFile(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1254').decode(buf); }
}

// Excel (Türkçe ayar) doğru açsın diye ; ayracı + UTF-8 BOM
const cell = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function downloadCsv(name, rows) {
  const blob = new Blob(['﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const TEMPLATE_ROWS = [['Ad', 'Soyad', 'No', 'Sınıf'], ['Ayşe', 'Yılmaz', '101', '8-A'], ['Mehmet', 'Kaya', '102', '8-B']];
