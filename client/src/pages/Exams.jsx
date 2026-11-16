import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2, ListChecks, X } from 'lucide-react';
import clsx from 'clsx';
import { get, post, put, del, net, fmt, today } from '../lib/api.js';
import { useExam, useExamCfg } from '../store.js';
import { Page, Item, Title } from '../components/ui.jsx';
import SortTable from '../components/SortTable.jsx';
import ReasonEditor from '../components/ReasonEditor.jsx';
import { REASONS, REASON_LABEL, SERIES_COLORS, toMap, toList, sumOf } from '../lib/reasons.js';

const NetTrend = lazy(() => import('../components/ExamCharts.jsx').then(m => ({ default: m.NetTrend })));
const ReasonBars = lazy(() => import('../components/ExamCharts.jsx').then(m => ({ default: m.ReasonBars })));
const ChartSkeleton = () => <div className="h-[240px]" role="status" aria-label="Grafik yükleniyor" />;

const Field = ({ id, label, value, onChange, max }) => (
  <div><label htmlFor={id}>{label}</label>
    <input id={id} type="number" min={0} max={max} value={value} onChange={e => onChange(Math.min(max, Math.max(0, parseInt(e.target.value, 10) || 0)))} /></div>
);

// Mevcut denemenin yanlış nedenlerini inceleme/düzenleme penceresi (yalnızca yanlışı olan bölümler)
function ReviewDialog({ exam, onClose, onSaved }) {
  const { mode, subjectLabel } = useExamCfg();
  const [map, setMap] = useState(() => toMap(exam.Errors)); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement; ref.current?.focus();
    const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k);
    return () => { window.removeEventListener('keydown', k); prev?.focus?.(); };
  }, [onClose]);
  const save = async () => {
    setBusy(true); setErr('');
    try { await put(`/exams/${exam.Id}/errors`, { examType: mode, errors: toList(map) }); onSaved(); } catch (e) { setErr(e.message); setBusy(false); }
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
          {exam.Sections.filter(s => s.wrong > 0).map(s => (
            <ReasonEditor key={s.key} title={subjectLabel(s.key)} wrong={s.wrong} value={map[s.key] ?? {}} onChange={v => setMap(m => ({ ...m, [s.key]: v }))} />))}
        </div>
        {err && <p role="alert" className="mt-3 text-xs text-red-300">{err}</p>}
        <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Vazgeç</button><button className="btn" onClick={save} disabled={busy}>Kaydet</button></div>
      </motion.div>
    </motion.div>
  );
}

const blank = (sections) => Object.fromEntries(sections.map(s => [s.key, { correct: 0, wrong: 0 }]));

export default function Exams() {
  const { mode, cfg, part, partDef, subjectLabel, q } = useExamCfg(); const setPart = useExam(s => s.setPart);
  const sections = partDef.sections;
  const [list, setList] = useState([]); const [summary, setSummary] = useState(null); const [err, setErr] = useState(''); const [review, setReview] = useState(null);
  const [meta, setMeta] = useState({ examName: '', examDate: today() });
  const [res, setRes] = useState(() => blank(sections));
  const [reasons, setReasons] = useState({});
  const load = () => { get('/exams' + q()).then(r => setList(r.exams)); get('/exams/error-summary' + q()).then(setSummary).catch(() => {}); };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Bölüm (TYT ⇄ AYT) değişince form sıfırlanır
  useEffect(() => { setRes(blank(sections)); setReasons({}); }, [part]); // eslint-disable-line react-hooks/exhaustive-deps

  const setAns = (key, field) => v => setRes(p => ({ ...p, [key]: { ...p[key], [field]: v } }));
  const bad = Object.fromEntries(sections.map(s => [s.key, res[s.key].correct + res[s.key].wrong > s.max]));
  const anyBad = Object.values(bad).some(Boolean);
  const nets = Object.fromEntries(sections.map(s => [s.key, net(res[s.key].correct, res[s.key].wrong)]));
  const total = sections.reduce((s, x) => s + nets[x.key], 0);
  const wrongTotal = sections.reduce((s, x) => s + res[x.key].wrong, 0);

  // Yanlış sayısı azaltılırsa fazla kalan neden kayıtları kırpılır
  useEffect(() => {
    setReasons(m => {
      const trim = (rs = {}, cap) => { let over = sumOf(rs) - cap; if (over <= 0) return rs; const out = { ...rs }; for (const r of [...REASONS].reverse()) { const take = Math.min(out[r.key] ?? 0, over); if (take) { out[r.key] -= take; over -= take; } if (!over) break; } return out; };
      let changed = false; const next = {};
      for (const s of sections) { const t = trim(m[s.key], res[s.key]?.wrong ?? 0); if (t !== m[s.key]) changed = true; next[s.key] = t; }
      return changed ? next : m;
    });
  }, [res]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await post('/exams', { examType: mode, part, ...meta, results: res, errors: toList(reasons) });
      setMeta(p => ({ ...p, examName: '' })); setRes(blank(sections)); setReasons({}); load();
    } catch (x) { setErr(x.message); }
  };

  const multi = cfg.parts.length > 1;
  const cols = useMemo(() => [
    { key: 'ExamDate', label: 'Tarih', firstDir: -1, className: 'num whitespace-nowrap' },
    { key: 'ExamName', label: 'Deneme', render: r => <span className="text-slate-100">{r.ExamName}{multi && <span className="badge ml-2 bg-white/[0.07] text-slate-300">{r.ExamPart}</span>}</span> },
    { key: 'sections', label: 'Bölümler', sort: false, render: r => (
      <span className="flex flex-wrap gap-x-3 gap-y-0.5">{r.Sections.map(s => <span key={s.key} className="whitespace-nowrap text-xs text-slate-400">{subjectLabel(s.key)} <span className="num text-slate-100">{fmt(s.net)}</span> <span className="text-slate-600">({s.correct}/{s.wrong})</span></span>)}</span>) },
    { key: 'TotalNet', label: 'Toplam', align: 'right', firstDir: -1, render: r => <span className="text-base font-semibold text-accent">{fmt(r.TotalNet)}</span> },
    { key: 'why', label: 'Hata nedeni', sort: false, render: r => {
      const wrong = r.Sections.reduce((s, x) => s + x.wrong, 0); const done = r.Errors.reduce((s, e) => s + e.count, 0);
      const top = [...r.Errors.reduce((m, e) => m.set(e.reason, (m.get(e.reason) ?? 0) + e.count), new Map())].sort((a, b) => b[1] - a[1])[0];
      return wrong === 0 ? <span className="text-xs text-slate-500">Yanlış yok</span> : (
        <button className="btn-ghost !px-3 !py-1 text-xs" onClick={() => setReview(r)} aria-label={`${r.ExamName} hata nedenlerini incele`}>
          <ListChecks size={13} />{done ? <>{REASON_LABEL[top[0]]} <span className="num text-slate-400">{done}/{wrong}</span></> : 'Nedenleri gir'}</button>);
    } },
    { key: 'del', label: '', sort: false, align: 'right', render: r => <button aria-label={`${r.ExamName} sil`} className="text-slate-500 transition hover:text-red-300" onClick={() => confirm('Bu deneme silinsin mi?') && del('/exams/' + r.Id + q()).then(load)}><Trash2 size={14} /></button> },
  ], [mode]); // eslint-disable-line

  // Net karşılaştırması yalnızca aynı bölüm (TYT/AYT) içinde anlamlı
  const partList = useMemo(() => list.filter(x => x.ExamPart === part), [list, part]);
  const best = partList.length ? Math.max(...partList.map(x => x.TotalNet)) : null;
  const top3 = summary ? Object.values(summary.rows.reduce((m, x) => { (m[x.reason] ??= { reason: x.reason, total: 0 }).total += x.total; return m; }, {})).sort((a, b) => b.total - a.total) : [];
  const errSubjects = summary ? [...new Set(summary.rows.map(x => x.subject))].map(key => ({ key, label: subjectLabel(key), total: summary.rows.filter(x => x.subject === key).reduce((s, x) => s + x.total, 0) })) : [];

  return (
    <Page>
      <Title right={multi && (
        <div role="tablist" aria-label="Deneme bölümü" className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
          {cfg.parts.map(p => <button key={p.id} role="tab" aria-selected={part === p.id} onClick={() => setPart(p.id)}
            className={clsx('rounded-full px-4 py-1.5 text-xs font-bold transition', part === p.id ? 'bg-accent text-onaccent' : 'text-slate-400 hover:text-slate-200')}>{p.label}</button>)}
        </div>)}>Deneme sınavları</Title>
      <div className="grid gap-4 xl:grid-cols-[420px_1fr] xl:items-start">
        <Item className="xl:sticky xl:top-20">
          <form onSubmit={submit} className="card space-y-4">
            <div><label htmlFor="n">Deneme adı {multi && <span className="text-slate-500">· {partDef.label}</span>}</label><input id="n" required maxLength={100} value={meta.examName} onChange={e => setMeta(p => ({ ...p, examName: e.target.value }))} placeholder={`Örn. Yayın X – ${partDef.label} Deneme 3`} /></div>
            <div><label htmlFor="dt">Tarih</label><input id="dt" type="date" max={today()} value={meta.examDate} onChange={e => setMeta(p => ({ ...p, examDate: e.target.value }))} /></div>
            <div className={clsx('grid gap-3', sections.length > 2 && 'sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2')}>
              {sections.map((s, i) => (
                <div key={s.key} className="rounded-3xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-100"><span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />{s.label} <span className="text-xs text-slate-500">/ {s.max}</span></span>
                    <span className="num text-lg font-semibold text-accent">{fmt(nets[s.key])}</span></div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id={s.key + 'c'} label="Doğru" max={s.max} value={res[s.key].correct} onChange={setAns(s.key, 'correct')} />
                    <Field id={s.key + 'w'} label="Yanlış" max={s.max} value={res[s.key].wrong} onChange={setAns(s.key, 'wrong')} />
                  </div>
                  {bad[s.key] && <p className="mt-2 text-xs text-red-300">Doğru + yanlış en fazla {s.max} olabilir</p>}
                </div>))}
            </div>
            {wrongTotal > 0 && (
              <details className="group rounded-3xl border border-white/10 bg-white/[0.02] p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-100">Neden yanlış yaptım? <span className="text-xs font-normal text-slate-500">(isteğe bağlı)</span></summary>
                <div className="mt-3 space-y-3">
                  {sections.filter(s => res[s.key].wrong > 0).map(s => <ReasonEditor key={s.key} title={s.label} wrong={res[s.key].wrong} value={reasons[s.key] ?? {}} onChange={v => setReasons(m => ({ ...m, [s.key]: v }))} />)}
                </div>
              </details>)}
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-400">Toplam net <span className="num ml-1 text-2xl font-semibold text-slate-50">{fmt(total)}</span></div>
              <button className="btn" disabled={anyBad || !meta.examName.trim()}>Kaydet</button>
            </div>
            <p className="text-xs text-slate-500">4 yanlış 1 doğruyu götürür: Net = Doğru − Yanlış × 0,25 · kayıtta sunucu yeniden hesaplar</p>
            {err && <p role="alert" className="text-xs text-red-300">{err}</p>}
          </form>
        </Item>

        <div className="space-y-4">
          <Item className="card">
            <div className="stat-label mb-2">Net trendi{multi && ` · ${partDef.label}`}</div>
            {partList.length < 2 ? <p className="py-12 text-center text-sm text-slate-500">Trend için en az 2 {partDef.label} denemesi ekle.</p> : <Suspense fallback={<ChartSkeleton />}><NetTrend exams={partList} sections={sections} /></Suspense>}
          </Item>

          <Item className="card">
            <div className="mb-3 flex items-baseline justify-between"><div className="stat-label">Neden yanlış yapıyorum?</div>
              {summary && <div className="num text-xs text-slate-500">{summary.categorized}/{summary.totalWrong} yanlışın nedeni girildi</div>}</div>
            {!summary || !summary.categorized ? <p className="py-8 text-center text-sm text-slate-500">Denemelerinde yanlışların nedenini işaretle; dağılım burada görünür.</p> : (
              <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-center">
                <Suspense fallback={<ChartSkeleton />}><ReasonBars rows={summary.rows} subjects={errSubjects} /></Suspense>
                <ul className="space-y-2.5">{top3.map(t => { const r = REASONS.find(x => x.key === t.reason); return (
                  <li key={t.reason} className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 text-slate-300"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.label}</span>
                    <span className="num text-slate-100">{t.total} <span className="text-xs text-slate-500">%{Math.round(t.total / summary.categorized * 100)}</span></span></li>); })}
                  <li className="border-t border-white/[0.06] pt-2 text-xs text-slate-500">{errSubjects.map(s => `${s.label}: ${s.total}`).join(' · ')}</li></ul>
              </div>)}
          </Item>

          <Item className="card">
            <div className="mb-3 flex items-baseline justify-between"><div className="stat-label">Deneme geçmişi</div>
              <div className="num text-xs text-slate-500">{list.length} deneme{best != null && <> · {multi ? `en iyi ${partDef.label}` : 'en iyi'} {fmt(best)}</>}</div></div>
            <SortTable columns={cols} rows={list} rowKey={r => r.Id} defaultSort={{ key: 'ExamDate', dir: -1 }} rowClass={r => r.ExamPart === part && r.TotalNet === best && partList.length > 1 && 'bg-accent/[0.05]'} empty="Henüz deneme yok." />
          </Item>
        </div>
      </div>

      <AnimatePresence>{review && <ReviewDialog key={review.Id} exam={review} onClose={() => setReview(null)} onSaved={() => { setReview(null); load(); }} />}</AnimatePresence>
    </Page>
  );
}
