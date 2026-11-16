import { useExam } from '../store.js';

// DGS ⇄ YKS mod seçici: iki seçenekli kayan "hap" (radiogroup). Tercih kalıcıdır (localStorage + profil).
const MODES = [['DGS', 'DGS'], ['YKS', 'YKS']];

export default function ModeSwitch({ className = '', compact = false }) {
  const mode = useExam(s => s.mode), setMode = useExam(s => s.setMode);
  const idx = MODES.findIndex(([id]) => id === mode);
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setMode(MODES[(idx + 1) % MODES.length][0]); }
  };
  return (
    <div role="radiogroup" aria-label="Sınav modu" onKeyDown={onKey}
      className={`relative inline-grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.05] p-1 backdrop-blur-xl ${className}`}>
      <span aria-hidden="true" className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-accent shadow-[0_6px_18px_-6px_rgb(var(--accent)/.7)] transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${idx * 100}%)` }} />
      {MODES.map(([id, label]) => (
        <button key={id} type="button" role="radio" aria-checked={mode === id} tabIndex={mode === id ? 0 : -1} onClick={() => setMode(id)}
          className={`relative z-10 rounded-full text-center text-xs font-bold tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${compact ? 'px-3 py-1.5' : 'px-5 py-2'} ${mode === id ? 'text-onaccent' : 'text-slate-400 hover:text-slate-200'}`}>
          {label}
        </button>))}
    </div>
  );
}
