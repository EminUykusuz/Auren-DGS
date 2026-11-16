import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, UserPlus, Swords, Search, Trophy } from 'lucide-react';
import clsx from 'clsx';
import { get, post, del } from '../lib/api.js';
import { usePoll } from '../lib/poll.js';
import { useExam, useExamCfg } from '../store.js';
import { fmt } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';
import { Bar } from '../components/ui.jsx';

const VALID = /^[\p{L}\p{N}_.-]+$/u;
const Who = ({ name, url }) => <span className="flex min-w-0 items-center gap-3"><Avatar name={name} url={url} /><span className="truncate">@{name}</span></span>;

const MEDAL = ['text-amber-300', 'text-slate-300', 'text-orange-400'];

// Seçili sınav modundaki haftalık puan ve netlere göre arkadaş sıralaması
function Rivalry() {
  const { cfg, part, partDef, q } = useExamCfg(); const setPart = useExam(x => x.setPart); const multi = cfg.parts.length > 1;
  const [lb, setLb] = useState(null);
  usePoll(() => { get('/leaderboard' + q({ part })).then(setLb).catch(() => {}); }, 15000, [part]);
  if (!lb || lb.examType !== cfg.id) return null;
  if (lb.rows.length < 2) return <div className="card"><div className="stat-label mb-2 flex items-center gap-2"><Trophy size={13} /> {cfg.id} sıralaması</div><p className="py-4 text-center text-sm text-slate-500">Rekabet için arkadaş ekle; haftalık puan ve netlerinle sıralanırsınız.</p></div>;
  const max = Math.max(...lb.rows.map(r => r.weeklyPoints), 1);
  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="stat-label flex items-center gap-2"><Trophy size={13} className="text-amber-300" /> Haftalık sıralama · {cfg.id}</div>
        {multi && <div role="tablist" aria-label="Deneme bölümü" className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-0.5">
          {cfg.parts.map(p => <button key={p.id} role="tab" aria-selected={part === p.id} onClick={() => setPart(p.id)}
            className={clsx('rounded-full px-3 py-1 text-xs font-bold transition', part === p.id ? 'bg-accent text-onaccent' : 'text-slate-400 hover:text-slate-200')}>{p.label}</button>)}</div>}
      </div>
      <ol className="space-y-2">
        {lb.rows.map(r => (
          <li key={r.userId} className={clsx('rounded-2xl border px-3 py-2.5', r.isMe ? 'border-accent/30 bg-accent/[0.06]' : 'border-white/[0.06] bg-white/[0.02]', !r.hasData && 'opacity-60')}>
            <div className="flex items-center gap-3 text-sm">
              <span className={clsx('num w-6 text-center text-base font-bold', MEDAL[r.rank - 1] ?? 'text-slate-500')}>{r.rank}</span>
              <Avatar name={r.username} url={r.avatarUrl} size={28} /><span className="min-w-0 flex-1 truncate"><span className={r.isMe ? 'font-semibold text-accent' : 'text-slate-100'}>@{r.username}</span>{r.isMe && <span className="text-slate-500"> (sen)</span>}
                {r.mode !== cfg.id && <span className="badge ml-2 bg-white/[0.07] text-slate-400" title="Kullanıcının asıl modu">{r.mode}</span>}</span>
              <span className="num text-right text-xs text-slate-400"><span className="text-base font-semibold text-slate-50">{fmt(r.weeklyPoints)}</span> puan</span>
            </div>
            <div className="mt-2 pl-9"><Bar percent={r.weeklyPoints / max * 100} label={`@${r.username} haftalık puan`} color={r.isMe ? 'bg-accent' : 'bg-cyan2'} /></div>
            <div className="num mt-1.5 pl-9 text-xs text-slate-500">{r.hasData ? <>ort. net {fmt(r.avgNet)}{multi && ` (${partDef.label})`} · en iyi {fmt(r.bestNet)} · {fmt(r.weeklyHours)} sa · {r.weeklyQuestions} soru</> : `${cfg.id} modunda henüz veri yok`}</div>
          </li>))}
      </ol>
      <p className="mt-3 text-xs text-slate-500">Puan = 10 × haftalık saat + soru ÷ 10 + 2 × ort. net. Sıralama yalnızca seçili modun ({cfg.id}) verisinden hesaplanır.</p>
    </div>
  );
}

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
            <Who name={u.username} url={u.avatarUrl} />
            {u.relation === 'accepted' ? <span className="text-xs text-slate-500">Arkadaşsınız</span>
              : u.relation === 'pending' ? <span className="text-xs text-slate-500">İstek beklemede</span>
              : <button type="button" className="btn-ghost" disabled={busy} onClick={() => add(u.username)}><UserPlus size={14} /> İstek gönder</button>}
          </li>))}</ul>}
        {res && res.length === 0 && <p className="mt-3 text-xs text-slate-500">“{term}” ile başlayan kullanıcı bulunamadı.</p>}
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-2 text-xs ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.text}</p>}
      </form>

      {d.incoming.length > 0 && (
        <div className="card"><div className="stat-label mb-2">Gelen istekler ({d.incoming.length})</div><ul className="divide-y divide-white/[0.06]">{d.incoming.map(u => (
          <li key={u.friendshipId} className="flex items-center justify-between gap-3 py-2 text-sm"><Who name={u.username} url={u.avatarUrl} />
            <span className="flex gap-2">
              <button className="btn" disabled={busy} onClick={() => act(() => post(`/friends/${u.friendshipId}/accept`), `@${u.username} arkadaş listene eklendi`)}><Check size={14} /> Kabul Et</button>
              <button className="btn-ghost" disabled={busy} onClick={() => act(() => post(`/friends/${u.friendshipId}/reject`))}><X size={14} /> Reddet</button></span></li>))}</ul></div>)}
      <Rivalry />
      <div className="card"><div className="stat-label mb-2">Arkadaşlarım ({d.friends.length})</div>
        <ul className="divide-y divide-white/[0.06]">{d.friends.map(u => (
          <li key={u.friendshipId} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="flex min-w-0 items-center gap-2"><Who name={u.username} url={u.avatarUrl} /><span className="badge bg-white/[0.07] text-slate-400">{u.mode}</span></span>
            <span className="flex gap-2">
              <Link className="btn" to={`/karsilastir/${u.userId}`}><Swords size={14} /> Karşılaştır</Link>
              <button className="btn-ghost" onClick={() => confirm(`@${u.username} arkadaşlıktan çıkarılsın mı?`) && act(() => del('/friends/' + u.friendshipId))}>Çıkar</button></span></li>))}
          {!d.friends.length && <li className="py-6 text-center text-sm text-slate-500">Henüz arkadaşın yok. Yukarıdan kullanıcı adıyla ara.</li>}</ul></div>
      {d.outgoing.length > 0 && (
        <div className="card"><div className="stat-label mb-2">Gönderilen istekler</div><ul className="divide-y divide-white/[0.06]">{d.outgoing.map(u => (
          <li key={u.friendshipId} className="flex items-center justify-between gap-3 py-2 text-sm"><Who name={u.username} url={u.avatarUrl} />
            <button className="btn-ghost" disabled={busy} onClick={() => act(() => del('/friends/' + u.friendshipId))}>Geri çek</button></li>))}</ul></div>)}
    </div>
  );
}
