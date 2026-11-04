import { Minus, Plus } from 'lucide-react';
import { REASONS, sumOf } from '../lib/reasons.js';

// Bir ders için "neden yanlış yaptım" dağılımı: toplam, yanlış sayısını aşamaz
export default function ReasonEditor({ title, wrong, value, onChange }) {
  const used = sumOf(value), left = wrong - used;
  const set = (key, n) => onChange({ ...value, [key]: Math.max(0, n) });
  return (
    <fieldset className="rounded-3xl border border-white/10 bg-white/[0.02] p-4">
      <legend className="px-2 text-sm font-medium text-slate-100">{title} <span className="text-xs text-slate-500">· {wrong} yanlış</span></legend>
      {wrong === 0 ? <p className="text-xs text-slate-500">Yanlış yok.</p> : (
        <>
          <ul className="space-y-2">{REASONS.map(r => (
            <li key={r.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-slate-300"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.label}</span>
              <span className="flex items-center gap-2">
                <button type="button" className="btn-ghost !p-1.5" aria-label={`${r.label} azalt`} disabled={!value[r.key]} onClick={() => set(r.key, (value[r.key] ?? 0) - 1)}><Minus size={13} /></button>
                <output className="num w-6 text-center text-slate-100" aria-label={`${r.label} sayısı`}>{value[r.key] ?? 0}</output>
                <button type="button" className="btn-ghost !p-1.5" aria-label={`${r.label} artır`} disabled={left <= 0} onClick={() => set(r.key, (value[r.key] ?? 0) + 1)}><Plus size={13} /></button>
              </span>
            </li>))}</ul>
          <p className="num mt-3 text-xs text-slate-500" role="status">Nedeni belirtilmeyen: {left}</p>
        </>)}
    </fieldset>
  );
}
