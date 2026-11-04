import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fmt } from '../lib/api.js';
import { chartTip } from './ui.jsx';

export default function TrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity={0.35} /><stop offset="100%" stopColor="#10B981" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
        <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} /><YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} />
        <Tooltip {...chartTip} formatter={v => [fmt(v), 'Toplam net']} />
        <Area type="monotone" dataKey="net" stroke="#10B981" strokeWidth={2.5} fill="url(#g)" dot={{ r: 3, fill: '#10B981' }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
