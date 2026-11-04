import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, ListChecks, X } from 'lucide-react';
import { get, post, put, del, net, fmt, today } from '../lib/api.js';
import { Page, Item, Title } from '../components/ui.jsx';
import SortTable from '../components/SortTable.jsx';
import ReasonEditor from '../components/ReasonEditor.jsx';
import { REASONS, REASON_LABEL, SUBJECT_LABEL, toMap, toList, sumOf } from '../lib/reasons.js';

const NetTrend = lazy(() => import('../components/ExamCharts.jsx').then(m => ({ default: m.NetTrend })));
const ReasonBars = lazy(() => import('../components/ExamCharts.jsx').then(m => ({ default: m.ReasonBars })));
const ChartSkeleton = () => <div className="h-[240px]" role="status" aria-label="Grafik yükleniyor" />;

const Field = ({ id, label, value, onChange, max = 50 }) => (
  <div><label htmlFor={id}>{label}</label>
    <input id={id} type="number" min={0} max={max} value={value} onChange={e => onChange(Math.min(max, Math.max(0, parseInt(e.target.value, 10) || 0)))} /></div>
);

// Mevcut denemenin yanlış nedenlerini inceleme/düzenleme penceresi
function ReviewDialog({ exam, onClose, onSaved }) {
  const [map, setMap] = useState(() => toMap(exam.Errors)); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement; ref.current?.focus();
    const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k);
    return () => { window.removeEventListener('keydown', k); prev?.focus?.(); };
  }, [onClose]);
  const save = async () => {
    setBusy(true); setErr('');
    try { await put(`/exams/${exam.Id}/errors`, { errors: toList(map) }); onSaved(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <motion.div className="gpu fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="rv-t" tabIndex={-1} ref={ref} className="card max-h-[92vh] w-full max-w-xl overflow-y-auto outline-none"
        initial={{ y: 24, scale: 0.96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 24, scale: 0.96, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 id="rv-t" className="text-lg font-semibold text-slate-50">Neden yanlış yaptım?</h2><p className="text-xs text-slate-400">{exam.ExamName} · {exam.ExamDate}</p></div>
          <button className="btn-ghost !p-2" onClick={onClose} aria-label="Kapat"><X size={16} /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ReasonEditor title="Matematik" wrong={exam.MathWrong} value={map.matematik} onChange={v => setMap(m => ({ ...m, matematik: v }))} />
          <ReasonEditor title="Türkçe" wrong={exam.TurkceWrong} value={map.turkce} onChange={v => setMap(m => ({ ...m, turkce: v }))} />
        </div>
        {err && <p role="alert" className="mt-3 text-xs text-red-300">{err}</p>}
        <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Vazgeç</button><button className="btn" onClick={save} disabled={busy}>Kaydet</button></div>
      </motion.div>
    </motion.div>
  );
}

export default function Exams() {
  const [list, setList] = useState([]); const [summary, setSummary] = useState(null); const [err, setErr] = useState(''); const [review, setReview] = useState(null);
  const [f, setF] = useState({ examName: '', mathCorrect: 0, mathWrong: 0, turkceCorrect: 0, turkceWrong: 0, examDate: today() });
  const [reasons, setReasons] = useState({ matematik: {}, turkce: {} });
  const load = () => { get('/exams').then(r => setList(r.exams)); get('/exams/error-summary').then(setSummary).catch(() => {}); };
  useEffect(() => { load(); }, []);
  const set = k => v => setF(p => ({ ...p, [k]: v }));
  const mathBad = f.mathCorrect + f.mathWrong > 50, trBad = f.turkceCorrect + f.turkceWrong > 50;
  const mn = net(f.mathCorrect, f.mathWrong), tn = net(f.turkceCorrect, f.turkceWrong);

  // Yanlış sayısı azaltılırsa fazla kalan neden kayıtları kırpılır
  useEffect(() => {
    setReasons(m => {
      const trim = (rs, cap) => { let over = sumOf(rs) - cap; if (over <= 0) return rs; const out = { ...rs }; for (const r of [...REASONS].reverse()) { const take = Math.min(out[r.key] ?? 0, over); if (take) { out[r.key] -= take; over -= take; } if (!over) break; } return out; };
      const a = trim(m.matematik, f.mathWrong), b = trim(m.turkce, f.turkceWrong);
      return a === m.matematik && b === m.turkce ? m : { matematik: a, turkce: b };
    });
  }, [f.mathWrong, f.turkceWrong]);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await post('/exams', { ...f, errors: toList(reasons) });
      setF(p => ({ ...p, examName: '', mathCorrect: 0, mathWrong: 0, turkceCorrect: 0, turkceWrong: 0 })); setReasons({ matematik: {}, turkce: {} }); load();
    } catch (x) { setErr(x.message); }
  };

  const cols = useMemo(() => [
    { key: 'ExamDate', label: 'Tarih', firstDir: -1, className: 'num whitespace-nowrap' },
    { key: 'ExamName', label: 'Deneme', render: r => <span className="text-slate-100">{r.ExamName}</span> },
    { key: 'MathNet', label: 'Mat. net', align: 'right', firstDir: -1, render: r => <>{fmt(r.MathNet)} <span className="text-xs text-slate-500">({r.MathCorrect}/{r.MathWrong})</span></> },
    { key: 'TurkceNet', label: 'Türk. net', align: 'right', firstDir: -1, render: r => <>{fmt(r.TurkceNet)} <span className="text-xs text-slate-500">({r.TurkceCorrect}/{r.TurkceWrong})</span></> },
    { key: 'TotalNet', label: 'Toplam', align: 'right', firstDir: -1, render: r => <span className="text-base font-semibold text-accent">{fmt(r.TotalNet)}</span> },
    { key: 'why', label: 'Hata nedeni', sort: false, render: r => {
      const wrong = r.MathWrong + r.TurkceWrong; const done = r.Errors.reduce((s, e) => s + e.count, 0);
      const top = [...r.Errors.reduce((m, e) => m.set(e.reason, (m.get(e.reason) ?? 0) + e.count), new Map())].sort((a, b) => b[1] - a[1])[0];
      return wrong === 0 ? <span className="text-xs text-slate-500">Yanlış yok</span> : (
        <button className="btn-ghost !px-3 !py-1 text-xs" onClick={() => setReview(r)} aria-label={`${r.ExamName} hata nedenlerini incele`}>
          <ListChecks size={13} />{done ? <>{REASON_LABEL[top[0]]} <span className="num text-slate-400">{done}/{wrong}</span></> : 'Nedenleri gir'}</button>);
    } },
    { key: 'del', label: '', sort: false, align: 'right', render: r => <button aria-label={`${r.ExamName} sil`} className="text-slate-500 transition hover:text-red-300" onClick={() => confirm('Bu deneme silinsin mi?') && del('/exams/' + r.Id).then(load)}><Trash2 size={14} /></button> },
  ], []); // eslint-disable-line

  const best = list.length ? Math.max(...list.map(x => x.TotalNet)) : null;
  const top3 = summary ? Object.values(summary.rows.reduce((m, x) => { (m[x.reason] ??= { reason: x.reason, total: 0 }).total += x.total; return m; }, {})).sort((a, b) => b.total - a.total) : [];

  return (
    <Page>
      <Title>Deneme sınavları</Title>
      <div className="grid gap-4 xl:grid-cols-[420px_1fr] xl:items-start">
        <Item className="xl:sticky xl:top-4">
          <form onSubmit={submit} className="card space-y-4">
            <div><label htmlFor="n">Deneme adı</label><input id="n" required maxLength={100} value={f.examName} onChange={e => set('examName')(e.target.value)} placeholder="Örn. Yayın X – Deneme 3" /></div>
            <div><label htmlFor="dt">Tarih</label><input id="dt" type="date" max={today()} value={f.examDate} onChange={e => set('examDate')(e.target.value)} /></div>
            {[['Matematik', 'math', mn, mathBad], ['Türkçe', 'turkce', tn, trBad]].map(([title, p, n, bad]) => (
              <div key={p} className="rounded-3xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium text-slate-100">{title} <span className="text-xs text-slate-500">/ 50</span></span>
                  <span className="num text-xl font-semibold text-accent">{fmt(n)} net</span></div>
                <div className="grid grid-cols-2 gap-3">
                  <Field id={p + 'c'} label="Doğru" value={f[p + 'Correct']} onChange={set(p + 'Correct')} />
                  <Field id={p + 'w'} label="Yanlış" value={f[p + 'Wrong']} onChange={set(p + 'Wrong')} />
                </div>
                {bad && <p className="mt-2 text-xs text-red-300">Doğru + yanlış en fazla 50 olabilir</p>}
              </div>))}
            {f.mathWrong + f.turkceWrong > 0 && (
              <details className="group rounded-3xl border border-white/10 bg-white/[0.02] p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-100">Neden yanlış yaptım? <span className="text-xs font-normal text-slate-500">(isteğe bağlı)</span></summary>
                <div className="mt-3 space-y-3">
                  <ReasonEditor title="Matematik" wrong={f.mathWrong} value={reasons.matematik} onChange={v => setReasons(m => ({ ...m, matematik: v }))} />
                  <ReasonEditor title="Türkçe" wrong={f.turkceWrong} value={reasons.turkce} onChange={v => setReasons(m => ({ ...m, turkce: v }))} />
                </div>
              </details>)}
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-400">Toplam net <span className="num ml-1 text-2xl font-semibold text-slate-50">{fmt(mn + tn)}</span></div>
              <button className="btn" disabled={mathBad || trBad || !f.examName.trim()}>Kaydet</button>
            </div>
            <p className="text-xs text-slate-500">Net = Doğru − Yanlış × 0,25 · kayıtta sunucu yeniden hesaplar</p>
            {err && <p role="alert" className="text-xs text-red-300">{err}</p>}
          </form>
        </Item>

        <div className="space-y-4">
          <Item className="card">
            <div className="stat-label mb-2">Net trendi</div>
            {list.length < 2 ? <p className="py-12 text-center text-sm text-slate-500">Trend için en az 2 deneme ekle.</p> : <Suspense fallback={<ChartSkeleton />}><NetTrend exams={list} /></Suspense>}
          </Item>

          <Item className="card">
            <div className="mb-3 flex items-baseline justify-between"><div className="stat-label">Neden yanlış yapıyorum?</div>
              {summary && <div className="num text-xs text-slate-500">{summary.categorized}/{summary.totalWrong} yanlışın nedeni girildi</div>}</div>
            {!summary || !summary.categorized ? <p className="py-8 text-center text-sm text-slate-500">Denemelerinde yanlışların nedenini işaretle; dağılım burada görünür.</p> : (
              <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-center">
                <Suspense fallback={<ChartSkeleton />}><ReasonBars rows={summary.rows} /></Suspense>
                <ul className="space-y-2.5">{top3.map(t => { const r = REASONS.find(x => x.key === t.reason); return (
                  <li key={t.reason} className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 text-slate-300"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.label}</span>
                    <span className="num text-slate-100">{t.total} <span className="text-xs text-slate-500">%{Math.round(t.total / summary.categorized * 100)}</span></span></li>); })}
                  <li className="border-t border-white/[0.06] pt-2 text-xs text-slate-500">{SUBJECT_LABEL.matematik}: {summary.rows.filter(x => x.subject === 'matematik').reduce((s, x) => s + x.total, 0)} · {SUBJECT_LABEL.turkce}: {summary.rows.filter(x => x.subject === 'turkce').reduce((s, x) => s + x.total, 0)}</li></ul>
              </div>)}
          </Item>

          <Item className="card">
            <div className="mb-3 flex items-baseline justify-between"><div className="stat-label">Deneme geçmişi</div>
              <div className="num text-xs text-slate-500">{list.length} deneme{best != null && <> · en iyi {fmt(best)}</>}</div></div>
            <SortTable columns={cols} rows={list} rowKey={r => r.Id} defaultSort={{ key: 'ExamDate', dir: -1 }} rowClass={r => r.TotalNet === best && list.length > 1 && 'bg-accent/[0.05]'} empty="Henüz deneme yok." />
          </Item>
        </div>
      </div>

      <AnimatePresence>{review && <ReviewDialog key={review.Id} exam={review} onClose={() => setReview(null)} onSaved={() => { setReview(null); load(); }} />}</AnimatePresence>
    </Page>
  );
}
