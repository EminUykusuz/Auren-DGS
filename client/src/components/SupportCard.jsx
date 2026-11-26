import { useEffect, useState } from 'react';
import { Heart, Copy, Check, ChevronDown } from 'lucide-react';
import { get } from '../lib/api.js';
import { Item } from './ui.jsx';

const group4 = (iban) => iban.replace(/(.{4})/g, '$1 ').trim();

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
  }
}

function CopyRow({ label, value, shown = value, mono = true }) {
  const [done, setDone] = useState(false);
  const copy = async () => { if (await copyText(value)) { setDone(true); setTimeout(() => setDone(false), 1800); } };
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <div className="min-w-0"><div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
        <div className={`mt-0.5 break-all text-sm text-slate-50 ${mono ? 'num font-medium tracking-wide' : ''}`}>{shown}</div></div>
      <button type="button" onClick={copy} className="btn-ghost shrink-0 !px-3 !py-1.5 text-xs" aria-label={`${label} kopyala`}>
        {done ? <><Check size={13} /> Kopyalandı</> : <><Copy size={13} /> Kopyala</>}</button>
    </div>
  );
}

// IBAN ile destek: bilgiler sunucudan gelir; açıklama kodu kullanıcıya özeldir (desteğin kime ait olduğunu eşleştirmek için).
// compact: Panel gibi alanlarda açılır/kapanır küçük kart.
export default function SupportCard({ compact = false }) {
  const [d, setD] = useState(null); const [open, setOpen] = useState(!compact);
  useEffect(() => { get('/support').then(setD).catch(() => setD({ configured: false })); }, []);
  if (!d) return null;

  const body = d.configured ? (
    <div className="space-y-2.5">
      <p className="text-sm leading-relaxed text-slate-300">Auren Study ücretsiz ve reklamsız kalsın diye geliştirilmeye devam ediyor. Destek olmak istersen aşağıdaki IBAN'a havale/EFT yaparken <b className="text-slate-100">açıklama kısmına kodunu</b> yaz; desteğin sana ait olarak eşleşsin.</p>
      <CopyRow label="IBAN" value={d.iban} shown={group4(d.iban)} />
      {(d.holder || d.bank) && <div className="px-1 text-xs text-slate-400">{[d.holder && `Alıcı: ${d.holder}`, d.bank].filter(Boolean).join(' · ')}</div>}
      <CopyRow label="Açıklama kodun" value={d.code} />
      <p className="px-1 text-xs text-slate-500">Destek tamamen isteğe bağlıdır; uygulamanın hiçbir özelliği buna bağlı değildir. Teşekkürler 💚</p>
    </div>
  ) : <p className="text-sm text-slate-400">Destek bilgileri çok yakında burada olacak. İlgin için teşekkürler!</p>;

  if (compact) return (
    <Item className="card !py-3">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="stat-label flex items-center gap-2"><Heart size={13} className="text-rose-400" /> Auren Study'ye destek ol</span>
        <ChevronDown size={16} className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" /></button>
      {open && <div className="mt-3">{body}</div>}
    </Item>
  );
  return (
    <Item className="card">
      <div className="stat-label mb-4 flex items-center gap-2"><Heart size={13} className="text-rose-400" /> Auren Study'ye destek ol</div>
      {body}
    </Item>
  );
}
