import { Fragment, useEffect, useState } from 'react';
import { KeyRound, Loader2, Plus } from 'lucide-react';
import clsx from 'clsx';
import { api, get, post } from '../lib/api.js';
import Credentials from '../components/Credentials.jsx';
import { Item } from '../components/ui.jsx';
import { useLoad } from '../lib/useLoad.js';

const ROLE = { student: 'Öğrenci', teacher: 'Öğretmen', owner: 'Yönetici' };
// Platform sahibi: bir kurumun tamamı (sınıflar + kişiler), salt okunur
function Detail({ id }) {
  const { data, error } = useLoad(`/admin/institutions/${id}/detail`);
  if (error) return <p className="p-4 text-xs text-red-300">{error}</p>;
  if (!data) return <p className="p-4 text-xs text-slate-500">Yükleniyor…</p>;
  return (
    <div className="space-y-4 p-4 text-xs">
      <div className="flex flex-wrap gap-2">{data.classes.map(c => <span key={c.id} className={clsx('badge bg-white/[0.06] text-slate-300', c.archived && 'opacity-50')}>{c.name} · {c.students} öğrenci · {c.exams} deneme</span>)}{data.classes.length === 0 && <span className="text-slate-500">Sınıf yok</span>}</div>
      <div className="max-h-80 overflow-auto"><table className="w-full text-left"><thead><tr className="stat-label"><th className="py-1.5 pr-3">Ad</th><th className="pr-3">Kullanıcı</th><th className="pr-3">Rol</th><th className="pr-3">Sınıf</th><th className="pr-3">No</th><th className="pr-3">Deneme</th><th>Son giriş</th></tr></thead>
        <tbody>{data.people.map(p => <tr key={p.id} className={clsx('border-t border-white/[0.05]', p.disabled && 'opacity-50')}><td className="py-1.5 pr-3 text-slate-200">{p.fullName || '—'}</td><td className="pr-3 font-mono">{p.username}</td><td className="pr-3">{ROLE[p.role] ?? p.role}</td><td className="pr-3">{p.className || '—'}</td><td className="pr-3">{p.studentNo || '—'}</td><td className="pr-3">{p.exams}</td><td>{p.lastLogin ?? (p.mustChangePassword ? 'bekliyor' : '—')}</td></tr>)}</tbody></table></div>
    </div>);
}

// Platform yöneticisi: kurum (dershane) oluştur → kurum adresi + yönetici giriş bilgisi bir kez gösterilir
export default function InstitutionsTab() {
  const [list, setList] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [creds, setCreds] = useState(null); const [open, setOpen] = useState(null);
  const [f, setF] = useState({ name: '', slug: '', examTrack: 'BOTH', studentLimit: '', ownerFirstName: '', ownerLastName: '' });
  const load = () => get('/admin/institutions').then(d => setList(d.institutions)).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const set = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const create = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const o = await post('/admin/institutions', { name: f.name, ...(f.slug ? { slug: f.slug.toLowerCase() } : {}), examTrack: f.examTrack, studentLimit: f.studentLimit ? Number(f.studentLimit) : null, ownerFirstName: f.ownerFirstName, ownerLastName: f.ownerLastName });
      setCreds({ title: `Kurum oluşturuldu · ${f.name}`, url: `${location.origin}${o.loginPath}`, rows: [{ id: o.ownerId, fullName: `${f.ownerFirstName} ${f.ownerLastName} (yönetici)`, username: o.owner.username, password: o.owner.password }] });
      setF({ name: '', slug: '', examTrack: 'BOTH', studentLimit: '', ownerFirstName: '', ownerLastName: '' }); load();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const patch = async (i, body) => { setErr(''); try { await api('PATCH', `/admin/institutions/${i.id}`, body); load(); } catch (x) { setErr(x.message); } };
  const resetOwner = async (i) => {
    setErr('');
    try { const o = await post(`/admin/institutions/${i.id}/reset-owner`); setCreds({ title: `Yönetici şifresi sıfırlandı · ${i.name}`, url: `${location.origin}/k/${i.slug}`, rows: [{ id: i.id, fullName: 'Kurum yöneticisi', username: o.username, password: o.password }] }); }
    catch (x) { setErr(x.message); }
  };
  const quota = (i) => { const v = prompt('Öğrenci kotası (boş = sınırsız):', i.studentLimit ?? ''); if (v === null) return; patch(i, { studentLimit: v.trim() ? Number(v) : null }); };
  return (<>
    <Item className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-50">Yeni kurum</h2><a className="btn-ghost !py-1.5 text-xs" href="/api/admin/export/all.xlsx" download>Tüm veriyi Excel olarak indir</a></div>
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label htmlFor="i-n">Kurum adı</label><input id="i-n" value={f.name} onChange={set('name')} required minLength={2} maxLength={100} /></div>
        <div><label htmlFor="i-s">Adres (isteğe bağlı)</label><input id="i-s" value={f.slug} onChange={set('slug')} placeholder="isikdershanesi" pattern="[a-z0-9]{3,40}" title="3-40 küçük harf/rakam" /></div>
        <div><label htmlFor="i-t">Hazırlık</label><select id="i-t" value={f.examTrack} onChange={set('examTrack')}><option value="BOTH">DGS + YKS</option><option value="LGS">LGS (8. sınıf)</option><option value="DGS">DGS</option><option value="YKS">YKS</option></select></div>
        <div><label htmlFor="i-o1">Yönetici adı</label><input id="i-o1" value={f.ownerFirstName} onChange={set('ownerFirstName')} required maxLength={40} /></div>
        <div><label htmlFor="i-o2">Yönetici soyadı</label><input id="i-o2" value={f.ownerLastName} onChange={set('ownerLastName')} required maxLength={40} /></div>
        <div><label htmlFor="i-l">Öğrenci kotası</label><input id="i-l" type="number" min={1} value={f.studentLimit} onChange={set('studentLimit')} placeholder="sınırsız" /></div>
        <div className="sm:col-span-2 lg:col-span-3"><button className="btn" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}Kurumu oluştur</button></div>
      </form>
      {err && <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{err}</p>}
    </Item>
    {creds && <Item><Credentials rows={creds.rows} title={creds.title} loginUrl={creds.url} onClose={() => setCreds(null)} fileName="kurum-yonetici-giris.csv" /></Item>}
    <Item className="card !p-0 overflow-hidden">
      {!list ? <p className="p-6 text-sm text-slate-500">Yükleniyor…</p> : list.length === 0 ? <p className="p-6 text-sm text-slate-400">Henüz kurum yok.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="stat-label"><th className="px-4 py-3">Kurum</th><th className="px-4 py-3">Adres</th><th className="px-4 py-3">Öğrenci</th><th className="px-4 py-3">Öğretmen</th><th className="px-4 py-3">Sınıf</th><th className="px-4 py-3">Durum</th><th className="px-4 py-3 text-right">İşlem</th></tr></thead>
          <tbody>{list.map(i => (
            <Fragment key={i.id}><tr className={clsx('border-t border-white/[0.05]', !i.isActive && 'opacity-50')}>
              <td className="px-4 py-2.5 text-slate-100">{i.name}</td><td className="px-4 py-2.5 font-mono text-xs">/k/{i.slug}</td>
              <td className="px-4 py-2.5">{i.students}{i.studentLimit ? ` / ${i.studentLimit}` : ''}</td><td className="px-4 py-2.5">{i.teachers}</td><td className="px-4 py-2.5">{i.classes}</td>
              <td className="px-4 py-2.5"><span className={clsx('badge', i.isActive ? 'bg-accent/15 text-accent' : 'bg-red-500/15 text-red-300')}>{i.isActive ? 'aktif' : 'pasif'}</span></td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setOpen(open === i.id ? null : i.id)}>{open === i.id ? 'Gizle' : 'Ayrıntı'}</button>{' '}
                <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => quota(i)}>Kota</button>{' '}
                <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => resetOwner(i)}><KeyRound size={12} />Yönetici şifresi</button>{' '}
                <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => { if (i.isActive && !confirm(`${i.name} pasife alınırsa tüm kullanıcıları anında çıkış yapar. Devam edilsin mi?`)) return; patch(i, { isActive: !i.isActive }); }}>{i.isActive ? 'Pasife al' : 'Etkinleştir'}</button>
              </td>
            </tr>{open === i.id && <tr className="border-t border-white/[0.05] bg-white/[0.02]"><td colSpan={7}><Detail id={i.id} /></td></tr>}</Fragment>))}</tbody>
        </table></div>)}
    </Item>
  </>);
}
