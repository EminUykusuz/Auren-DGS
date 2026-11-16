import { useEffect, useId, useRef, useState } from 'react';
import { Check, Send, GraduationCap, Palette, ImagePlus, Trash2, UserRound, Layers, TriangleAlert } from 'lucide-react';
import clsx from 'clsx';
import { get, put, post } from '../lib/api.js';
import { useTheme, THEMES, BACKGROUNDS, fileToBg } from '../theme.js';
import { Page, Item, Title } from '../components/ui.jsx';
import { useExam, useAuth } from '../store.js';
import Avatar, { AVATARS } from '../components/Avatar.jsx';
import SupportCard from '../components/SupportCard.jsx';
import { Link } from 'react-router-dom';
import TrackPicker from '../components/TrackPicker.jsx';

function Switch({ checked, onChange, label, hint }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div><div id={id} className="text-sm text-slate-100">{label}</div><div className="text-xs text-slate-500">{hint}</div></div>
      <button role="switch" aria-checked={checked} aria-labelledby={id} onClick={() => onChange(!checked)}
        className={clsx('relative h-7 w-12 shrink-0 rounded-full border border-white/10 transition', checked ? 'bg-accent' : 'bg-white/10')}>
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-0.5')} />
      </button>
    </div>
  );
}

function Appearance() {
  const { theme, setTheme, glow, setGlow, perf, setPerf, bg, bgImage, setBg, setCustomBg, clearBg: clearCustom } = useTheme();
  const file = useRef(null); const [err, setErr] = useState('');
  const upload = async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setErr(''); setCustomBg(await fileToBg(f)); } catch (x) { setErr(x.message); } };
  return (
    <Item className="card">
      <div className="stat-label mb-4 flex items-center gap-2"><Palette size={13} /> Görünüm</div>
      <div role="radiogroup" aria-label="Arka plan teması" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {THEMES.map(t => (
          <button key={t.id} role="radio" aria-checked={theme === t.id} onClick={() => setTheme(t.id)}
            className={clsx('rounded-3xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', theme === t.id ? 'border-accent bg-accent/10' : 'border-white/10 hover:bg-white/5')}>
            <div className="relative mb-3 h-16 overflow-hidden rounded-2xl border border-black/10" style={{ background: t.swatch[0] }} aria-hidden="true">
              <span className="absolute -left-4 -top-4 h-14 w-14 rounded-full opacity-70 blur-xl" style={{ background: t.swatch[1] }} />
              <span className="absolute -bottom-5 right-0 h-14 w-14 rounded-full opacity-60 blur-xl" style={{ background: t.swatch[2] }} />
              <span className="absolute inset-x-3 bottom-3 h-3 rounded-full bg-white/20 ring-1 ring-white/20" />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm text-slate-100">{t.label}{theme === t.id && <Check size={14} className="text-accent" />}</div>
            <div className="text-xs text-slate-500">{t.dark ? 'Koyu' : 'Açık'}</div>
          </button>))}
      </div>
      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <div className="stat-label mb-3 flex items-center gap-2"><ImagePlus size={13} /> Arka plan görseli</div>
        <div role="radiogroup" aria-label="Arka plan görseli" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {BACKGROUNDS.map(b => (
            <button key={b.id} role="radio" aria-checked={bg === b.id} onClick={() => setBg(b.id)} title={b.label}
              className={clsx('overflow-hidden rounded-2xl border text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', bg === b.id ? 'border-accent' : 'border-white/10 hover:border-white/30')}>
              <div className="h-12" style={{ background: b.css ?? 'rgb(var(--s800))' }} aria-hidden="true" />
              <div className="px-2 py-1 text-[11px] text-slate-300">{b.label}</div>
            </button>))}
          {bgImage && (
            <button role="radio" aria-checked={bg === 'custom'} onClick={() => setBg('custom')} title="Kendi görselin"
              className={clsx('overflow-hidden rounded-2xl border text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', bg === 'custom' ? 'border-accent' : 'border-white/10 hover:border-white/30')}>
              <div className="h-12 bg-cover bg-center" style={{ backgroundImage: `url(${bgImage})` }} aria-hidden="true" />
              <div className="px-2 py-1 text-[11px] text-slate-300">Görselim</div>
            </button>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input ref={file} type="file" accept="image/*" onChange={upload} className="sr-only" aria-label="Arka plan görseli yükle" />
          <button type="button" className="btn-ghost" onClick={() => file.current?.click()}><ImagePlus size={14} /> Görsel yükle</button>
          {bgImage && <button type="button" className="btn-ghost" onClick={clearCustom}><Trash2 size={14} /> Görselimi sil</button>}
          <span className="text-xs text-slate-500">Görsel yalnızca bu tarayıcıda saklanır, sunucuya gönderilmez.</span>
        </div>
        {err && <p role="alert" className="mt-2 text-xs text-red-300">{err}</p>}
      </div>
      <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-4">
        <Switch checked={glow} onChange={setGlow} label="Ortam ışıkları" hint="Cam yüzeylerin arkasındaki renkli parıltılar" />
        <Switch checked={perf} onChange={setPerf} label="Performans modu (efektleri azalt)" hint="Bulanıklık, parıltı ve animasyonları kapatır; eski cihazlarda kaydırma akıcı olur" />
      </div>
      <p className="mt-3 text-xs text-slate-500">Tercihlerin bu tarayıcıda saklanır.</p>
    </Item>
  );
}

function Track() {
  const user = useAuth(x => x.user); const patchUser = useAuth(x => x.patchUser); const [err, setErr] = useState('');
  const change = async (t) => {
    setErr('');
    try { const r = await put('/profile/track', { examTrack: t }); patchUser({ examTrack: r.examTrack, examMode: r.examMode }); useExam.getState().adopt(r.examMode); }
    catch (x) { setErr(x.message); }
  };
  return (
    <Item className="card">
      <div className="stat-label mb-1 flex items-center gap-2"><Layers size={13} /> Hazırlandığın sınav</div>
      <p className="mb-4 text-xs text-slate-500">Panel, seçtiğin sınava göre şekillenir. Hibrit hesapta üst çubuktan DGS ve YKS arasında geçersin; veriler ayrı kalır.</p>
      <TrackPicker value={user.examTrack ?? 'BOTH'} onChange={change} id="settings-track" />
      {err && <p role="alert" className="mt-3 text-xs text-red-300">{err}</p>}
    </Item>
  );
}

function Profile() {
  const user = useAuth(x => x.user); const patchUser = useAuth(x => x.patchUser);
  const [f, setF] = useState({ fullName: user.fullName ?? '', email: user.email, avatarUrl: user.avatarUrl ?? null, currentPassword: '' });
  const [state, setState] = useState('idle'); const [err, setErr] = useState('');
  const emailChanged = f.email.trim().toLowerCase() !== user.email.toLowerCase();
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setState('saving');
    try {
      const r = await put('/profile/account', { fullName: f.fullName, email: f.email, avatarUrl: f.avatarUrl, ...(emailChanged ? { currentPassword: f.currentPassword } : {}) });
      patchUser({ fullName: r.fullName, email: r.email, avatarUrl: r.avatarUrl }); setF(p => ({ ...p, email: r.email, currentPassword: '' }));
      setState('saved'); setTimeout(() => setState('idle'), 2500);
    } catch (x) { setErr(x.message); setState('idle'); }
  };
  return (
    <Item className="card">
      <div className="stat-label mb-4 flex items-center gap-2"><UserRound size={13} /> Profil</div>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar name={user.username} url={f.avatarUrl} size={64} />
          <div className="min-w-0"><div className="truncate text-base font-semibold text-slate-50">{f.fullName || `@${user.username}`}</div><div className="truncate text-xs text-slate-500">@{user.username}</div></div>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs text-slate-400">Avatar seç</legend>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8" role="radiogroup" aria-label="Avatar">
            {AVATARS.map(u => (
              <button key={u} type="button" role="radio" aria-checked={f.avatarUrl === u} aria-label="Avatar seç" onClick={() => setF(p => ({ ...p, avatarUrl: u }))}
                className={clsx('rounded-full p-0.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', f.avatarUrl === u ? 'bg-accent ring-2 ring-accent/40' : 'hover:bg-white/10')}>
                <Avatar name="?" url={u} size={40} className="!h-full !w-full" /></button>))}
          </div>
          {f.avatarUrl && <button type="button" className="mt-2 text-xs text-slate-400 underline hover:text-slate-200" onClick={() => setF(p => ({ ...p, avatarUrl: null }))}>Avatarı kaldır</button>}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="pf">Ad soyad</label><input id="pf" maxLength={80} value={f.fullName} onChange={set('fullName')} placeholder="Örn. Ayşe Yılmaz" autoComplete="name" /></div>
          <div className="sm:col-span-2"><label htmlFor="pe">E-posta</label><input id="pe" type="email" required maxLength={254} value={f.email} onChange={set('email')} autoComplete="email" /></div>
          {emailChanged && <div className="sm:col-span-2"><label htmlFor="pp">Mevcut şifre <span className="text-slate-500">(e-posta değişimi için gerekli)</span></label><input id="pp" type="password" required maxLength={72} value={f.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" /></div>}
        </div>
        <div className="flex items-center gap-3"><button className="btn" disabled={state === 'saving'}>Kaydet</button><span role="status" className="text-xs text-emerald-300">{state === 'saved' && 'Kaydedildi ✓'}</span></div>
        {err && <p role="alert" className="text-xs text-red-300">{err}</p>}
      </form>
    </Item>
  );
}

function Target() {
  const mode = useExam(x => x.mode);
  const [f, setF] = useState({ targetUniversity: '', targetDepartment: '', examDate: '' }); const [state, setState] = useState('idle'); const [err, setErr] = useState('');
  useEffect(() => { get('/profile').then(p => setF({ targetUniversity: p.targetUniversity, targetDepartment: p.targetDepartment, examDate: p.examDates?.[mode] ?? '' })).catch(() => {}); }, [mode]);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setState('saving');
    try { await put('/profile', { ...f, examType: mode, examDate: f.examDate || null }); setState('saved'); setTimeout(() => setState('idle'), 2500); } catch (x) { setErr(x.message); setState('idle'); }
  };
  return (
    <Item className="card">
      <div className="stat-label mb-4 flex items-center gap-2"><GraduationCap size={13} /> Hedef ve sınav tarihi</div>
      <form onSubmit={submit} className="space-y-3">
        <div><label htmlFor="tu">Hedef üniversite</label><input id="tu" maxLength={120} value={f.targetUniversity} onChange={e => setF(p => ({ ...p, targetUniversity: e.target.value }))} placeholder="Örn. Boğaziçi Üniversitesi" autoComplete="off" /></div>
        <div><label htmlFor="td">Hedef bölüm</label><input id="td" maxLength={120} value={f.targetDepartment} onChange={e => setF(p => ({ ...p, targetDepartment: e.target.value }))} placeholder="Örn. Bilgisayar Mühendisliği" autoComplete="off" /></div>
        <div><label htmlFor="ed">{mode} sınav tarihi</label><input id="ed" type="date" min={new Date().toISOString().slice(0, 10)} value={f.examDate} onChange={e => setF(p => ({ ...p, examDate: e.target.value }))} />
          <p className="mt-1 text-xs text-slate-500">Boş bırakırsan geri sayım tahmini tarihi gösterir ({mode === 'DGS' ? 'bir sonraki 19 Temmuz' : "Haziran'ın 3. cumartesi"}). ÖSYM kesin tarihi açıklayınca buraya gir. DGS ve YKS tarihleri ayrı saklanır.</p></div>
        <div className="flex items-center gap-3"><button className="btn" disabled={state === 'saving'}>Kaydet</button>
          <span role="status" className="text-xs text-emerald-300">{state === 'saved' && 'Kaydedildi ✓'}</span></div>
        {err && <p role="alert" className="text-xs text-red-300">{err}</p>}
      </form>
    </Item>
  );
}

const CATS = [['oneri', 'Öneri'], ['hata', 'Hata bildirimi'], ['soru', 'Soru'], ['diger', 'Diğer']];
function Feedback() {
  const [f, setF] = useState({ category: 'oneri', subject: '', message: '' }); const [busy, setBusy] = useState(false); const [res, setRes] = useState(null); const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setRes(null); setBusy(true);
    try { setRes(await post('/feedback', f)); setF(p => ({ ...p, subject: '', message: '' })); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Item className="card">
      <div className="stat-label mb-4 flex items-center gap-2"><Send size={13} /> Bize ulaş / geri bildirim</div>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <div><label htmlFor="fc">Tür</label><select id="fc" value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label htmlFor="fs">Konu</label><input id="fs" required minLength={3} maxLength={100} value={f.subject} onChange={e => setF(p => ({ ...p, subject: e.target.value }))} /></div>
        </div>
        <div><label htmlFor="fm">Mesaj</label>
          <textarea id="fm" required minLength={10} maxLength={2000} rows={5} value={f.message} onChange={e => setF(p => ({ ...p, message: e.target.value }))}
            className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20" />
          <div className="num mt-1 text-right text-xs text-slate-500">{f.message.length}/2000</div></div>
        <div className="flex items-center gap-3"><button className="btn" disabled={busy}><Send size={14} /> Gönder</button></div>
        <div role="status">
          {res && <p className="rounded-2xl bg-accent/10 px-3 py-2 text-xs text-emerald-300">Mesajın alındı{res.mail === 'sent' ? ' ve e-posta ile iletildi.' : res.mail === 'failed' ? '; e-posta gönderilemedi ama kaydın yönetime ulaştı.' : ' ve yönetim paneline kaydedildi.'}</p>}
        </div>
        {err && <p role="alert" className="text-xs text-red-300">{err}</p>}
      </form>
    </Item>
  );
}

// Hesabı kalıcı silme (KVKK silme hakkı): iki adım — önce uyarı, sonra şifre ile onay
function DeleteAccount() {
  const user = useAuth(x => x.user); const [open, setOpen] = useState(false); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  if (user.isAdmin) return null;
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await post('/profile/delete-account', { password: pw }); window.location.replace('/'); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <Item className="card !border-red-500/20">
      <div className="stat-label mb-3 flex items-center gap-2 !text-red-300"><TriangleAlert size={13} /> Hesabı sil</div>
      <p className="text-sm text-slate-400">Hesabın; çalışma kayıtların, denemelerin, ilerlemen, arkadaşlıkların ve geri bildirimlerinle birlikte <b className="text-slate-200">kalıcı olarak silinir</b>. Bu işlem geri alınamaz. Ayrıntı için <Link to="/kvkk" className="text-accent hover:underline">KVKK Aydınlatma Metni</Link>.</p>
      {!open ? <button type="button" className="btn-ghost mt-4 !text-red-300" onClick={() => setOpen(true)}><Trash2 size={14} /> Hesabımı silmek istiyorum</button> : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div><label htmlFor="dpw">Onaylamak için şifreni gir</label><input id="dpw" type="password" required autoComplete="current-password" maxLength={72} value={pw} onChange={e => setPw(e.target.value)} /></div>
          {err && <p role="alert" className="text-xs text-red-300">{err}</p>}
          <div className="flex gap-2"><button className="btn !bg-red-500/90 hover:!bg-red-500" disabled={busy || !pw}><Trash2 size={14} /> Kalıcı olarak sil</button><button type="button" className="btn-ghost" onClick={() => { setOpen(false); setPw(''); setErr(''); }}>Vazgeç</button></div>
        </form>)}
    </Item>
  );
}

export default function Settings() {
  return (
    <Page>
      <Title>Ayarlar</Title>
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <div className="space-y-4"><Profile /><Track /><Appearance /><Target /><DeleteAccount /></div>
        <div className="space-y-4"><SupportCard /><Feedback /></div>
      </div>
    </Page>
  );
}
