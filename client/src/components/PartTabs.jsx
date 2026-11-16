import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useExam, useExamCfg } from '../store.js';

// YKS'de TYT ⇄ AYT oturum seçici. Seçim kalıcıdır; müfredat, çalışma kaydı, zamanlayıcı ve istatistikler hep buna göre çalışır.
// Tek bölümlü sınavda (DGS) gösterilmez.
export default function PartTabs({ label = 'Çalıştığın oturum', className = '', id = 'part' }) {
  const { cfg, part } = useExamCfg(); const setPart = useExam(s => s.setPart);
  if (cfg.parts.length < 2) return null;
  return (
    <div className={clsx('inline-flex items-center gap-2.5', className)}>
      <span className="hidden text-xs text-slate-400 sm:inline">{label}</span>
      <div role="tablist" aria-label={label} className="relative inline-grid grid-flow-col rounded-full border border-white/10 bg-white/[0.04] p-1">
        {cfg.parts.map(p => (
          <button key={p.id} role="tab" aria-selected={part === p.id} onClick={() => setPart(p.id)}
            className={clsx('relative rounded-full px-4 py-1.5 text-xs font-bold transition-colors', part === p.id ? 'text-onaccent' : 'text-slate-400 hover:text-slate-200')}>
            {part === p.id && <motion.span layoutId={id + '-pill'} className="absolute inset-0 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span className="relative">{p.label}</span>
          </button>))}
      </div>
    </div>
  );
}
