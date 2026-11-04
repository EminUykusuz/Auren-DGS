import { motion } from 'framer-motion';
import { useTheme } from '../theme.js';

const usePerf = () => useTheme(s => s.perf);

// Kademeli (stagger) giriş animasyonları
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };
export const rise = { hidden: { opacity: 0, y: 14, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 26 } } };

export const Page = ({ children, className = '' }) => usePerf()
  ? <div className={`space-y-4 ${className}`}>{children}</div>
  : <motion.div variants={stagger} initial="hidden" animate="show" className={`space-y-4 ${className}`}>{children}</motion.div>;
export const Item = ({ children, className = '' }) => usePerf() ? <div className={className}>{children}</div> : <motion.div variants={rise} className={className}>{children}</motion.div>;
export const Title = ({ children, right }) => (
  <Item className="flex flex-wrap items-center justify-between gap-3">
    <h1 className="text-2xl font-semibold tracking-tight text-slate-50">{children}</h1>{right}
  </Item>
);

export const Stat = ({ label, value, sub, icon: Icon, tone = 'text-accent' }) => (
  <Item className="card">
    <div className="flex items-center justify-between"><div className="stat-label">{label}</div>{Icon && <Icon size={16} className={tone} />}</div>
    <div className="stat-value mt-2">{value}</div>
    {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
  </Item>
);

export const Bar = ({ percent, color = 'bg-accent', label = 'İlerleme' }) => {
  const perf = usePerf();
  return (
  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-label={label} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`%${Math.round(percent)}`}>
    {perf ? <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      : <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />}
  </div>
  );
};

export const chartTip = { contentStyle: { background: 'rgb(var(--s900) / .92)', color: 'rgb(var(--s100))', backdropFilter: 'blur(12px)', border: '1px solid rgb(var(--fg) / .1)', borderRadius: 16, fontSize: 12 } };
