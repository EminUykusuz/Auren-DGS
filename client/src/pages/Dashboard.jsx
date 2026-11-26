import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Target, Trophy, GraduationCap } from 'lucide-react';
import { get, fmt } from '../lib/api.js';
import { usePoll } from '../lib/poll.js';
import { Page, Item, Title, Stat, Bar } from '../components/ui.jsx';
import SortTable from '../components/SortTable.jsx';
import Countdown from '../components/Countdown.jsx';
import SupportCard from '../components/SupportCard.jsx';
import { useExam, useExamCfg, useAuth } from '../store.js';
import clsx from 'clsx';

const TrendChart = lazy(() => import('../components/TrendChart.jsx'));
export { Bar };
const POLL_MS = 15000;

export default function Dashboard() {
  const inKurum = !!useAuth(x => x.user)?.institution;
  const { cfg, part, partDef, q } = useExamCfg(); const setPart = useExam(x => x.setPart);
  const [s, setS] = useState(null); const [lb, setLb] = useState(null);
  usePoll(() => { get('/stats/me' + q({ part })).then(setS).catch(() => {}); get('/leaderboard' + q({ part })).then(setLb).catch(() => {}); }, POLL_MS, [part]);

  const cols = useMemo(() => [
    { key: 'rank', label: '#', className: 'w-10 num' },
    { key: 'username', label: 'Kullanıcı', firstDir: 1, render: r => <span className={r.isMe ? 'font-semibold text-accent' : 'text-slate-100'}>@{r.username}{r.isMe && ' (sen)'}</span> },
    { key: 'weeklyPoints', label: 'Puan', align: 'right', firstDir: -1, render: r => <span className="font-semibold">{fmt(r.weeklyPoints)}</span> },
    { key: 'weeklyHours', label: 'Saat', align: 'right', firstDir: -1, render: r => fmt(r.weeklyHours) },
    { key: 'avgNet', label: 'Ort. net', align: 'right', firstDir: -1, render: r => fmt(r.avgNet) },
    { key: 'overallPercent', label: 'Müfredat', align: 'right', firstDir: -1, render: r => `%${r.overallPercent}` },
  ], []);

  if (!s || s.examType !== cfg.id || s.part !== part) return <div className="text-slate-500">Yükleniyor…</div>;
  const multi = cfg.parts.length > 1; const subjects = cfg.subjects.filter(x => s.subjects[x.key]);
  return (
    <Page>
      <Title right={multi && (
        <div role="tablist" aria-label="Deneme bölümü" className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
          {cfg.parts.map(p => <button key={p.id} role="tab" aria-selected={part === p.id} onClick={() => setPart(p.id)}
            className={clsx('rounded-full px-4 py-1.5 text-xs font-bold transition', part === p.id ? 'bg-accent text-onaccent' : 'text-slate-400 hover:text-slate-200')}>{p.label}</button>)}
        </div>)}>Panel</Title>
      {!inKurum && <Countdown />}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat icon={Flame} label="Bu hafta" value={`${fmt(s.weeklyHours)} sa`} sub={`${s.weeklyQuestions} soru`} />
        <Stat icon={Target} tone="text-cyan2" label="Ortalama net" value={fmt(s.avgNet)} sub={`Son 5 ${multi ? partDef.label + ' ' : ''}deneme · ${s.examCount} toplam`} />
        <Stat icon={Trophy} tone="text-amber-300" label="En iyi net" value={fmt(s.bestNet)} />
        <Stat icon={GraduationCap} label="Müfredat" value={`%${s.overallPercent}`} sub="Tamamlanan konular" />
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7 2xl:col-span-8">
          <Item className="card">
            <div className="stat-label mb-3">Net trendi · son 5 deneme</div>
            {s.trend.length < 2 ? <p className="py-12 text-center text-sm text-slate-500">Trend için en az 2 deneme ekle. <Link to="/denemeler" className="text-cyan2">Deneme ekle</Link></p> : (
              <Suspense fallback={<div className="h-[280px]" />}><TrendChart data={s.trend} /></Suspense>)}
          </Item>
          <Item className="card">
            <div className="stat-label mb-4">Konu ilerlemesi</div>
            <div className="grid gap-5 md:grid-cols-2">
              {subjects.map(({ key: k, label: l }, i) => { const c = ['bg-accent', 'bg-cyan2'][i % 2]; return (
                <div key={k}><div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-100">{l}</span><span className="num text-slate-400">{s.subjects[k].done}/{s.subjects[k].total} konu · {s.subjects[k].solved} soru</span></div>
                  <Bar percent={s.subjects[k].percent} label={`${l} konu ilerlemesi`} color={c} /></div>); })}
            </div>
            <div className="num mt-4 text-xs text-slate-500">{s.sections.map(x => `${x.label} ort. ${fmt(x.avg)}`).join(' · ')}</div>
          </Item>
        </div>
        <Item className="card xl:col-span-5 2xl:col-span-4">
          <div className="mb-3 flex items-center justify-between"><div className="stat-label">Haftalık sıralama · {cfg.id}{multi && ` ${partDef.label}`} · canlı</div><Link to="/arkadaslar" className="text-xs text-cyan2">Arkadaş ekle</Link></div>
          <SortTable columns={cols} rows={lb?.rows ?? []} rowKey={r => r.userId} defaultSort={{ key: 'rank', dir: 1 }} rowClass={r => r.isMe && 'bg-accent/[0.06]'} empty="Henüz sıralama yok." />
        </Item>
      </div>
      {!inKurum && <SupportCard compact />}
    </Page>
  );
}
