import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { Users, Activity, Gauge, ShieldCheck, ShieldOff, Ban, Trash2, UserPlus, LogIn, ClipboardCheck, BookOpen, Handshake, Server, Cpu, Clock3, KeyRound, Search, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import clsx from 'clsx';
import { api, get, fmt } from '../lib/api.js';
import { useAuth } from '../store.js';
import { Page, Item, Title, Stat, chartTip } from '../components/ui.jsx';

const tabs = [['/admin', 'Genel', Gauge, true], ['/admin/kullanicilar', 'Kullanıcılar', Users], ['/admin/etkinlik', 'Etkinlik', Activity], ['/admin/geri-bildirim', 'Geri bildirim', MessageSquare]];

function Tabs() {
  return (
    <Item className="glass-pill mx-auto flex w-fit gap-1 p-1">
      {tabs.map(([to, l, Icon, end]) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => clsx('relative flex items-center gap-2 rounded-full px-4 py-2 text-sm transition', isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200')}>
          {({ isActive }) => (<>
            {isActive && <motion.span layoutId="admin-tab" className="absolute inset-0 -z-0 rounded-full bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,.18)]" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
            <Icon size={16} strokeWidth={1.8} className="relative" /> <span className="relative hidden sm:inline">{l}</span></>)}
        </NavLink>))}
    </Item>
  );
}

function usePoll(path, ms) {
  const [d, setD] = useState(null);
  useEffect(() => { let alive = true; const l = () => get(path).then(x => alive && setD(x)).catch(() => {}); l(); const t = setInterval(l, ms); return () => { alive = false; clearInterval(t); }; }, [path, ms]);
  return d;
}
const up = s => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h} sa ${m} dk` : `${m} dk ${s % 60} sn`; };

function Overview() {
  const m = usePoll('/admin/metrics', 10000);
  if (!m) return <div className="text-slate-500">Yükleniyor…</div>;
  return (<>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat icon={Users} label="Kullanıcı" value={m.users} sub={`+${m.newThisWeek} bu hafta · ${m.admins} yönetici`} />
      <Stat icon={Activity} tone="text-cyan2" label="Aktif (7 gün)" value={m.activeThisWeek} sub={m.disabled ? `${m.disabled} askıda` : 'askıda hesap yok'} />
      <Stat icon={Clock3} label="Toplam çalışma" value={`${fmt(m.studyHours)} sa`} sub={`${m.sessions} oturum`} />
      <Stat icon={ClipboardCheck} tone="text-cyan2" label="Deneme" value={m.exams} sub={`Ort. net ${fmt(m.avgNet)}`} />
      <Stat icon={Handshake} label="Arkadaşlık" value={m.friendships} sub={`${m.pendingRequests} bekleyen istek`} />
      <Stat icon={KeyRound} tone="text-amber-300" label="Açık sıfırlama" value={m.openResets} sub="Geçerli token sayısı" />
      <Stat icon={Cpu} label="Bellek" value={`${m.server.memoryMb} MB`} sub={m.server.node} />
      <Stat icon={Server} tone="text-cyan2" label="Çalışma süresi" value={up(m.server.uptimeSec)} />
    </div>
    <Item className="card">
      <div className="stat-label mb-3">Son 7 gün · oturum ve yeni kayıt</div>
      <ResponsiveContainer width="100%" height={220}><BarChart data={m.daily}>
        <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="Day" tickFormatter={d => d.slice(5)} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} /><Tooltip {...chartTip} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
        <RBar name="Oturum" dataKey="Sessions" fill="#10B981" radius={[8, 8, 0, 0]} /><RBar name="Yeni kayıt" dataKey="Signups" fill="#06B6D4" radius={[8, 8, 0, 0]} />
      </BarChart></ResponsiveContainer>
    </Item>
  </>);
}

function UsersTab() {
  const me = useAuth(s => s.user);
  const [q, setQ] = useState(''); const [page, setPage] = useState(1); const [data, setData] = useState(null); const [err, setErr] = useState('');
  const list = data?.users; const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const load = () => get(`/admin/users?page=${page}&pageSize=20` + (q ? '&q=' + encodeURIComponent(q) : '')).then(setData).catch(e => setErr(e.message));
  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, page]); // eslint-disable-line
  const act = async (fn) => { setErr(''); try { await fn(); } catch (e) { setErr(e.message); } load(); };
  const patch = (id, body) => act(() => api('PATCH', '/admin/users/' + id, body));
  const date = s => s ? new Date(s + 'Z').toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <Item className="card overflow-x-auto">
      <div className="relative mb-4 max-w-sm"><Search size={15} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-500" />
        <input aria-label="Kullanıcı ara" className="!pl-9" placeholder="Kullanıcı adı veya e-posta" value={q} onChange={e => setQ(e.target.value)} maxLength={50} /></div>
      {err && <p role="alert" className="mb-3 text-xs text-red-300">{err}</p>}
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th className="th">Kullanıcı</th><th className="th">Kayıt</th><th className="th">Son giriş</th><th className="th text-right">Saat</th><th className="th text-right">Deneme</th><th className="th" /></tr></thead>
        <tbody>{list?.map(u => (
          <tr key={u.id} className="row">
            <td className="py-3"><div className="flex items-center gap-2">@{u.username}
              {u.isAdmin && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">YÖNETİCİ</span>}
              {u.isDisabled && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] text-red-300">ASKIDA</span>}</div>
              <div className="text-xs text-slate-500">{u.email}</div></td>
            <td className="num text-slate-400">{date(u.createdAt)}</td><td className="num text-slate-400">{date(u.lastLoginAt)}</td>
            <td className="num text-right">{fmt(u.studyHours)}</td><td className="num text-right">{u.exams}</td>
            <td><div className="flex justify-end gap-2">
              {u.id !== me.id && <>
                <button className="btn-ghost !px-3" title={u.isAdmin ? 'Yöneticiliği kaldır' : 'Yönetici yap'} aria-label={u.isAdmin ? 'Yöneticiliği kaldır' : 'Yönetici yap'}
                  onClick={() => patch(u.id, { isAdmin: !u.isAdmin })}>{u.isAdmin ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}</button>
                <button className="btn-ghost !px-3" title={u.isDisabled ? 'Askıyı kaldır' : 'Askıya al'} aria-label={u.isDisabled ? 'Askıyı kaldır' : 'Askıya al'}
                  onClick={() => patch(u.id, { isDisabled: !u.isDisabled })}><Ban size={15} /></button>
                {!u.isAdmin && <button className="btn-danger !px-3" title="Sil" aria-label="Sil"
                  onClick={() => confirm(`@${u.username} ve tüm verileri kalıcı olarak silinsin mi?`) && act(() => api('DELETE', '/admin/users/' + u.id))}><Trash2 size={15} /></button>}</>}
            </div></td>
          </tr>))}
          {list && !list.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Sonuç yok.</td></tr>}</tbody>
      </table>
      {data && data.total > data.pageSize && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span className="num">{data.total} kullanıcı · sayfa {page}/{pages}</span>
          <div className="flex gap-2">
            <button className="btn-ghost !px-3 !py-1.5" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Önceki sayfa"><ChevronLeft size={14} /></button>
            <button className="btn-ghost !px-3 !py-1.5" disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="Sonraki sayfa"><ChevronRight size={14} /></button>
          </div>
        </div>)}
    </Item>
  );
}

const KIND = {
  signup: [UserPlus, 'text-accent', 'kayıt oldu'], login: [LogIn, 'text-cyan2', 'giriş yaptı'], exam: [ClipboardCheck, 'text-amber-300', 'deneme ekledi'],
  session: [BookOpen, 'text-accent', 'çalıştı'], friend: [Handshake, 'text-cyan2', 'arkadaşlık'],
};
function ActivityTab() {
  const d = usePoll('/admin/activity', 8000);
  const [shown, setShown] = useState(12);
  const ago = at => { const s = Math.max(0, (Date.now() - new Date(at).getTime()) / 1000); return s < 90 ? 'şimdi' : s < 3600 ? `${Math.floor(s / 60)} dk` : s < 86400 ? `${Math.floor(s / 3600)} sa` : `${Math.floor(s / 86400)} g`; };
  return (
    <Item className="card">
      <div className="mb-3 flex items-center gap-2"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative h-2 w-2 rounded-full bg-accent" /></span><span className="stat-label">Canlı etkinlik · 8 sn</span></div>
      {!d ? <div className="text-slate-500">Yükleniyor…</div> : <ul>{d.events.slice(0, shown).map((e, i) => { const [Icon, tone, text] = KIND[e.kind]; return (
        <li key={i} className="row flex items-center gap-3 py-2.5 text-sm">
          <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06]', tone)}><Icon size={15} /></span>
          <span className="min-w-0 flex-1 truncate"><b className="font-medium text-slate-100">@{e.username}</b> <span className="text-slate-400">{text}</span>{e.detail && <span className="text-slate-500"> · {e.detail}</span>}</span>
          <span className="num text-xs text-slate-500">{ago(e.at)}</span></li>); })}</ul>}
      {d && d.events.length > shown && <button className="btn-ghost mt-3 w-full" onClick={() => setShown(n => n + 12)}>Daha fazla göster ({d.events.length - shown})</button>}
    </Item>
  );
}

const CAT = { oneri: 'Öneri', hata: 'Hata', soru: 'Soru', diger: 'Diğer' };
const MAIL = { sent: ['Gönderildi', 'bg-emerald-400/15 text-emerald-300'], queued: ['Kayıtlı', 'bg-cyan-400/15 text-cyan-300'], failed: ['Mail hatası', 'bg-red-500/15 text-red-300'] };
function FeedbackTab() {
  const [page, setPage] = useState(1); const [d, setD] = useState(null);
  useEffect(() => { get('/admin/feedback?page=' + page).then(setD).catch(() => {}); }, [page]);
  const pages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;
  return (
    <Item className="card">
      {!d ? <div className="text-slate-500">Yükleniyor…</div> : !d.items.length ? <p className="py-8 text-center text-slate-500">Henüz geri bildirim yok.</p> : (
        <ul>{d.items.map(f => (
          <li key={f.id} className="row py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm"><b className="font-medium text-slate-100">{f.subject}</b>
              <span className="badge bg-white/[0.06] text-slate-300">{CAT[f.category]}</span>
              <span className={clsx('badge', MAIL[f.mailStatus][1])} title={f.mailError ?? undefined}>{MAIL[f.mailStatus][0]}</span>
              <span className="ml-auto text-xs text-slate-500">@{f.username} · {new Date(f.createdAt + 'Z').toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{f.message}</p>
          </li>))}</ul>)}
      {d && d.total > d.pageSize && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span className="num">{d.total} kayıt · sayfa {page}/{pages}</span>
          <div className="flex gap-2">
            <button className="btn-ghost !px-3 !py-1.5" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Önceki sayfa"><ChevronLeft size={14} /></button>
            <button className="btn-ghost !px-3 !py-1.5" disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="Sonraki sayfa"><ChevronRight size={14} /></button>
          </div>
        </div>)}
    </Item>
  );
}

export default function Admin() {
  return (
    <Page>
      <Title>Yönetim</Title>
      <Tabs />
      <Routes>
        <Route index element={<Overview />} />
        <Route path="kullanicilar" element={<UsersTab />} />
        <Route path="etkinlik" element={<ActivityTab />} />
        <Route path="geri-bildirim" element={<FeedbackTab />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Page>
  );
}
