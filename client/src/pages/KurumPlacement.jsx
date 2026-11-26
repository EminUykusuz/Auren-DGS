import { useState } from 'react';
import { ArrowRightLeft, Plus, Trash2, Wand2, Loader2, Check, TriangleAlert } from 'lucide-react';
import clsx from 'clsx';
import { get, post } from '../lib/api.js';
import { useAuth } from '../store.js';
import { useLoad } from '../lib/useLoad.js';
import { Item } from '../components/ui.jsx';

const Err = ({ children }) => children ? <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{children}</p> : null;

// Sınıf değiştirme sınavı: öğrencileri son N denemenin ortalama netine göre sıralar, kademelere (A: ilk 20, B: ilk 20, C: kalanlar) önerir.
// Öneri yalnızca öneridir: satır satır değiştirilebilir, "Uygula" deyince taşınır ve geçmişe kaydedilir.
export default function Placement() {
  const { user } = useAuth(); const owner = user.role === 'owner';
  const cls = useLoad('/kurum/classes');
  const classes = (cls.data?.classes ?? []).filter(c => !c.isArchived);
  const [source, setSource] = useState('');
  const [tiers, setTiers] = useState([{ classId: '', size: 20 }, { classId: '', size: '' }]);   // size '' = kalanlar
  const [lastN, setLastN] = useState(3);
  const [sugg, setSugg] = useState(null); const [reason, setReason] = useState('Sınıf değiştirme sınavı');
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);

  const setTier = (i, patch) => { setTiers(t => t.map((x, k) => k === i ? { ...x, ...patch } : x)); setSugg(null); };
  const valid = tiers.every(t => t.classId) && new Set(tiers.map(t => t.classId)).size === tiers.length;
  const nameOf = (id) => cls.data?.classes.find(c => c.id === id)?.name ?? '—';

  const suggest = async () => {
    setErr(''); setOk(''); setBusy(true);
    try {
      const q = new URLSearchParams(source ? { classId: source } : owner ? {} : {});
      const { students } = await get('/kurum/students?' + q);
      if (!students.length) throw new Error('Seçilen kaynakta öğrenci yok');
      const out = await post('/kurum/placement/suggest', {
        studentIds: students.slice(0, 300).map(s => s.id), lastN: Number(lastN) || 3,
        tiers: tiers.map((t, i) => ({ classId: Number(t.classId), size: i === tiers.length - 1 ? null : Math.max(0, Number(t.size) || 0) })),
      });
      setSugg(out.suggestions.map(s => ({ ...s, toClassId: s.toClassId })));
    } catch (e) { setErr(e.message); setSugg(null); } finally { setBusy(false); }
  };
  const apply = async () => {
    setErr(''); setBusy(true);
    try {
      const out = await post('/kurum/students/transfer', { moves: sugg.map(s => ({ studentId: s.studentId, toClassId: s.toClassId })), reason: reason.trim() || undefined });
      setOk(`${out.moved} öğrenci yeni sınıfına taşındı${out.unchanged ? `, ${out.unchanged} öğrenci zaten doğru sınıftaydı` : ''}. Geçmiş sekmesinde görebilirsin.`);
      setSugg(null); cls.reload();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const changed = sugg?.filter(s => s.fromClassId !== s.toClassId).length ?? 0;
  const noScore = sugg?.filter(s => s.score == null).length ?? 0;

  return (<>
    <Item className="card space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-50"><Wand2 size={17} className="text-accent" />Sınıf değiştirme sınavı yerleştirmesi</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">Öğrenciler son denemelerinin ortalama netine göre sıralanır ve aşağıdaki kademelere dağıtılır. Öneriyi satır satır değiştirebilirsin; <b>Uygula</b> demeden hiçbir öğrenci taşınmaz.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="p-src">Kimler değerlendirilecek?</label>
          <select id="p-src" value={source} onChange={e => { setSource(e.target.value); setSugg(null); }}>
            <option value="">{owner ? 'Tüm öğrenciler' : 'Tüm sınıflarım'}</option>{(cls.data?.classes ?? []).map(c => <option key={c.id} value={c.id}>{c.name} ({c.studentCount})</option>)}</select></div>
        <div><label htmlFor="p-n">Son kaç denemenin ortalaması?</label><input id="p-n" type="number" min={1} max={20} value={lastN} onChange={e => { setLastN(e.target.value); setSugg(null); }} /></div>
      </div>
      <div className="space-y-2">
        <div className="stat-label">Kademeler (en yüksek netten başlayarak)</div>
        {tiers.map((t, i) => {
          const last = i === tiers.length - 1;
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-center text-sm font-semibold text-slate-400">{i + 1}.</span>
              <select aria-label={`${i + 1}. kademe sınıfı`} value={t.classId} onChange={e => setTier(i, { classId: e.target.value })} className="!w-44"><option value="">Sınıf seç…</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              {last ? <span className="rounded-2xl bg-white/[0.05] px-3 py-2 text-sm text-slate-300">Kalan herkes</span>
                : <label className="!mb-0 flex items-center gap-2 !text-sm !text-slate-300"><input aria-label={`${i + 1}. kademe kontenjanı`} type="number" min={0} max={300} value={t.size} onChange={e => setTier(i, { size: e.target.value })} className="!w-24" />kişi</label>}
              {tiers.length > 2 && <button className="btn-ghost !p-2" aria-label="Kademeyi sil" onClick={() => { setTiers(x => x.filter((_, k) => k !== i)); setSugg(null); }}><Trash2 size={14} /></button>}
            </div>);
        })}
        <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => { setTiers(t => [...t.slice(0, -1), { classId: '', size: 20 }, t[t.length - 1]]); setSugg(null); }}><Plus size={13} />Kademe ekle</button>
      </div>
      <button className="btn" onClick={suggest} disabled={busy || !valid}>{busy && !sugg ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}Öneri oluştur</button>
      {!valid && tiers.some(t => t.classId) && <p className="text-xs text-amber-300">Her kademe için farklı bir sınıf seç.</p>}
      <Err>{err}</Err>{ok && <p role="status" className="flex items-center gap-1.5 rounded-2xl bg-accent/10 px-3.5 py-2.5 text-xs text-emerald-300"><Check size={14} />{ok}</p>}
    </Item>

    {sugg && (
      <Item className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-300"><b className="text-slate-100">{sugg.length}</b> öğrenci · <b className="text-slate-100">{changed}</b> kişi sınıf değiştirecek</div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px]"><label htmlFor="p-why" className="!mb-1">Geçmişe yazılacak not</label><input id="p-why" value={reason} onChange={e => setReason(e.target.value)} maxLength={200} /></div>
            <button className="btn" onClick={apply} disabled={busy || changed === 0}>{busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}Uygula ({changed})</button>
          </div>
        </div>
        {noScore > 0 && <p className="flex items-center gap-1.5 rounded-2xl bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-200"><TriangleAlert size={14} />{noScore} öğrencinin denemesi yok; sıralamanın sonuna yerleştirildi. Gerekirse sınıflarını elle düzelt.</p>}
        <div className="max-h-[28rem] overflow-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-900/90"><tr className="stat-label"><th className="px-3 py-2">Sıra</th><th className="px-3 py-2">Öğrenci</th><th className="px-3 py-2">Ort. net</th><th className="px-3 py-2">Şimdiki sınıf</th><th className="px-3 py-2">Yeni sınıf</th></tr></thead>
            <tbody>{sugg.map((s, i) => (
              <tr key={s.studentId} className={clsx('border-t border-white/[0.04]', s.fromClassId !== s.toClassId && 'bg-accent/[0.06]')}>
                <td className="px-3 py-1.5 text-slate-500">{s.rank}</td><td className="px-3 py-1.5 text-slate-100">{s.name}</td>
                <td className="px-3 py-1.5">{s.score ?? <span className="text-slate-500">deneme yok</span>}</td>
                <td className="px-3 py-1.5">{s.fromClassId ? nameOf(s.fromClassId) : 'Sınıfsız'}</td>
                <td className="px-3 py-1.5"><select aria-label={`${s.name} yeni sınıfı`} value={s.toClassId} onChange={e => setSugg(g => g.map((x, k) => k === i ? { ...x, toClassId: Number(e.target.value) } : x))} className="!w-40 !py-1.5">
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
              </tr>))}</tbody>
          </table>
        </div>
      </Item>)}
  </>);
}
