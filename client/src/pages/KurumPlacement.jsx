import { useMemo, useState } from 'react';
import { ArrowRightLeft, Plus, Trash2, Wand2, Loader2, Check, TriangleAlert, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { post } from '../lib/api.js';
import { useAuth } from '../store.js';
import { useLoad } from '../lib/useLoad.js';
import { Item } from '../components/ui.jsx';

const Err = ({ children }) => children ? <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{children}</p> : null;

// Sınıf değiştirme: öğrenci listesi her zaman görünür (son denemelerin ortalama netiyle). Her satırdan yeni sınıf elle seçilebilir;
// "Otomatik dağıt" ise ortalama nete göre kademelere (A: ilk 20, B: ilk 20, C: kalanlar) öneri doldurur. "Uygula" demeden kimse taşınmaz.
export default function Placement() {
  const { user } = useAuth(); const owner = user.role === 'owner';
  const cls = useLoad('/kurum/classes');
  const classes = (cls.data?.classes ?? []).filter(c => !c.isArchived);
  const [source, setSource] = useState('');
  const list = useLoad('/kurum/students' + (source ? '?classId=' + source : ''));
  const [tiers, setTiers] = useState([{ classId: '', size: 20 }, { classId: '', size: '' }]);   // size '' = kalanlar
  const [auto, setAuto] = useState(false);
  const [plan, setPlan] = useState({});          // öğrenci id → yeni sınıf id (null = sınıfsız)
  const [rank, setRank] = useState({});          // öğrenci id → öneri sırası (otomatik dağıtımdan sonra)
  const [lastN, setLastN] = useState(3);
  const [reason, setReason] = useState('Sınıf değiştirme sınavı');
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);

  const students = useMemo(() => {
    const rows = (list.data?.students ?? []).filter(s => !s.isDisabled);
    const key = (s) => (rank[s.id] ?? 1e9);
    return [...rows].sort((a, b) => key(a) - key(b) || (b.avgNet ?? -1e9) - (a.avgNet ?? -1e9) || (a.fullName || '').localeCompare(b.fullName || '', 'tr'));
  }, [list.data, rank]);
  const target = (s) => (s.id in plan ? plan[s.id] : s.classId ?? null);
  const moved = students.filter(s => s.id in plan && (plan[s.id] ?? null) !== (s.classId ?? null));
  const noScore = students.filter(s => s.avgNet == null).length;

  const setTier = (i, patch) => setTiers(t => t.map((x, k) => k === i ? { ...x, ...patch } : x));
  const valid = tiers.every(t => t.classId) && new Set(tiers.map(t => t.classId)).size === tiers.length;
  const clear = () => { setPlan({}); setRank({}); };

  const suggest = async () => {
    setErr(''); setOk(''); setBusy(true);
    try {
      if (!students.length) throw new Error('Seçilen kaynakta öğrenci yok');
      const out = await post('/kurum/placement/suggest', {
        studentIds: students.slice(0, 300).map(s => s.id), lastN: Number(lastN) || 3,
        tiers: tiers.map((t, i) => ({ classId: Number(t.classId), size: i === tiers.length - 1 ? null : Math.max(0, Number(t.size) || 0) })),
      });
      setPlan(Object.fromEntries(out.suggestions.map(s => [s.studentId, s.toClassId]))); setRank(Object.fromEntries(out.suggestions.map(s => [s.studentId, s.rank])));
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const apply = async () => {
    setErr(''); setBusy(true);
    try {
      const out = await post('/kurum/students/transfer', { moves: moved.map(s => ({ studentId: s.id, toClassId: plan[s.id] })), reason: reason.trim() || undefined });
      setOk(`${out.moved} öğrenci yeni sınıfına taşındı${out.unchanged ? `, ${out.unchanged} öğrenci zaten doğru sınıftaydı` : ''}. Geçmiş sekmesinde görebilirsin.`);
      clear(); list.reload(); cls.reload();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (<>
    <Item className="card space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1"><label htmlFor="p-src">Sınıf</label>
          <select id="p-src" value={source} onChange={e => { setSource(e.target.value); clear(); setOk(''); }}>
            <option value="">{owner ? 'Tüm öğrenciler' : 'Tüm sınıflarım'}</option>{(cls.data?.classes ?? []).map(c => <option key={c.id} value={c.id}>{c.name} ({c.studentCount})</option>)}</select></div>
        <button className={clsx('btn', !auto && '!bg-white/10 !text-slate-100 !shadow-none')} aria-expanded={auto} onClick={() => setAuto(a => !a)}><Wand2 size={16} />Otomatik dağıt</button>
      </div>

      {auto && (
        <div className="space-y-3 rounded-2xl bg-white/[0.04] p-3.5">
          <p className="text-xs leading-relaxed text-slate-400">Öğrenciler son denemelerinin ortalama netine göre sıralanır ve kademelere dağıtılır; sonucu aşağıdaki listede satır satır değiştirebilirsin.</p>
          <div className="max-w-[260px]"><label htmlFor="p-n">Son kaç denemenin ortalaması?</label><input id="p-n" type="number" min={1} max={20} value={lastN} onChange={e => setLastN(e.target.value)} /></div>
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
                  {tiers.length > 2 && <button className="btn-ghost !p-2" aria-label="Kademeyi sil" onClick={() => setTiers(x => x.filter((_, k) => k !== i))}><Trash2 size={14} /></button>}
                </div>);
            })}
            <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setTiers(t => [...t.slice(0, -1), { classId: '', size: 20 }, t[t.length - 1]])}><Plus size={13} />Kademe ekle</button>
          </div>
          <button className="btn" onClick={suggest} disabled={busy || !valid || students.length === 0}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}Listeyi doldur</button>
          {!valid && tiers.some(t => t.classId) && <p className="text-xs text-amber-300">Her kademe için farklı bir sınıf seç.</p>}
        </div>)}
      <Err>{err}</Err>{ok && <p role="status" className="flex items-center gap-1.5 rounded-2xl bg-accent/10 px-3.5 py-2.5 text-xs text-emerald-300"><Check size={14} />{ok}</p>}
    </Item>

    <Item className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-300"><b className="text-slate-100">{students.length}</b> öğrenci · <b className="text-slate-100">{moved.length}</b> kişi sınıf değiştirecek</div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px]"><label htmlFor="p-why" className="!mb-1">Geçmişe yazılacak not</label><input id="p-why" value={reason} onChange={e => setReason(e.target.value)} maxLength={200} /></div>
          {Object.keys(plan).length > 0 && <button className="btn-ghost" onClick={clear}><RotateCcw size={15} />Sıfırla</button>}
          <button className="btn" onClick={apply} disabled={busy || moved.length === 0}>{busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}Uygula ({moved.length})</button>
        </div>
      </div>
      {noScore > 0 && students.length > 0 && <p className="flex items-center gap-1.5 rounded-2xl bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-200"><TriangleAlert size={14} />{noScore} öğrencinin denemesi yok; ortalama net sütunu boş, otomatik dağıtımda sona yerleşir.</p>}
      {list.error ? <Err>{list.error}</Err> : !list.data ? <div className="py-8 text-center text-slate-500"><Loader2 className="mx-auto animate-spin" size={18} aria-label="Yükleniyor" /></div>
        : students.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Bu görünümde öğrenci yok.</p> : (
          <div className="max-h-[32rem] overflow-auto rounded-2xl border border-white/[0.06]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-900/90"><tr className="stat-label"><th className="px-3 py-2">Sıra</th><th className="px-3 py-2">Öğrenci</th><th className="px-3 py-2">Ort. net</th><th className="px-3 py-2">Şimdiki sınıf</th><th className="px-3 py-2">Yeni sınıf</th></tr></thead>
              <tbody>{students.map((s, i) => {
                const changed = s.id in plan && (plan[s.id] ?? null) !== (s.classId ?? null);
                return (
                  <tr key={s.id} className={clsx('border-t border-white/[0.04]', changed && 'bg-accent/[0.06]')}>
                    <td className="px-3 py-1.5 text-slate-500">{rank[s.id] ?? i + 1}</td><td className="px-3 py-1.5 text-slate-100">{s.fullName || s.username}<span className="block text-xs text-slate-500">{s.studentNo}</span></td>
                    <td className="px-3 py-1.5 num">{s.avgNet ?? <span className="text-slate-500">deneme yok</span>}</td>
                    <td className="px-3 py-1.5">{s.className ?? 'Sınıfsız'}</td>
                    <td className="px-3 py-1.5"><select aria-label={`${s.fullName || s.username} yeni sınıfı`} value={target(s) ?? ''} onChange={e => setPlan(p => ({ ...p, [s.id]: e.target.value === '' ? null : Number(e.target.value) }))} className="!w-40 !py-1.5">
                      {(owner || s.classId == null) && <option value="">Sınıfsız</option>}{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                  </tr>);
              })}</tbody>
            </table>
          </div>)}
    </Item>
  </>);
}
