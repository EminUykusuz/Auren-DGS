import { useState } from 'react';
import { Download, Copy, Check, TriangleAlert, X } from 'lucide-react';
import { downloadCsv } from '../lib/kurum.js';

// Geçici giriş bilgileri: şifreler yalnızca bir kez gösterilir → indir/kopyala vurgulanır.
// rows: [{ fullName, username, password, className?, studentNo? }]
export default function Credentials({ rows, title = 'Giriş bilgileri', onClose, fileName = 'giris-bilgileri.csv', loginUrl }) {
  const [copied, setCopied] = useState(false);
  const csv = () => downloadCsv(fileName, [['Ad Soyad', 'Sınıf', 'No', 'Kullanıcı adı', 'Geçici şifre', 'Giriş adresi'],
    ...rows.map(r => [r.fullName, r.className ?? '', r.studentNo ?? '', r.username, r.password, loginUrl ?? ''])]);
  const copy = async () => {
    const text = rows.map(r => `${r.fullName}\t${r.username}\t${r.password}`).join('\n');
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* pano izni yok */ }
  };
  return (
    <div className="card space-y-3 !border-amber-400/30" role="region" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-50">{title} <span className="badge bg-accent/15 text-accent">{rows.length} kişi</span></h2>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-300"><TriangleAlert size={14} className="mt-px shrink-0" />Şifreler bir daha gösterilmez. Şimdi CSV olarak indir; öğrenciler ilk girişte şifrelerini değiştirecek.</p>
          {loginUrl && <p className="mt-1 text-xs text-slate-400">Giriş adresi: <span className="select-all font-medium text-slate-200">{loginUrl}</span></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={csv}><Download size={15} />CSV indir</button>
          <button className="btn-ghost" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Kopyalandı' : 'Kopyala'}</button>
          {onClose && <button className="btn-ghost !p-2" onClick={onClose} aria-label="Kapat"><X size={15} /></button>}
        </div>
      </div>
      <div className="max-h-72 overflow-auto rounded-2xl border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-900/90"><tr className="stat-label"><th className="px-3 py-2">Ad Soyad</th>{rows.some(r => r.className) && <th className="px-3 py-2">Sınıf</th>}<th className="px-3 py-2">Kullanıcı adı</th><th className="px-3 py-2">Geçici şifre</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id ?? r.username} className="border-t border-white/[0.04]">
              <td className="px-3 py-1.5 text-slate-100">{r.fullName}</td>
              {rows.some(x => x.className) && <td className="px-3 py-1.5">{r.className ?? '—'}</td>}
              <td className="px-3 py-1.5 font-mono text-xs">{r.username}</td>
              <td className="px-3 py-1.5 font-mono text-xs text-amber-200">{r.password}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
