import { lazy, Suspense, useState } from 'react';
import { NavLink, Routes, Route, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, GraduationCap, School, History as HistoryIcon, Palette, ArrowRightLeft, Loader2, Plus, Archive, ArchiveRestore, Check, ImagePlus, Trash2, UserCheck, KeyRound, ClipboardList } from 'lucide-react';
import clsx from 'clsx';
import { get, post, put, del, api } from '../lib/api.js';
import { useAuth } from '../store.js';
import { useLoad } from '../lib/useLoad.js';
import { logoUrl } from '../lib/kurum.js';
import { Page, Item, Title, Stat, Bar } from '../components/ui.jsx';

const Students = lazy(() => import('./KurumStudents.jsx'));
const Placement = lazy(() => import('./KurumPlacement.jsx'));
const Teachers = lazy(() => import('./KurumTeachers.jsx'));
const Odev = lazy(() => import('./KurumOdev.jsx'));

const Err = ({ children }) => children ? <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{children}</p> : null;
const Spin = () => <div className="flex justify-center py-10 text-slate-500" role="status"><Loader2 className="animate-spin" size={18} aria-label="Yükleniyor" /></div>;

function Tabs({ owner }) {
  const tabs = [['/kurum', 'Genel', Users, true], ['/kurum/ogrenciler', 'Öğrenciler', GraduationCap], ['/kurum/siniflar', 'Sınıflar', School],
    ['/kurum/odev', 'Ödev', ClipboardList], ['/kurum/yerlestirme', 'Sınıf değiştirme', ArrowRightLeft], ...(owner ? [['/kurum/ogretmenler', 'Öğretmenler', UserCheck]] : []),
    ['/kurum/gecmis', 'Geçmiş', HistoryIcon], ...(owner ? [['/kurum/marka', 'Marka', Palette]] : [])];
  return (
    <Item className="glass-pill mx-auto flex w-fit max-w-full gap-1 overflow-x-auto p-1">
      {tabs.map(([to, l, Icon, end]) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => clsx('relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition', isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200')}>
          {({ isActive }) => (<>
            {isActive && <motion.span layoutId="kurum-tab" className="absolute inset-0 rounded-full bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,.18)]" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
            <Icon size={16} strokeWidth={1.8} className="relative" /><span className="relative hidden md:inline">{l}</span></>)}
        </NavLink>))}
    </Item>
  );
}

function Overview() {
  const { data: o, error } = useLoad('/kurum/overview');
  const { user } = useAuth();
  if (error) return <Err>{error}</Err>;
  if (!o) return <Spin />;
  return (<>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat icon={GraduationCap} label="Öğrenci" value={o.students} sub={o.studentLimit ? `Kota ${o.studentLimit}` : 'Kota sınırı yok'} />
      <Stat icon={Users} tone="text-cyan2" label="Bu hafta aktif" value={o.activeWeek} sub={o.students ? `%${Math.round(o.activeWeek / o.students * 100)} giriş yaptı` : '—'} />
      <Stat icon={KeyRound} tone="text-amber-300" label="İlk girişi bekleyen" value={o.pendingFirstLogin} sub="Şifresini henüz değiştirmedi" />
      <Stat icon={School} label="Sınıf" value={o.classes} />
    </div>
    {o.studentLimit && <Item className="card"><div className="stat-label mb-2">Öğrenci kotası · {o.students}/{o.studentLimit}</div><Bar percent={Math.min(100, o.students / o.studentLimit * 100)} label="Kota doluluğu" /></Item>}
    <Item className="card flex flex-wrap items-center gap-3">
      <div className="mr-auto"><p className="font-semibold text-slate-100">Excel&apos;e aktar</p><p className="text-xs text-slate-500">Yetkin olan öğrencilerin verisi; .xlsx olarak iner.</p></div>
      <a className="btn-ghost" href="/api/kurum/export/students.xlsx" download>Öğrenci listesi</a>
      <a className="btn-ghost" href="/api/kurum/export/exams.xlsx" download>Deneme sonuçları</a>
    </Item>
    <Item className="card text-sm text-slate-400">
      <p className="font-semibold text-slate-100">Hızlı başlangıç</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        {user.role === 'owner' && <li><Link className="text-accent hover:underline" to="/kurum/siniflar">Sınıfları oluştur</Link> (ör. 8-A, 8-B).</li>}
        <li><Link className="text-accent hover:underline" to="/kurum/ogrenciler">Öğrenci listesini Excel&apos;den yapıştır</Link>; sistem kullanıcı adı ve geçici şifre üretir.</li>
        <li>Giriş bilgilerini CSV olarak indir, öğrencilere dağıt.</li>
        <li>Sınıf değiştirme sınavından sonra <Link className="text-accent hover:underline" to="/kurum/yerlestirme">Sınıf değiştirme</Link> sekmesinden öğrencileri net sırasına göre yerleştir.</li>
      </ol>
    </Item>
  </>);
}

function Classes() {
  const { user } = useAuth(); const owner = user.role === 'owner';
  const { data, error, reload } = useLoad('/kurum/classes');
  const [name, setName] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);   // { id, name }
  const run = async (fn) => { setMsg(''); setBusy(true); try { await fn(); reload(); } catch (e) { setMsg(e.message); } finally { setBusy(false); } };
  if (error) return <Err>{error}</Err>;
  if (!data) return <Spin />;
  return (<>
    {owner && (
      <Item className="card">
        <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); if (name.trim()) run(async () => { await post('/kurum/classes', { name: name.trim() }); setName(''); }); }}>
          <div className="min-w-[200px] flex-1"><label htmlFor="cn">Yeni sınıf</label><input id="cn" value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="ör. 8-A" /></div>
          <button className="btn" disabled={busy || !name.trim()}><Plus size={16} />Ekle</button>
        </form>
        <div className="mt-3"><Err>{msg}</Err></div>
      </Item>)}
    <Item className="card !p-0 overflow-hidden">
      {data.classes.length === 0 ? <p className="p-6 text-sm text-slate-400">{owner ? 'Henüz sınıf yok. Yukarıdan ilk sınıfı ekle.' : 'Sana atanmış bir sınıf yok. Kurum yöneticisinden sınıf atamasını iste.'}</p> : (
        <table className="w-full text-left text-sm">
          <thead><tr className="stat-label"><th className="px-4 py-3">Sınıf</th><th className="px-4 py-3">Öğrenci</th>{owner && <th className="px-4 py-3 text-right">İşlem</th>}</tr></thead>
          <tbody>{data.classes.map(c => (
            <tr key={c.id} className={clsx('border-t border-white/[0.05]', c.isArchived && 'opacity-50')}>
              <td className="px-4 py-2.5 text-slate-100">
                {editing?.id === c.id
                  ? <form className="flex gap-2" onSubmit={e => { e.preventDefault(); run(async () => { await api('PATCH', `/kurum/classes/${c.id}`, { name: editing.name.trim() }); setEditing(null); }); }}>
                      <input autoFocus value={editing.name} onChange={e => setEditing({ id: c.id, name: e.target.value })} maxLength={40} className="!py-1.5" aria-label="Sınıf adı" />
                      <button className="btn !px-3 !py-1.5" aria-label="Kaydet"><Check size={14} /></button></form>
                  : <>{c.name} {c.isArchived && <span className="badge bg-white/10 text-slate-400">arşiv</span>}</>}
              </td>
              <td className="px-4 py-2.5">{c.studentCount}</td>
              {owner && <td className="px-4 py-2.5 text-right">
                <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setEditing({ id: c.id, name: c.name })}>Adı değiştir</button>{' '}
                <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => run(() => api('PATCH', `/kurum/classes/${c.id}`, { isArchived: !c.isArchived }))}>
                  {c.isArchived ? <><ArchiveRestore size={13} />Geri al</> : <><Archive size={13} />Arşivle</>}</button>
              </td>}
            </tr>))}</tbody>
        </table>)}
    </Item>
    {!owner && <Err>{msg}</Err>}
  </>);
}

function History() {
  const { data, error } = useLoad('/kurum/transfers');
  if (error) return <Err>{error}</Err>;
  if (!data) return <Spin />;
  const fmt = (d) => new Date(d).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <Item className="card !p-0 overflow-hidden">
      {data.transfers.length === 0 ? <p className="p-6 text-sm text-slate-400">Henüz sınıf değişikliği yok.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="stat-label"><th className="px-4 py-3">Tarih</th><th className="px-4 py-3">Öğrenci</th><th className="px-4 py-3">Değişiklik</th><th className="px-4 py-3">Yapan</th><th className="px-4 py-3">Not</th></tr></thead>
          <tbody>{data.transfers.map(t => (
            <tr key={t.id} className="border-t border-white/[0.05]">
              <td className="whitespace-nowrap px-4 py-2.5">{fmt(t.at)}</td><td className="px-4 py-2.5 text-slate-100">{t.student}</td>
              <td className="whitespace-nowrap px-4 py-2.5">{t.from ?? 'Sınıfsız'} → <b className="text-slate-100">{t.to ?? 'Sınıfsız'}</b></td>
              <td className="px-4 py-2.5">{t.by ?? '—'}</td><td className="px-4 py-2.5 text-slate-400">{t.reason ?? ''}</td>
            </tr>))}</tbody>
        </table></div>)}
    </Item>
  );
}

// Logoyu en çok 480 px'e küçültüp PNG'ye çevirir (sunucu sınırı 300 KB; büyükse webp denenir)
async function shrinkLogo(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Logo png, jpeg veya webp olmalı');
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const toBlob = (t, q) => new Promise(r => c.toBlob(r, t, q));
  for (const [t, q] of [['image/png'], ['image/webp', 0.9], ['image/webp', 0.7]]) { const b = await toBlob(t, q); if (b && b.size <= 300 * 1024) return b; }
  throw new Error('Logo çok büyük; daha sade bir görsel dene');
}

function Brand() {
  const { user, patchUser } = useAuth(); const inst = user.institution;
  const [color, setColor] = useState(inst.color ?? '#10b981'); const [msg, setMsg] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const act = async (fn, done) => { setMsg(''); setOk(''); setBusy(true); try { await fn(); setOk(done); } catch (e) { setMsg(e.message); } finally { setBusy(false); } };
  const upload = (e) => act(async () => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    const blob = await shrinkLogo(f);
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const res = await fetch(base + '/api/kurum/logo', { method: 'PUT', credentials: base ? 'include' : 'same-origin', headers: { 'Content-Type': blob.type }, body: blob });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Logo yüklenemedi');
    patchUser({ institution: { ...inst, hasLogo: true, logoVersion: d.logoVersion } });
  }, 'Logo güncellendi');
  return (
    <Item className="card space-y-5">
      <div>
        <div className="stat-label mb-2">Logo</div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-20 w-40 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
            {logoUrl(inst) ? <img src={logoUrl(inst)} alt="Kurum logosu" className="max-h-16 max-w-[140px] object-contain" /> : <span className="text-xs text-slate-500">Logo yok</span>}
          </div>
          <label className="btn cursor-pointer !mb-0"><ImagePlus size={16} />Logo yükle<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={upload} disabled={busy} /></label>
          {inst.hasLogo && <button className="btn-danger" disabled={busy} onClick={() => act(async () => { await del('/kurum/logo'); patchUser({ institution: { ...inst, hasLogo: false, logoVersion: 0 } }); }, 'Logo kaldırıldı')}><Trash2 size={15} />Kaldır</button>}
        </div>
        <p className="mt-2 text-xs text-slate-500">PNG, JPEG veya WebP. Büyük görseller otomatik küçültülür. Şeffaf arka planlı PNG en iyi sonucu verir.</p>
      </div>
      <div>
        <div className="stat-label mb-2">Kurum rengi</div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="color" value={color} onChange={e => setColor(e.target.value)} aria-label="Kurum rengi" className="!h-11 !w-16 cursor-pointer !p-1" />
          <button className="btn" disabled={busy} onClick={() => act(async () => { await put('/kurum/branding', { color }); patchUser({ institution: { ...inst, color } }); }, 'Renk kaydedildi')}>Kaydet</button>
          {inst.color && <button className="btn-ghost" disabled={busy} onClick={() => act(async () => { await put('/kurum/branding', { color: null }); patchUser({ institution: { ...inst, color: null } }); }, 'Varsayılan renge dönüldü')}>Varsayılana dön</button>}
        </div>
      </div>
      <div className="rounded-2xl bg-white/[0.04] p-3.5 text-xs text-slate-400">
        Öğrencilerin giriş adresi: <b className="select-all text-slate-100">{location.origin}/k/{inst.slug}</b> — logon ve rengin bu sayfada ve öğrenci panelinde görünür.
      </div>
      <Err>{msg}</Err>{ok && <p className="rounded-2xl bg-accent/10 px-3.5 py-2.5 text-xs text-emerald-300" role="status">{ok}</p>}
    </Item>
  );
}

export default function Kurum() {
  const { user } = useAuth(); const owner = user.role === 'owner';
  return (
    <Page>
      <Title right={<span className="badge bg-accent/15 text-accent">{owner ? 'Kurum yöneticisi' : 'Öğretmen'}</span>}>{user.institution?.name ?? 'Kurum paneli'}</Title>
      <Tabs owner={owner} />
      <Suspense fallback={<Spin />}>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="ogrenciler" element={<Students />} />
          <Route path="siniflar" element={<Classes />} />
          <Route path="odev" element={<Odev />} />
          <Route path="yerlestirme" element={<Placement />} />
          {owner && <Route path="ogretmenler" element={<Teachers />} />}
          <Route path="gecmis" element={<History />} />
          {owner && <Route path="marka" element={<Brand />} />}
          <Route path="*" element={<Navigate to="/kurum" replace />} />
        </Routes>
      </Suspense>
    </Page>
  );
}
