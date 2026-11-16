import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { fmt } from '../lib/api.js';
import { chartTip } from './ui.jsx';
import { REASONS, SERIES_COLORS } from '../lib/reasons.js';

// Seçili bölümdeki denemeler: toplam + bölüm bazlı net (eskiden yeniye). sections: [{ key, label }]
export function NetTrend({ exams, sections }) {
  const data = [...exams].reverse().map(e => ({ date: e.ExamDate.slice(5), name: e.ExamName, Toplam: e.TotalNet,
    ...Object.fromEntries(sections.map(s => [s.label, e.Sections.find(x => x.key === s.key)?.net ?? 0])) }));
  return (
    <div role="img" aria-label={`Deneme net trendi, ${data.length} deneme`}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
          <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} domain={[0, 'auto']} />
          <Tooltip {...chartTip} labelFormatter={(_, p) => p?.[0]?.payload?.name} formatter={v => fmt(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="Toplam" stroke="rgb(var(--accent))" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          {sections.map((s, i) => <Line key={s.key} dataKey={s.label} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={1.6} dot={false} strokeDasharray="4 3" isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Neden dağılımı: ders bazında yığılmış yatay çubuk. subjects: [{ key, label }] (satırlarda bulunan dersler)
export function ReasonBars({ rows, subjects }) {
  const data = REASONS.map(r => ({ name: r.label, ...Object.fromEntries(subjects.map(s => [s.label, rows.find(x => x.reason === r.key && x.subject === s.key)?.total ?? 0])) }));
  return (
    <div role="img" aria-label="Yanlış nedenlerinin dağılımı">
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
          <CartesianGrid stroke="rgba(255,255,255,.06)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={104} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip {...chartTip} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {subjects.map((s, i) => <Bar key={s.key} dataKey={s.label} stackId="a" fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={i === subjects.length - 1 ? [0, 8, 8, 0] : 0} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
