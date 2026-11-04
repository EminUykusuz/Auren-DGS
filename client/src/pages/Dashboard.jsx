import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Target, Trophy, GraduationCap } from 'lucide-react';
import { get, fmt } from '../lib/api.js';
import { usePoll } from '../lib/poll.js';
import { Page, Item, Title, Stat, Bar } from '../components/ui.jsx';
import SortTable from '../components/SortTable.jsx';
import Countdown from '../components/Countdown.jsx';

const TrendChart = lazy(() => import('../components/TrendChart.jsx'));
export { Bar };
const POLL_MS = 15000;

export default function Dashboard() {
  const [s, setS] = useState(null); const [lb, setLb] = useState(null);
  usePoll(() => { get('/stats/me').then(setS).catch(() => {}); get('/leaderboard').then(setLb).catch(() => {}); }, POLL_MS);

  const cols = useMemo(() => [
    { key: 'rank', label: '#', className: 'w-10 num' },
    { key: 'username', label: 'Kullanıcı', firstDir: 1, render: r => <span className={r.isMe ? 'font-semibold text-accent' : 'text-slate-100'}>@{r.username}{r.isMe && ' (sen)'}</span> },
    { key: 'weeklyHours', label: 'Saat', align: 'right', firstDir: -1, render: r => fmt(r.weeklyHours) },
    { key: 'avgNet', label: 'Ort. net', align: 'right', firstDir: -1, render: r => fmt(r.avgNet) },
    { key: 'overallPercent', label: 'Müfredat', align: 'right', firstDir: -1, render: r => `%${r.overallPercent}` },
  ], []);

  if (!s) return <div className="text-slate-500">Yükleniyor…</div>;
  return (
    <Page>
      <Title>Panel</Title>
      <Countdown />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat icon={Flame} label="Bu hafta" value={`${fmt(s.weeklyHours)} sa`} sub={`${s.weeklyQuestions} soru`} />
        <Stat icon={Target} tone="text-cyan2" label="Ortalama net" value={fmt(s.avgNet)} sub={`Son 5 deneme · ${s.examCount} toplam`} />
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
              {[['matematik', 'Matematik', 'bg-accent'], ['turkce', 'Türkçe', 'bg-cyan2']].map(([k, l, c]) => (
                <div key={k}><div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-100">{l}</span><span className="num text-slate-400">{s.subjects[k].done}/{s.subjects[k].total} konu · {s.subjects[k].solved} soru</span></div>
                  <Bar percent={s.subjects[k].percent} label={`${l} konu ilerlemesi`} color={c} /></div>))}
            </div>
            <div className="num mt-4 text-xs text-slate-500">Matematik ort. {fmt(s.mathAvg)} · Türkçe ort. {fmt(s.turkceAvg)}</div>
          </Item>
        </div>
        <Item className="card xl:col-span-5 2xl:col-span-4">
          <div className="mb-3 flex items-center justify-between"><div className="stat-label">Haftalık sıralama · canlı</div><Link to="/arkadaslar" className="text-xs text-cyan2">Arkadaş ekle</Link></div>
          <SortTable columns={cols} rows={lb?.rows ?? []} rowKey={r => r.userId} defaultSort={{ key: 'rank', dir: 1 }} rowClass={r => r.isMe && 'bg-accent/[0.06]'} empty="Henüz sıralama yok." />
        </Item>
      </div>
    </Page>
  );
}
