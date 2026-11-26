import { Link } from 'react-router-dom';
import { Item } from './ui.jsx';

/* "Nasıl kullanılır" sayfaları için ortak parçalar: numaralı adımlar ve başlıklı kart. Metin dışında mantık yok. */

export const Steps = ({ items }) => (
  <ol className="mt-4 grid gap-4">
    {items.map(([title, text, to, linkText], i) => (
      <li key={title} className="flex gap-3.5">
        <span className="num mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent" aria-hidden="true">{i + 1}</span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-slate-100">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-400">{text}</p>
          {to && <Link to={to} className="mt-1 inline-block text-sm font-semibold text-accent hover:underline">{linkText ?? 'Aç'} →</Link>}
        </div>
      </li>))}
  </ol>
);

export const Block = ({ icon: Icon, title, intro, children }) => (
  <Item className="card">
    <div className="flex items-center gap-2.5">
      {Icon && <Icon size={18} className="text-accent" strokeWidth={1.8} aria-hidden="true" />}
      <h2 className="text-lg font-semibold tracking-tight text-slate-50">{title}</h2>
    </div>
    {intro && <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{intro}</p>}
    {children}
  </Item>
);

export const Note = ({ children }) => (
  <p className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-xs leading-relaxed text-slate-400">{children}</p>
);
