import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { fmt } from '../lib/api.js';
import { chartTip } from './ui.jsx';
import { REASONS } from '../lib/reasons.js';

// Tüm denemeler: toplam / matematik / Türkçe net (eskiden yeniye)
export function NetTrend({ exams }) {
  const data = [...exams].reverse().map(e => ({ date: e.ExamDate.slice(5), name: e.ExamName, Toplam: e.TotalNet, Matematik: Number(e.MathNet), 'Türkçe': Number(e.TurkceNet) }));
  return (
    <div role="img" aria-label={`Deneme net trendi, ${data.length} deneme`}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
          <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
          <Tooltip {...chartTip} labelFormatter={(_, p) => p?.[0]?.payload?.name} formatter={v => fmt(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="Toplam" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line dataKey="Matematik" stroke="#06B6D4" strokeWidth={1.8} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
          <Line dataKey="Türkçe" stroke="#818CF8" strokeWidth={1.8} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Neden dağılımı: ders bazında yığılmış yatay çubuk
export function ReasonBars({ rows }) {
  const data = REASONS.map(r => ({ name: r.label, Matematik: rows.find(x => x.reason === r.key && x.subject === 'matematik')?.total ?? 0, 'Türkçe': rows.find(x => x.reason === r.key && x.subject === 'turkce')?.total ?? 0 }));
  return (
    <div role="img" aria-label="Yanlış nedenlerinin dağılımı">
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={104} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip {...chartTip} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Matematik" stackId="a" fill="#06B6D4" isAnimationActive={false} />
          <Bar dataKey="Türkçe" stackId="a" fill="#818CF8" radius={[0, 8, 8, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
