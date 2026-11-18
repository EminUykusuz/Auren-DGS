import { motion } from 'framer-motion';
import { GraduationCap, Layers, School } from 'lucide-react';
import clsx from 'clsx';

// Hazırlanılan sınav türü: DGS | YKS | BOTH (hibrit). Seçili kartın vurgusu kartlar arasında kayar.
export const TRACKS = [
  { id: 'DGS', icon: GraduationCap, name: 'DGS', sub: 'Dikey Geçiş Sınavı' },
  { id: 'YKS', icon: School, name: 'YKS', sub: 'TYT ve AYT' },
  { id: 'BOTH', icon: Layers, name: 'Hibrit', sub: 'Her iki sınava da hazırlanıyorum' },
];

export default function TrackPicker({ value, onChange, id = 'track', className = '' }) {
  return (
    <div role="radiogroup" aria-label="Hazırlandığın sınav" className={clsx('grid gap-2 sm:grid-cols-3 sm:gap-2.5', className)}>
      {TRACKS.map(({ id: t, icon: Icon, name, sub }) => {
        const on = value === t;
        return (
          <motion.button key={t} type="button" role="radio" aria-checked={on} onClick={() => onChange(t)} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left sm:p-3.5 transition-colors hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {on && <motion.span layoutId={id + '-sel'} className="absolute inset-0 rounded-2xl border border-accent/70 bg-accent/10" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span className="relative flex items-center gap-3 sm:block">
              <Icon size={18} strokeWidth={1.8} className={clsx('shrink-0 transition-colors sm:mb-2', on ? 'text-accent' : 'text-slate-400')} />
              <span className="min-w-0"><span className={clsx('block text-base font-bold', on ? 'text-accent' : 'text-slate-100')}>{name}</span>
              <span className="block text-[11px] leading-snug text-slate-400">{sub}</span></span>
            </span>
          </motion.button>);
      })}
    </div>
  );
}
