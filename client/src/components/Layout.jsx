import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Clock, Timer as TimerIcon, ClipboardCheck, BookOpen, Users, Swords, LogOut, ShieldCheck, Settings, Sun, Moon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../store.js';
import { useTheme, bgCss } from '../theme.js';
import { get } from '../lib/api.js';
import { usePoll } from '../lib/poll.js';
import Credit from './Credit.jsx';

// Statik ortam ışığı (animasyonsuz); renkler temadan gelir, "Işıkları kapat" ile gizlenir
const glow = (n) => `radial-gradient(closest-side, rgb(var(--glow-${n}) / var(--glow-${n}-o)), rgb(var(--glow-${n}) / 0))`;
export const Ambient = () => {
  const img = useTheme(bgCss);
  return (
  <div aria-hidden="true" className="ambient-layer pointer-events-none fixed inset-0 -z-10 overflow-hidden">
    {img && <><div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: img }} /><div className="absolute inset-0" style={{ background: 'rgb(var(--bg) / .45)' }} /></>}
    <div className="ambient-glow absolute inset-0 bg-gradient-to-tr from-emerald-500/[0.06] via-transparent to-cyan-500/[0.06]" />
    <div className="ambient-glow absolute left-[-12%] top-[-14%] h-[720px] w-[720px]" style={{ background: glow('a') }} />
    <div className="ambient-glow absolute bottom-[-18%] right-[-10%] h-[800px] w-[800px]" style={{ background: glow('b') }} />
    <div className="ambient-glow absolute left-[30%] top-[35%] h-[560px] w-[560px]" style={{ background: glow('c') }} />
  </div>
  );
};

const nav = [
  ['/', 'Panel', LayoutDashboard], ['/calisma', 'Çalışma', Clock], ['/kronometre', 'Zamanlayıcı', TimerIcon], ['/denemeler', 'Denemeler', ClipboardCheck],
  ['/mufredat', 'Müfredat', BookOpen], ['/arkadaslar', 'Arkadaşlar', Users], ['/karsilastir', 'Karşılaştır', Swords],
];
const titles = { '': 'Panel', calisma: 'Çalışma kaydı', kronometre: 'Zamanlayıcı', denemeler: 'Denemeler', mufredat: 'Müfredat ve güç analizi', arkadaslar: 'Arkadaşlar', karsilastir: 'Yüz yüze karşılaştırma', ayarlar: 'Ayarlar', admin: 'Yönetim' };

export const Fallback = () => (
  <div className="min-h-[60vh]" role="status" aria-label="Yükleniyor">
    <div className="h-9 w-48 animate-pulse rounded-2xl bg-white/[0.05]" />
    <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-[28px] bg-white/[0.04]" />)}</div>
  </div>
);

const itemCls = (isActive, collapsed) => clsx('relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
  collapsed && 'justify-center', isActive ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)]' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200');

// Simge-only modda hover/odak ile beliren ipucu
const Tip = ({ children, show }) => show ? (
  <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-40 ml-3 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-xl border border-white/[0.08] bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg backdrop-blur-xl transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100">{children}</span>) : null;

function Item({ to, label, Icon, collapsed, badge }) {
  return (
    <div className="group relative">
      <NavLink to={to} end={to === '/' || to === '/admin'} aria-label={collapsed ? (badge > 0 ? `${label}, ${badge} bekleyen istek` : label) : undefined} className={({ isActive }) => itemCls(isActive, collapsed)}>
        <span className="relative"><Icon size={19} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
          {badge > 0 && <span aria-hidden="true" className="num absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-onaccent">{badge}</span>}</span>
        {!collapsed && label}
      </NavLink>
      <Tip show={collapsed}>{label}</Tip>
    </div>
  );
}

export function Shell() {
  const { user, logout } = useAuth(); const { theme, toggleMode } = useTheme(); const loc = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('dgs_nav') !== 'open');   // varsayılan: simge dock'u
  const toggle = () => setCollapsed(c => { localStorage.setItem('dgs_nav', c ? 'open' : 'closed'); return !c; });
  const [pending, setPending] = useState(0);
  usePoll(() => get('/friends').then(r => setPending(r.incoming.length)).catch(() => {}), 30000);
  const seg = loc.pathname.split('/')[1] ?? '';
  useEffect(() => { document.title = `${titles[seg] ?? 'Auren DGS'} · Auren DGS`; }, [seg]);
  const items = [...nav.map(([to, l, I]) => ({ to, l, I, badge: to === '/arkadaslar' ? pending : 0 })), ...(user.isAdmin ? [{ to: '/admin', l: 'Yönetim', I: ShieldCheck }] : [])];
  const light = theme === 'light';

  return (
    <div className="min-h-screen">
      <Ambient />
      <aside className={clsx('card-fixed fixed left-4 top-4 z-30 hidden transition-[width] duration-300 md:block', collapsed ? 'w-[72px]' : 'w-56')}>
        <div className="card !rounded-[32px] !p-3">
          <div className={clsx('flex items-center pb-3 pt-2', collapsed ? 'flex-col gap-2' : 'justify-between px-3')}>
            {collapsed ? <div className="text-lg font-bold text-accent" aria-label="Auren DGS">A</div>
              : <div className="min-w-0"><div className="text-lg font-bold tracking-tight text-white">Auren <span className="text-accent">DGS</span></div><div className="truncate text-xs text-slate-500">@{user.username}</div></div>}
            <button onClick={toggle} aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'} aria-expanded={!collapsed} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-slate-200">
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
          </div>
          <nav aria-label="Ana menü" className="space-y-1">{items.map(i => <Item key={i.to} to={i.to} label={i.l} Icon={i.I} collapsed={collapsed} badge={i.badge} />)}</nav>
          <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-2">
            <Item to="/ayarlar" label="Ayarlar" Icon={Settings} collapsed={collapsed} />
            <div className="group relative">
              <button onClick={toggleMode} aria-label={light ? 'Koyu temaya geç' : 'Açık temaya geç'} className={clsx('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-200', collapsed && 'justify-center')}>
                {light ? <Moon size={19} strokeWidth={1.8} /> : <Sun size={19} strokeWidth={1.8} />}{!collapsed && (light ? 'Koyu tema' : 'Açık tema')}</button>
              <Tip show={collapsed}>{light ? 'Koyu tema' : 'Açık tema'}</Tip>
            </div>
            <div className="group relative">
              <button onClick={logout} aria-label="Çıkış" className={clsx('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-200', collapsed && 'justify-center')}>
                <LogOut size={19} strokeWidth={1.8} />{!collapsed && 'Çıkış'}</button>
              <Tip show={collapsed}>Çıkış</Tip>
            </div>
          </div>
        </div>
      </aside>

      <nav aria-label="Mobil menü" className="glass-pill fixed inset-x-3 bottom-3 z-30 flex justify-between gap-1 overflow-x-auto p-1.5 md:hidden">
        {[...items, { to: '/ayarlar', l: 'Ayarlar', I: Settings }].map(({ to, l, I }) => (
          <NavLink key={to} to={to} end={to === '/' || to === '/admin'} aria-label={l} className={({ isActive }) => clsx('flex min-w-[44px] flex-1 items-center justify-center rounded-full p-2.5', isActive ? 'bg-white/15 text-white' : 'text-slate-400')}>
            <I size={20} strokeWidth={1.8} aria-hidden="true" /></NavLink>))}
      </nav>

      <main className={clsx('mx-auto max-w-[1680px] px-4 pb-28 pt-6 transition-[padding] duration-300 md:pb-10 md:pr-6', collapsed ? 'md:pl-[6.5rem]' : 'md:pl-[15.5rem]')}>
        <div key={seg} className="fade-in"><Suspense fallback={<Fallback />}><Outlet /></Suspense></div>
        <Credit />
      </main>
    </div>
  );
}
