import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, UserPlus, Swords, Search } from 'lucide-react';
import { get, post, del } from '../lib/api.js';
import { usePoll } from '../lib/poll.js';

const VALID = /^[\p{L}\p{N}_.-]+$/u;
const Avatar = ({ name }) => <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold uppercase text-accent">{name.slice(0, 1)}</span>;
const Who = ({ name }) => <span className="flex min-w-0 items-center gap-3"><Avatar name={name} /><span className="truncate">@{name}</span></span>;

export default function Friends() {
  const [d, setD] = useState({ friends: [], incoming: [], outgoing: [] });
  const [q, setQ] = useState(''); const [res, setRes] = useState(null); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const load = () => get('/friends').then(setD).catch(() => {});
  usePoll(load, 15000);

  const term = q.trim().replace(/^@/, '');
  useEffect(() => {
    if (term.length < 2 || !VALID.test(term)) { setRes(null); return; }
    let alive = true;
    const t = setTimeout(() => get('/friends/search?q=' + encodeURIComponent(term)).then(r => alive && setRes(r.users)).catch(() => alive && setRes([])), 250);
    return () => { alive = false; clearTimeout(t); };
  }, [term]);

  const act = async (fn, ok) => {
    setMsg(null); setBusy(true);
    try { await fn(); if (ok) setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: e.message }); }
    setBusy(false); load();
  };
  const add = u => act(async () => {
    const r = await post('/friends/request', { username: u });
    setQ(''); setRes(null);
    setMsg({ ok: true, text: r.status === 'accepted' ? `@${u} ile arkadaş oldunuz 🎉` : `@${u} kullanıcısına istek gönderildi` });
  });
  // Enter: tam eşleşen kullanıcıya (yoksa ilk sonuca) istek gönder
  const submit = e => {
    e.preventDefault();
    if (busy || term.length < 3 || !VALID.test(term)) { if (term) setMsg({ ok: false, text: 'Kullanıcı adı en az 3 karakter olmalı (harf, rakam, _ . -).' }); return; }
    const exact = res?.find(u => u.username.toLowerCase() === term.toLowerCase());
    const target = exact ?? (res?.length === 1 ? res[0] : null);
    if (target && target.relation) return setMsg({ ok: false, text: target.relation === 'accepted' ? 'Zaten arkadaşsınız.' : 'İstek zaten beklemede.' });
    add(target?.username ?? term);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Arkadaşlar</h1>
      <form className="card" onSubmit={submit}>
        <label htmlFor="q">Arkadaş ekle · kullanıcı adıyla ara</label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input id="q" className="!pl-10" value={q} onChange={e => { setQ(e.target.value); setMsg(null); }} placeholder="@kullaniciadi" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={31} />
          </div>
          <button type="submit" className="btn shrink-0" disabled={busy || term.length < 3}><UserPlus size={15} /> <span className="hidden sm:inline">İstek gönder</span></button>
        </div>
        {res && res.length > 0 && <ul className="mt-3 divide-y divide-white/[0.06]">{res.map(u => (
          <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <Who name={u.username} />
            {u.relation === 'accepted' ? <span className="text-xs text-slate-500">Arkadaşsınız</span>
              : u.relation === 'pending' ? <span className="text-xs text-slate-500">İstek beklemede</span>
              : <button type="button" className="btn-ghost" disabled={busy} onClick={() => add(u.username)}><UserPlus size={14} /> İstek gönder</button>}
          </li>))}</ul>}
        {res && res.length === 0 && <p className="mt-3 text-xs text-slate-500">“{term}” ile başlayan kullanıcı bulunamadı.</p>}
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-2 text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
      </form>

      {d.incoming.length > 0 && (
        <div className="card"><div className="stat-label mb-2">Gelen istekler ({d.incoming.length})</div><ul className="divide-y divide-white/[0.06]">{d.incoming.map(u => (
          <li key={u.friendshipId} className="flex items-center justify-between gap-3 py-2 text-sm"><Who name={u.username} />
            <span className="flex gap-2">
              <button className="btn" disabled={busy} onClick={() => act(() => post(`/friends/${u.friendshipId}/accept`), `@${u.username} arkadaş listene eklendi`)}><Check size={14} /> Kabul Et</button>
              <button className="btn-ghost" disabled={busy} onClick={() => act(() => post(`/friends/${u.friendshipId}/reject`))}><X size={14} /> Reddet</button></span></li>))}</ul></div>)}
      <div className="card"><div className="stat-label mb-2">Arkadaşlarım ({d.friends.length})</div>
        <ul className="divide-y divide-white/[0.06]">{d.friends.map(u => (
          <li key={u.friendshipId} className="flex items-center justify-between gap-3 py-2 text-sm"><Who name={u.username} />
            <span className="flex gap-2">
              <Link className="btn" to={`/karsilastir/${u.userId}`}><Swords size={14} /> Karşılaştır</Link>
              <button className="btn-ghost" onClick={() => confirm(`@${u.username} arkadaşlıktan çıkarılsın mı?`) && act(() => del('/friends/' + u.friendshipId))}>Çıkar</button></span></li>))}
          {!d.friends.length && <li className="py-6 text-center text-sm text-slate-500">Henüz arkadaşın yok. Yukarıdan kullanıcı adıyla ara.</li>}</ul></div>
      {d.outgoing.length > 0 && (
        <div className="card"><div className="stat-label mb-2">Gönderilen istekler</div><ul className="divide-y divide-white/[0.06]">{d.outgoing.map(u => (
          <li key={u.friendshipId} className="flex items-center justify-between gap-3 py-2 text-sm"><Who name={u.username} />
            <button className="btn-ghost" disabled={busy} onClick={() => act(() => del('/friends/' + u.friendshipId))}>Geri çek</button></li>))}</ul></div>)}
    </div>
  );
}
