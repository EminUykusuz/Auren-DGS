import { useState } from 'react';
import { UserPlus, KeyRound, Ban, CircleCheck, Loader2, Save } from 'lucide-react';
import clsx from 'clsx';
import { api, post, put } from '../lib/api.js';
import { useAuth } from '../store.js';
import { useLoad } from '../lib/useLoad.js';
import { Item } from '../components/ui.jsx';
import Credentials from '../components/Credentials.jsx';

const Err = ({ children }) => children ? <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{children}</p> : null;

// Sınıf seçici: onay kutuları
function ClassPick({ classes, value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  if (!classes.length) return <p className="text-xs text-slate-500">Önce Sınıflar sekmesinden sınıf oluştur.</p>;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Atanacak sınıflar">
      {classes.map(c => (
        <label key={c.id} className={clsx('!mb-0 flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 !text-xs transition', value.includes(c.id) ? 'border-accent/60 bg-accent/15 !text-slate-100' : 'border-white/10 bg-white/[0.04] !text-slate-400 hover:bg-white/[0.08]')}>
          <input type="checkbox" className="sr-only" checked={value.includes(c.id)} onChange={() => toggle(c.id)} />{c.name}
        </label>))}
    </div>
  );
}

function Row({ t, classes, onChanged, onCreds }) {
  const [ids, setIds] = useState(t.classIds); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const dirty = ids.length !== t.classIds.length || ids.some(x => !t.classIds.includes(x));
  const run = async (fn) => { setErr(''); setBusy(true); try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return (
    <div className={clsx('rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4', t.isDisabled && 'opacity-50')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="font-medium text-slate-100">{t.fullName || t.username}</div><div className="font-mono text-xs text-slate-500">{t.username}</div></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => run(async () => { const o = await post(`/kurum/teachers/${t.id}/reset-password`); onCreds([{ id: t.id, fullName: t.fullName || t.username, username: t.username, password: o.password }]); })}><KeyRound size={13} />Şifre sıfırla</button>
          <button className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => run(async () => { await api('PATCH', `/kurum/teachers/${t.id}`, { isDisabled: !t.isDisabled }); onChanged(); })}>
            {t.isDisabled ? <><Ban size={13} />Pasif</> : <><CircleCheck size={13} className="text-accent" />Aktif</>}</button>
        </div>
      </div>
      <div className="mt-3"><ClassPick classes={classes} value={ids} onChange={setIds} /></div>
      {dirty && <button className="btn mt-3 !py-1.5 text-xs" disabled={busy} onClick={() => run(async () => { await put(`/kurum/teachers/${t.id}/classes`, { classIds: ids }); onChanged(); })}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Sınıfları kaydet</button>}
      <div className="mt-2"><Err>{err}</Err></div>
    </div>
  );
}

export default function Teachers() {
  const { user } = useAuth();
  const list = useLoad('/kurum/teachers'); const cls = useLoad('/kurum/classes');
  const classes = (cls.data?.classes ?? []).filter(c => !c.isArchived);
  const [f, setF] = useState({ firstName: '', lastName: '' }); const [ids, setIds] = useState([]);
  const [creds, setCreds] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const add = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const o = await post('/kurum/teachers', { ...f, classIds: ids });
      setCreds([{ id: o.id, fullName: o.fullName, username: o.username, password: o.password }]); setF({ firstName: '', lastName: '' }); setIds([]); list.reload();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (<>
    <Item className="card space-y-3">
      <h2 className="text-base font-semibold text-slate-50">Öğretmen ekle</h2>
      <form onSubmit={add} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="t-fn">Ad</label><input id="t-fn" value={f.firstName} onChange={e => setF(s => ({ ...s, firstName: e.target.value }))} required maxLength={40} /></div>
          <div><label htmlFor="t-ln">Soyad</label><input id="t-ln" value={f.lastName} onChange={e => setF(s => ({ ...s, lastName: e.target.value }))} required maxLength={40} /></div>
        </div>
        <div><div className="mb-1.5 text-xs font-medium text-slate-400">Sorumlu olduğu sınıflar</div><ClassPick classes={classes} value={ids} onChange={setIds} /></div>
        <button className="btn" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}Öğretmeni oluştur</button>
        <Err>{err}</Err>
      </form>
    </Item>
    {creds && <Item><Credentials rows={creds} title="Öğretmen giriş bilgisi" onClose={() => setCreds(null)} fileName="ogretmen-giris.csv" loginUrl={`${location.origin}/k/${user.institution.slug}`} /></Item>}
    <Item className="space-y-3">
      {list.error ? <Err>{list.error}</Err> : !list.data ? null : list.data.teachers.length === 0
        ? <p className="card text-sm text-slate-400">Henüz öğretmen yok.</p>
        : list.data.teachers.map(t => <Row key={t.id + ':' + t.classIds.join(',')} t={t} classes={classes} onChanged={list.reload} onCreds={setCreds} />)}
    </Item>
  </>);
}
