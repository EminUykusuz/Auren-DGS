import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Plus } from 'lucide-react';
import clsx from 'clsx';
import { api, get, post } from '../lib/api.js';
import Credentials from '../components/Credentials.jsx';
import { Item } from '../components/ui.jsx';

// Platform yöneticisi: kurum (dershane) oluştur → kurum adresi + yönetici giriş bilgisi bir kez gösterilir
export default function InstitutionsTab() {
  const [list, setList] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [creds, setCreds] = useState(null);
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
      <h2 className="text-base font-semibold text-slate-50">Yeni kurum</h2>
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label htmlFor="i-n">Kurum adı</label><input id="i-n" value={f.name} onChange={set('name')} required minLength={2} maxLength={100} /></div>
        <div><label htmlFor="i-s">Adres (isteğe bağlı)</label><input id="i-s" value={f.slug} onChange={set('slug')} placeholder="isikdershanesi" pattern="[a-z0-9]{3,40}" title="3-40 küçük harf/rakam" /></div>
        <div><label htmlFor="i-t">Hazırlık</label><select id="i-t" value={f.examTrack} onChange={set('examTrack')}><option value="BOTH">DGS + YKS</option><option value="DGS">DGS</option><option value="YKS">YKS</option></select></div>
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
            <tr key={i.id} className={clsx('border-t border-white/[0.05]', !i.isActive && 'opacity-50')}>
              <td className="px-4 py-2.5 text-slate-100">{i.name}</td><td className="px-4 py-2.5 font-mono text-xs">/k/{i.slug}</td>
              <td className="px-4 py-2.5">{i.students}{i.studentLimit ? ` / ${i.studentLimit}` : ''}</td><td className="px-4 py-2.5">{i.teachers}</td><td className="px-4 py-2.5">{i.classes}</td>
              <td className="px-4 py-2.5"><span className={clsx('badge', i.isActive ? 'bg-accent/15 text-accent' : 'bg-red-500/15 text-red-300')}>{i.isActive ? 'aktif' : 'pasif'}</span></td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => quota(i)}>Kota</button>{' '}
                <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => resetOwner(i)}><KeyRound size={12} />Yönetici şifresi</button>{' '}
                <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => { if (i.isActive && !confirm(`${i.name} pasife alınırsa tüm kullanıcıları anında çıkış yapar. Devam edilsin mi?`)) return; patch(i, { isActive: !i.isActive }); }}>{i.isActive ? 'Pasife al' : 'Etkinleştir'}</button>
              </td>
            </tr>))}</tbody>
        </table></div>)}
    </Item>
  </>);
}
