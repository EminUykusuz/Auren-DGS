import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, TrendingUp, Layers, BookCheck, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../theme.js';
import { get } from '../lib/api.js';
import { DGS_TOPIC_GROUPS } from '../lib/curriculum.js';
import { Page, Item, Title, Bar } from '../components/ui.jsx';
import SortTable from '../components/SortTable.jsx';

// Salt okunur görünüm: durum ve güç, gerçek çalışma kayıtlarından türetilir (elle işaretleme yok)
export const LEVEL = {
  critical:   { label: 'Kritik / Çalışılmalı', cls: 'bg-amber-400/15 text-amber-300',     bar: 'bg-amber-400' },
  developing: { label: 'Gelişiyor',            cls: 'bg-cyan-400/15 text-cyan-300',       bar: 'bg-cyan-400' },
  strong:     { label: 'Ustalaşıldı',          cls: 'bg-emerald-400/15 text-emerald-300', bar: 'bg-emerald-400' },
  none:       { label: 'Çalışılmadı',          cls: 'bg-white/[0.06] text-slate-400',     bar: 'bg-slate-500' },
};
const SUBJECTS = [['matematik', 'Matematik'], ['turkce', 'Türkçe']];
const needsReview = m => m && m.level !== 'none' && (m.level === 'critical' || m.retention < 0.5);
const since = d => d == null ? '—' : d === 0 ? 'bugün' : d === 1 ? 'dün' : `${d} gün önce`;
const levelOfAvg = a => a < 40 ? 'critical' : a < 70 ? 'developing' : 'strong';

const Badge = ({ level }) => { const L = LEVEL[level]; return <span className={clsx('badge', L.cls)}><span className={clsx('h-1.5 w-1.5 rounded-full', L.bar)} />{L.label}</span>; };

const cols = [
  { key: 'order', label: 'Konu', render: r => <span className="text-slate-100">{r.label}</span> },
  { key: 'score', label: 'Durum', firstDir: -1, sort: r => r.score, render: r => <Badge level={r.level} /> },
  { key: 'power', label: 'Güç', firstDir: -1, sort: r => r.score, className: 'w-32', render: r => r.score == null ? <span className="text-slate-600">—</span> : (
    <div className="flex items-center gap-2"><div className="flex-1"><Bar percent={r.score} label={`${r.label} güç skoru`} color={LEVEL[r.level].bar} /></div><span className="num w-7 text-right text-xs text-slate-300">{r.score}</span></div>) },
  { key: 'acc', label: 'Doğruluk', align: 'right', firstDir: -1, sort: r => r.m?.accuracy ?? null, render: r => r.m?.accuracy != null ? `%${r.m.accuracy}` : '—' },
  { key: 'solved', label: 'Soru', align: 'right', firstDir: -1, sort: r => r.m?.solved ?? 0, render: r => r.m?.solved ?? 0 },
  { key: 'days', label: 'Tekrar', align: 'right', firstDir: -1, sort: r => r.m?.days ?? 0, render: r => r.m?.days ?? 0 },
  { key: 'last', label: 'Son çalışma', align: 'right', sort: r => r.m?.daysSince ?? null, className: 'whitespace-nowrap text-slate-400', render: r => since(r.m?.daysSince) },
];

// Akordeon grup: tablo yalnızca açıkken DOM'a eklenir (58 konunun tamamı aynı anda çizilmez)
const Group = memo(function Group({ sk, group, rows, first, subjectCrit }) {
  const studied = rows.filter(r => r.level !== 'none');
  const avg = studied.length ? Math.round(studied.reduce((s, r) => s + r.score, 0) / studied.length) : null;
  const crit = rows.filter(r => r.level === 'critical').length;
  const perf = useTheme(s => s.perf);
  const [open, setOpen] = useState(() => crit > 0 || (first && !subjectCrit));
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={`g-${sk}-${group}`} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-white/[0.04]">
        <ChevronDown size={16} className={clsx('shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
        <span className="min-w-0 flex-1 text-sm font-medium text-slate-100">{group}</span>
        {crit > 0 && <span className="badge bg-amber-400/15 text-amber-300">{crit} kritik</span>}
        <span className="num hidden text-xs text-slate-500 sm:inline">{studied.length}/{rows.length} konu</span>
        <span className="hidden w-24 sm:block"><Bar percent={avg ?? 0} label={`${group} ortalama güç`} color={avg == null ? 'bg-slate-600' : LEVEL[levelOfAvg(avg)].bar} /></span>
        <span className="num w-7 text-right text-xs text-slate-300">{avg ?? '—'}</span>
      </button>
      {perf ? (open && <div id={`g-${sk}-${group}`} className="px-3 pb-2"><SortTable columns={cols} rows={rows} rowKey={r => r.key} defaultSort={{ key: 'order', dir: 1 }} dense /></div>) : (
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={`g-${sk}-${group}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }} className="gpu overflow-hidden [contain:layout_paint]">
            <div className="px-3 pb-2"><SortTable columns={cols} rows={rows} rowKey={r => r.key} defaultSort={{ key: 'order', dir: 1 }} dense /></div>
          </motion.div>)}
      </AnimatePresence>)}
    </div>
  );
});

export default function Curriculum() {
  const [mastery, setMastery] = useState(null);
  useEffect(() => { get('/mastery').then(r => setMastery(Object.fromEntries(r.topics.map(t => [t.subjectKey + ':' + t.topicKey, t])))).catch(() => setMastery({})); }, []);

  const bySubject = useMemo(() => Object.fromEntries(SUBJECTS.map(([sk]) => [sk, DGS_TOPIC_GROUPS[sk].flatMap((g, gi) => g.topics.map((t, ti) => {
    const m = mastery?.[sk + ':' + t.value];
    return { key: sk + ':' + t.value, subject: sk, label: t.label, group: g.group, order: gi * 100 + ti, m, level: m?.level ?? 'none', score: m?.score ?? null };
  }))])), [mastery]);

  // Grup satırları ve kritik bayrağı yalnızca veri değişince yeniden hesaplanır (memo'lu Group'un prop'ları kararlı kalır)
  const grouped = useMemo(() => Object.fromEntries(SUBJECTS.map(([sk]) => [sk, {
    crit: bySubject[sk].some(r => r.level === 'critical'),
    groups: DGS_TOPIC_GROUPS[sk].map(g => ({ group: g.group, rows: bySubject[sk].filter(r => r.group === g.group) })),
  }])), [bySubject]);

  const all = useMemo(() => Object.values(bySubject).flat(), [bySubject]);
  const A = useMemo(() => {
    const counts = { critical: 0, developing: 0, strong: 0, none: 0 }; all.forEach(r => counts[r.level]++);
    const studied = all.filter(r => r.level !== 'none');
    return {
      counts, studied: studied.length,
      urgent: all.filter(r => needsReview(r.m)).sort((a, b) => a.score - b.score || (b.m.daysSince ?? 0) - (a.m.daysSince ?? 0)).slice(0, 6),
      strongest: [...studied].sort((a, b) => b.score - a.score).slice(0, 6),
      subjects: SUBJECTS.map(([sk, name]) => {
        const rs = bySubject[sk]; const st = rs.filter(r => r.level !== 'none');
        return { sk, name, total: rs.length, studied: st.length, avg: st.length ? Math.round(st.reduce((s, r) => s + r.score, 0) / st.length) : null,
          groups: DGS_TOPIC_GROUPS[sk].map(g => { const gs = rs.filter(r => r.group === g.group && r.level !== 'none'); return { group: g.group, n: gs.length, total: g.topics.length, avg: gs.length ? Math.round(gs.reduce((s, r) => s + r.score, 0) / gs.length) : null }; }) };
      }),
    };
  }, [all, bySubject]);

  if (!mastery) return <div className="min-h-[60vh] text-slate-500">Yükleniyor…</div>;

  return (
    <Page>
      <Title>Müfredat ve güç analizi</Title>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Item className="card">
          <div className="stat-label mb-3 flex items-center gap-2"><Layers size={13} /> Genel görünüm</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {['critical', 'developing', 'strong'].map(l => (
              <div key={l} className={clsx('rounded-2xl py-3', LEVEL[l].cls)}><div className="num text-2xl font-semibold">{A.counts[l]}</div><div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{LEVEL[l].label.split(' / ')[0]}</div></div>))}
          </div>
          <div className="num mt-3 text-xs text-slate-500">{A.studied}/{all.length} konu çalışıldı · {A.counts.none} konu henüz çalışılmadı</div>
        </Item>

        <Item className="card">
          <div className="stat-label mb-3 flex items-center gap-2 text-amber-300"><AlertTriangle size={13} /> Acil tekrar</div>
          {A.urgent.length ? <ul className="space-y-2.5">{A.urgent.map(r => (
            <li key={r.key} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-slate-100">{r.label}</span>
              <span className="num shrink-0 text-xs text-slate-400">{since(r.m.daysSince)} · <span className="text-amber-300">{r.score}</span></span></li>))}</ul>
            : <p className="text-sm text-slate-500">{A.studied ? 'Acil tekrar gerektiren konu yok.' : 'Çalışma kaydı ekledikçe zayıf konular burada listelenir.'}</p>}
        </Item>

        <Item className="card">
          <div className="stat-label mb-3 flex items-center gap-2 text-emerald-300"><TrendingUp size={13} /> En güçlü konular</div>
          {A.strongest.length ? <ul className="space-y-2.5">{A.strongest.map(r => (
            <li key={r.key} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-slate-100">{r.label}</span>
              <span className={clsx('num shrink-0 text-xs font-semibold', LEVEL[r.level].cls.split(' ')[1])}>{r.score}</span></li>))}</ul>
            : <p className="text-sm text-slate-500">Henüz veri yok.</p>}
        </Item>

        <Item className="card">
          <div className="stat-label mb-3 flex items-center gap-2"><BookCheck size={13} /> Derse göre ortalama güç</div>
          <ul className="space-y-4">{A.subjects.map(s => (
            <li key={s.sk}><div className="mb-1 flex justify-between text-sm"><span className="text-slate-100">{s.name}</span>
              <span className="num text-xs text-slate-500">{s.avg != null ? `${s.avg} · ` : ''}{s.studied}/{s.total} konu</span></div>
              <Bar percent={s.avg ?? 0} label={`${s.name} ortalama güç`} color={s.avg == null ? 'bg-slate-600' : LEVEL[levelOfAvg(s.avg)].bar} /></li>))}</ul>
        </Item>
      </div>

      <div className="grid gap-4 2xl:grid-cols-2 2xl:items-start">
        {SUBJECTS.map(([sk, name]) => {
          const s = A.subjects.find(x => x.sk === sk);
          return (
            <Item key={sk} className="card !p-3 sm:!p-4">
              <div className="mb-3 flex items-baseline justify-between px-2"><h2 className="text-lg font-semibold text-slate-50">{name}</h2><span className="num text-xs text-slate-500">{s.studied}/{s.total} konu çalışıldı</span></div>
              <div className="space-y-1">{grouped[sk].groups.map((g, i) => (
                <Group key={g.group} sk={sk} group={g.group} first={i === 0} subjectCrit={grouped[sk].crit} rows={g.rows} />))}</div>
            </Item>);
        })}
      </div>
      <p className="text-xs leading-relaxed text-slate-500">Bu sayfa salt okunurdur: durum ve güç skoru (0–100) yalnızca kayıtlı çalışma oturumlarından hesaplanır — doğruluk (net oranı), çözülen soru hacmi, farklı gün sayısı (tekrar) ve son çalışmadan geçen süre (unutma eğrisi). 40'ın altı Kritik, 40–69 Gelişiyor, 70 ve üstü Ustalaşıldı.</p>
    </Page>
  );
}
