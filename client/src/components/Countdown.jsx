import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { get } from '../lib/api.js';
import { Item } from './ui.jsx';

// Kullanıcı tarih girmediyse bir sonraki 19 Temmuz (tahmini); ÖSYM kesin tarihi açıklayınca Ayarlar'dan güncellenir
function nextJuly19(now = new Date()) {
  const t = new Date(now.getFullYear(), 6, 19); return t > now ? t : new Date(now.getFullYear() + 1, 6, 19);
}
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };   // yerel gece yarısı
const pad = n => String(n).padStart(2, '0');

export default function Countdown() {
  const [date, setDate] = useState(undefined);   // undefined: yükleniyor, null: tarih girilmemiş
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { get('/profile').then(p => setDate(p.examDate ?? null)).catch(() => setDate(null)); }, []);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  if (date === undefined) return <div className="card min-h-[132px]" role="status" aria-label="Yükleniyor" />;
  const target = date ? parse(date) : nextJuly19(now);
  const ms = target - now, over = ms <= 0;
  const s = Math.max(0, Math.floor(ms / 1000));
  const cells = [['Gün', Math.floor(s / 86400)], ['Saat', Math.floor(s / 3600) % 24], ['Dakika', Math.floor(s / 60) % 60], ['Saniye', s % 60]];
  const label = target.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Item className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="stat-label flex items-center gap-2"><CalendarClock size={13} className="text-cyan2" /> DGS'ye kalan zaman</div>
        <div className="text-xs text-slate-500">{label}{!date && ' · tahmini'} · <Link to="/ayarlar" className="text-cyan2">{date ? 'Değiştir' : 'Kesin tarihi gir'}</Link></div>
      </div>
      {over ? <p className="py-4 text-center text-lg font-semibold text-slate-50">Sınav günü geldi, başarılar! 🍀</p> : (
        <div className="grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-label={`Sınava ${cells[0][1]} gün ${cells[1][1]} saat ${cells[2][1]} dakika kaldı`}>
          {cells.map(([l, v], i) => (
            <div key={l} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] py-3 text-center">
              <div aria-hidden="true" className={`num text-3xl font-semibold tracking-tight sm:text-4xl ${i === 0 ? 'text-accent' : 'text-slate-50'}`}>{i === 0 ? v : pad(v)}</div>
              <div aria-hidden="true" className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-400">{l}</div>
            </div>))}
        </div>)}
    </Item>
  );
}
