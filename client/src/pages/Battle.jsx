import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Crown } from 'lucide-react';
import { get, fmt } from '../lib/api.js';
import { usePoll } from '../lib/poll.js';
import { Page, Item, Title, chartTip } from '../components/ui.jsx';

const POLL_MS = 15000; // canlı: 15 sn'de bir yenilenir

function Row({ label, a, b, unit = '', format = fmt }) {
  const win = a > b ? 'a' : b > a ? 'b' : null;
  const pa = Math.max(a, 0), pb = Math.max(b, 0), total = Math.max(pa + pb, 0.0001);
  const cls = side => win === side ? 'font-semibold text-slate-50' : 'text-slate-400';
  return (
    <div className="row py-3 first:border-0">
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className={`num flex items-center gap-1 ${cls('a')}`}>{win === 'a' && <Crown size={13} className="text-amber-300" />}{format(a)}{unit}</span>
        <span className="stat-label">{label}</span>
        <span className={`num flex items-center gap-1 ${cls('b')}`}>{format(b)}{unit}{win === 'b' && <Crown size={13} className="text-amber-300" />}</span>
      </div>
      <div className="flex h-2 gap-1 overflow-hidden rounded-full">
        <div className="flex flex-1 justify-end rounded-l-full bg-white/[0.05]"><motion.div className="h-full rounded-l-full bg-accent" initial={{ width: 0 }} animate={{ width: `${(pa / total) * 100}%` }} transition={{ type: 'spring', stiffness: 110, damping: 20 }} /></div>
        <div className="flex flex-1 rounded-r-full bg-white/[0.05]"><motion.div className="h-full rounded-r-full bg-cyan2" initial={{ width: 0 }} animate={{ width: `${(pb / total) * 100}%` }} transition={{ type: 'spring', stiffness: 110, damping: 20 }} /></div>
      </div>
    </div>
  );
}

// Her ekseni iki kullanıcının en büyüğüne göre 0-100 ölçekler
function radarData(me, fr) {
  const m = [['Saat', 'weeklyHours'], ['Soru', 'weeklyQuestions'], ['Ort. net', 'avgNet'], ['Mat. net', 'mathAvg'], ['Türk. net', 'turkceAvg'], ['İlerleme', 'overallPercent']];
  return m.map(([name, k]) => { const mx = Math.max(me[k], fr[k], 0.0001); return { name, me: Math.round(Math.max(me[k], 0) / mx * 100), fr: Math.round(Math.max(fr[k], 0) / mx * 100) }; });
}
function trendData(me, fr) {
  const n = Math.max(me.trend.length, fr.trend.length);
  return Array.from({ length: n }, (_, i) => ({ n: `#${i + 1}`, me: me.trend[me.trend.length - n + i]?.net ?? null, fr: fr.trend[fr.trend.length - n + i]?.net ?? null }));
}

export default function Battle() {
  const { friendId } = useParams(); const nav = useNavigate();
  const [friends, setFriends] = useState(null); const [data, setData] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { get('/friends').then(r => setFriends(r.friends)); }, []);
  useEffect(() => { setData(null); setErr(''); }, [friendId]);
  usePoll(() => { if (friendId) get('/compare/' + friendId).then(d => (setData(d), setErr(''))).catch(e => setErr(e.message)); }, POLL_MS, [friendId]);

  return (
    <Page>
      <Title right={<select className="!w-56" aria-label="Arkadaş seç" value={friendId ?? ''} onChange={e => e.target.value && nav('/karsilastir/' + e.target.value)}>
        <option value="">Arkadaş seç…</option>{friends?.map(f => <option key={f.userId} value={f.userId}>@{f.username}</option>)}</select>}>Yüz yüze</Title>
      {friends && !friends.length && <Item className="card text-sm text-slate-400">Karşılaştırma için önce arkadaş eklemelisin. <Link to="/arkadaslar" className="text-cyan2">Arkadaşlar</Link></Item>}
      {err && <div role="alert" className="card text-sm text-red-300">{err}</div>}
      {data && (() => { const { me, friend: fr } = data; return (<>
        <Item className="card">
          <div className="grid grid-cols-2 pb-3 text-center">
            <div><div className="text-xs text-slate-400">Sen</div><div className="text-xl font-semibold text-accent">@{me.username}</div></div>
            <div><div className="text-xs text-slate-400">Rakip</div><div className="text-xl font-semibold text-cyan2">@{fr.username}</div></div>
          </div>
          <Row label="Haftalık çalışma (saat)" a={me.weeklyHours} b={fr.weeklyHours} />
          <Row label="Haftalık soru" a={me.weeklyQuestions} b={fr.weeklyQuestions} format={v => v} />
          <Row label="Ortalama toplam net" a={me.avgNet} b={fr.avgNet} />
          <Row label="Matematik ort. net" a={me.mathAvg} b={fr.mathAvg} />
          <Row label="Türkçe ort. net" a={me.turkceAvg} b={fr.turkceAvg} />
          <Row label="En iyi net" a={me.bestNet} b={fr.bestNet} />
          <Row label="Matematik konuları" a={me.subjects.matematik.percent} b={fr.subjects.matematik.percent} unit="%" format={v => v} />
          <Row label="Türkçe konuları" a={me.subjects.turkce.percent} b={fr.subjects.turkce.percent} unit="%" format={v => v} />
          <p className="mt-3 text-center text-xs text-slate-500">Hafta başı {data.weekStart} · canlı, 15 sn'de bir yenilenir</p>
        </Item>
        <div className="grid gap-4 lg:grid-cols-2">
          <Item className="card"><div className="stat-label mb-2">Güç dağılımı (göreli)</div>
            <ResponsiveContainer width="100%" height={260}><RadarChart data={radarData(me, fr)}>
              <PolarGrid stroke="rgba(255,255,255,.1)" /><PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Radar name={'@' + me.username} dataKey="me" stroke="#10B981" fill="#10B981" fillOpacity={0.25} />
              <Radar name={'@' + fr.username} dataKey="fr" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.2} />
              <Legend wrapperStyle={{ fontSize: 12 }} /><Tooltip {...chartTip} />
            </RadarChart></ResponsiveContainer></Item>
          <Item className="card"><div className="stat-label mb-2">Son denemelerde toplam net</div>
            <ResponsiveContainer width="100%" height={260}><LineChart data={trendData(me, fr)}>
              <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="n" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} /><Tooltip {...chartTip} formatter={v => fmt(v)} />
              <Line name={'@' + me.username} dataKey="me" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              <Line name={'@' + fr.username} dataKey="fr" stroke="#06B6D4" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </LineChart></ResponsiveContainer></Item>
        </div></>); })()}
    </Page>
  );
}
