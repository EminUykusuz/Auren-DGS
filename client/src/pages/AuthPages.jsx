import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Eye, EyeOff, Loader2, Moon, Sun, X } from 'lucide-react';
import clsx from 'clsx';
import { useAuth, useExam } from '../store.js';
import { useTheme } from '../theme.js';
import { get, post } from '../lib/api.js';
import { logoUrl, useBrandColor } from '../lib/kurum.js';
import TrackPicker from '../components/TrackPicker.jsx';
import { Ambient } from '../components/Layout.jsx';

const spring = { type: 'spring', stiffness: 260, damping: 26 };
const list = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: spring } };

// Giriş / kayıt çerçevesi: panelle aynı cam kart, aynı vurgu rengi ve tema; kart yumuşakça yerine oturur
export function Frame({ title, subtitle, children, footer, brand, hideHome }) {
  const { theme, toggleMode } = useTheme(); const light = theme === 'light';
  return (
    <div className="auth-page relative flex min-h-screen flex-col px-4 py-4 sm:py-5" style={{ minHeight: '100dvh' }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="float-slow absolute left-1/2 top-1/3 h-[360px] w-[360px] sm:h-[520px] sm:w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(closest-side, rgb(var(--accent) / .16), transparent)' }} />
      </div>
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        {hideHome ? <span /> : <Link to="/" className="group inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-100"><ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />Ana sayfa</Link>}
        <motion.button whileTap={{ scale: 0.9, rotate: 15 }} type="button" onClick={toggleMode} aria-label={light ? 'Koyu temaya geç' : 'Açık temaya geç'} className="btn-ghost !px-3 !py-2">{light ? <Moon size={16} /> : <Sun size={16} />}</motion.button>
      </div>
      <div className="flex flex-1 items-center justify-center py-5 sm:py-8">
        <motion.div initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring, stiffness: 180 }} className="card w-full max-w-md !p-5 sm:!p-7">
          <motion.div variants={list} initial="hidden" animate="show">
            <motion.div variants={item} className="mb-6 flex items-center gap-3 text-xl font-bold text-slate-100">
              {brand ? (<>{logoUrl(brand) && <img src={logoUrl(brand)} alt="" className="h-10 max-w-[140px] rounded-lg object-contain" />}<span className="truncate">{brand.name}</span></>) : 'Auren Study'}
            </motion.div>
            <motion.h1 variants={item} className="text-2xl font-semibold tracking-tight text-slate-50">{title}</motion.h1>
            <motion.p variants={item} className="mb-5 mt-1.5 min-h-[1.25rem] text-sm text-slate-400">{subtitle}</motion.p>
            {children}
            <motion.div variants={item} className="mt-6 space-y-1.5 border-t border-white/[0.06] pt-4 text-center text-sm text-slate-400">{footer}</motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export function useForm(action) {
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [shaking, setShaking] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const m = await action(Object.fromEntries(new FormData(e.target))); if (m) setMsg(m); }
    catch (x) { setErr(x.message); setShaking(true); setTimeout(() => setShaking(false), 450); } finally { setBusy(false); }
  };
  return { err, msg, busy, shaking, submit };
}
export const Msg = ({ err, msg }) => (
  <AnimatePresence initial={false}>
    {err && <motion.p key="e" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{err}</motion.p>}
    {msg && <motion.p key="m" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden rounded-2xl bg-accent/10 px-3.5 py-2.5 text-xs text-emerald-300">{msg}</motion.p>}
  </AnimatePresence>
);
const Link2 = ({ to, children }) => <Link className="font-medium text-accent underline-offset-4 hover:underline" to={to}>{children}</Link>;

// Form alanı: odaklanınca etiket vurgu rengine döner
export const Field = ({ id, label, hint, children }) => (
  <motion.div variants={item} className="group"><label htmlFor={id} className="transition-colors group-focus-within:text-accent">{label}</label>{children}{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</motion.div>
);

export function Password({ id, autoComplete, strength, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} name="password" type={show ? 'text' : 'password'} required autoComplete={autoComplete} className="!pr-11" {...rest} />
      <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-200">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
    </div>
  );
}

export const Submit = ({ busy, children }) => (
  <motion.button variants={item} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="btn btn-shine w-full" disabled={busy}>
    {busy ? <Loader2 size={16} className="animate-spin" aria-label="Gönderiliyor" /> : children}
  </motion.button>
);

// Hata olunca form hafifçe sallanır
export const Form = ({ f, children }) => <form onSubmit={f.submit} className={clsx('space-y-4', f.shaking && 'animate-shake')}>{children}</form>;

export function Login({ brand }) {
  const { login } = useAuth(); const nav = useNavigate();
  const f = useForm(async d => { await login(d.identifier, d.password); nav('/'); });
  useBrandColor(brand?.color);
  return (
    <Frame brand={brand} title={brand ? 'Giriş yap' : 'Tekrar hoş geldin'} subtitle={brand ? 'Kurumunun verdiği kullanıcı adı ve şifreyle gir.' : 'Hesabına giriş yap ve çalışmana devam et.'}
      footer={brand ? <div className="text-xs text-slate-500">Şifreni unuttuysan öğretmeninden yeni şifre iste.</div> : <><Link2 to="/sifremi-unuttum">Şifremi unuttum</Link2><div>Hesabın yok mu? <Link2 to="/kayit">Kayıt ol</Link2></div></>}>
      <Form f={f}>
        <Field id="identifier" label="Kullanıcı adı veya e-posta"><input id="identifier" name="identifier" required autoComplete="username" /></Field>
        <Field id="password" label="Şifre"><Password id="password" autoComplete="current-password" /></Field>
        <Msg {...f} /><Submit busy={f.busy}>Giriş yap</Submit>
      </Form>
    </Frame>
  );
}

// Şifre gücü: uzunluk + harf/rakam/özel karakter çeşitliliği
const strengthOf = (p) => { let n = 0; if (p.length >= 8) n++; if (/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(p) && /\d/.test(p)) n++; if (p.length >= 12) n++; if (/[^\w\s]/.test(p)) n++; return n; };
const STRENGTH = ['Çok zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü'];

const DocLink = ({ k, onOpen, children }) => (
  <button type="button" onClick={() => onOpen(k)} className="font-medium text-accent underline-offset-4 hover:underline">{children}</button>
);

// Onay kutusu: görünür özel kutu (gerçek input ekran okuyucu için kalır, böylece tarayıcı doğrulaması da çalışır)
function Consent({ onOpen }) {
  return (
    <div className="space-y-2">
      <label className="relative !mb-0 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 !text-[13px] leading-snug !font-normal !text-slate-300 transition hover:bg-white/[0.06]">
        <input type="checkbox" name="terms" required className="peer !absolute left-5 top-5 !block !h-px !w-px !p-0 opacity-0" />
        <span aria-hidden="true" className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-md border border-white/25 bg-white/[0.05] text-onaccent transition peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 [&>svg]:scale-50 [&>svg]:opacity-0 [&>svg]:transition peer-checked:[&>svg]:scale-100 peer-checked:[&>svg]:opacity-100"><Check size={14} strokeWidth={3} /></span>
        <span><DocLink k="kosullar" onOpen={onOpen}>Kullanım Koşulları</DocLink> ve <DocLink k="gizlilik" onOpen={onOpen}>Gizlilik Politikası</DocLink>&apos;nı okudum, kabul ediyorum.</span>
      </label>
      <p className="px-1 text-xs leading-relaxed text-slate-500">Kişisel verilerin yalnızca hizmeti sunmak için işlenir, üçüncü kişilere satılmaz. Ayrıntılar için <DocLink k="kvkk" onOpen={onOpen}>KVKK Aydınlatma Metni</DocLink>&apos;ni incele.</p>
    </div>
  );
}

// Politika metnini kayıt sayfasından ayrılmadan okutan pencere (metinler tembel yüklenir)
function PolicyModal({ doc, onClose }) {
  const [LEGAL, setLegal] = useState(null);
  useEffect(() => { if (doc && !LEGAL) import('./Legal.jsx').then(m => setLegal(m.LEGAL)); }, [doc, LEGAL]);
  useEffect(() => {
    if (!doc) return;
    const key = e => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [doc, onClose]);
  const d = doc && LEGAL?.[doc];
  return createPortal(
    <AnimatePresence>
      {doc && (
        <motion.div key="bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <motion.div role="dialog" aria-modal="true" aria-label={d?.title || 'Politika'} onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={spring}
            className="card flex max-h-[88dvh] w-full max-w-2xl flex-col !rounded-b-none !p-0 sm:max-h-[80dvh] sm:!rounded-b-[28px]">
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-50">{d?.title || 'Yükleniyor…'}</h2>
                {d && <p className="mt-1 text-xs leading-relaxed text-slate-400">{d.lead}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Kapat" className="btn-ghost !p-2"><X size={16} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 text-[13px] leading-relaxed text-slate-400 sm:px-6 [&_b]:font-semibold [&_b]:text-slate-200 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
              {d ? d.sections.map(([h, ...body], i) => <section key={h}><h3 className="mb-1.5 text-sm font-semibold text-slate-100">{i + 1}. {h}</h3>{body}</section>)
                : <Loader2 size={18} className="mx-auto animate-spin text-slate-500" aria-label="Yükleniyor" />}
            </div>
            <div className="border-t border-white/[0.06] px-5 py-3 sm:px-6"><button type="button" onClick={onClose} className="btn w-full">Anladım, forma dön</button></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function Register() {
  const { register } = useAuth(); const nav = useNavigate();
  const mode = useExam(s => s.mode);
  const [track, setTrack] = useState(mode);   // landing'de seçilen sınav hazır gelir
  const [pw, setPw] = useState('');
  const [doc, setDoc] = useState(null);   // açık politika penceresi: 'kosullar' | 'gizlilik' | 'kvkk'
  const f = useForm(async d => { await register(d.username, d.email, d.password, track, track === 'BOTH' ? 'DGS' : track); nav('/'); });
  const st = pw ? strengthOf(pw) : -1;
  return (
    <Frame title="Hesap oluştur" subtitle="Hazırlandığın sınavı seç; panel buna göre şekillenir."
      footer={<div>Zaten hesabın var mı? <Link2 to="/giris">Giriş yap</Link2></div>}>
      <Form f={f}>
        <motion.fieldset variants={item}>
          <legend className="mb-1.5 block text-xs font-medium text-slate-400">Hangi sınava hazırlanıyorsun?</legend>
          <TrackPicker value={track} onChange={setTrack} id="reg-track" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={track} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="mt-2 text-xs text-slate-500">
              {track === 'DGS' ? 'Panelde yalnızca DGS müfredatı, denemeleri ve geri sayımı olur.' : track === 'YKS' ? 'Panelde TYT ve AYT müfredatı, denemeleri ve geri sayımı olur.' : track === 'LGS' ? 'Panelde LGS dersleri, denemeleri (3 yanlış 1 doğru) ve geri sayımı olur. LGS hesabı DGS/YKS ile karışmaz.' : 'DGS ve YKS birlikte açılır; üst çubuktan tek dokunuşla geçersin, veriler ayrı kalır.'}
            </motion.p>
          </AnimatePresence>
        </motion.fieldset>
        <Field id="username" label="Kullanıcı adı" hint="Harf, rakam, _ . - kullanılabilir; boşluk olmaz."><input id="username" name="username" required minLength={3} maxLength={30} autoComplete="username" /></Field>
        <Field id="email" label="E-posta"><input id="email" name="email" type="email" required autoComplete="email" /></Field>
        <Field id="password" label="Şifre">
          <Password id="password" autoComplete="new-password" minLength={8} maxLength={72} value={pw} onChange={e => setPw(e.target.value)} />
          <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">{[0, 1, 2, 3].map(i => <span key={i} className={clsx('h-1 flex-1 rounded-full transition-colors duration-300', i < st ? (st >= 3 ? 'bg-accent' : st === 2 ? 'bg-amber-400' : 'bg-red-400') : 'bg-white/10')} />)}</div>
          <p className="mt-1 text-xs text-slate-500" role="status">{st >= 0 ? STRENGTH[st] + ' · ' : ''}En az 8 karakter, harf ve rakam içermeli.</p>
        </Field>
        <motion.div variants={item}><Consent onOpen={setDoc} /></motion.div>
        <Msg {...f} /><Submit busy={f.busy}>{track === 'BOTH' ? 'Hibrit hesabı oluştur' : `${track} için kayıt ol`}</Submit>
      </Form>
      <PolicyModal doc={doc} onClose={() => setDoc(null)} />
    </Frame>
  );
}

export function Forgot() {
  const f = useForm(async d => (await post('/auth/forgot-password', { email: d.email })).message);
  return (
    <Frame title="Şifre sıfırlama" subtitle="E-posta adresine bir sıfırlama bağlantısı göndereceğiz." footer={<Link2 to="/giris">Girişe dön</Link2>}>
      <Form f={f}>
        <Field id="email" label="E-posta" hint="Bağlantı 15 dakika geçerlidir."><input id="email" name="email" type="email" required /></Field>
        <Msg {...f} /><Submit busy={f.busy}>Bağlantı gönder</Submit>
      </Form>
    </Frame>
  );
}

export function Reset() {
  const [sp] = useSearchParams(); const nav = useNavigate();
  const f = useForm(async d => {
    await post('/auth/reset-password', { token: sp.get('token') || '', password: d.password });
    setTimeout(() => nav('/giris'), 1500); return 'Şifre güncellendi. Girişe yönlendiriliyorsun…';
  });
  return (
    <Frame title="Yeni şifre belirle" subtitle="Hesabın için yeni bir şifre seç." footer={<Link2 to="/giris">Girişe dön</Link2>}>
      <Form f={f}>
        <Field id="password" label="Yeni şifre"><Password id="password" autoComplete="new-password" minLength={8} maxLength={72} /></Field>
        <Msg {...f} /><Submit busy={f.busy}>Şifreyi güncelle</Submit>
      </Form>
    </Frame>
  );
}


// /k/:slug — kuruma özel giriş (logo, ad, renk)
export function KurumLogin() {
  const { slug } = useParams();
  const [brand, setBrand] = useState(undefined);   // undefined: yükleniyor, null: bulunamadı
  useEffect(() => { let on = true; get('/kurum/brand/' + encodeURIComponent(slug)).then(b => on && setBrand(b)).catch(() => on && setBrand(null)); return () => { on = false; }; }, [slug]);
  if (brand === undefined) return <div className="p-10 text-center text-slate-500" role="status">Yükleniyor…</div>;
  if (brand === null) return <Navigate to="/giris" replace />;
  return <Login brand={brand} />;
}

// İlk giriş (geçici şifre) → zorunlu şifre değiştirme. Başka hiçbir ekrana geçilemez.
export function ChangePassword() {
  const { user, patchUser, logout } = useAuth();
  const [pw, setPw] = useState('');
  useBrandColor(user?.institution?.color);
  const f = useForm(async d => {
    if (d.newPassword !== d.again) throw new Error('Yeni şifreler aynı değil');
    await post('/auth/change-password', { currentPassword: d.currentPassword, newPassword: d.newPassword });
    patchUser({ mustChangePassword: false });
  });
  const st = pw ? strengthOf(pw) : -1;
  return (
    <>
      <Ambient />
      <Frame hideHome brand={user?.institution} title="Yeni şifre belirle" subtitle="Güvenliğin için kurumun verdiği geçici şifreyi değiştirmen gerekiyor."
        footer={<button type="button" onClick={logout} className="text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline">Çıkış yap</button>}>
        <Form f={f}>
          <Field id="currentPassword" label="Geçici şifre"><Password id="currentPassword" name="currentPassword" autoComplete="current-password" /></Field>
          <Field id="newPassword" label="Yeni şifre" hint="En az 8 karakter, harf ve rakam içermeli.">
            <Password id="newPassword" name="newPassword" autoComplete="new-password" minLength={8} maxLength={72} value={pw} onChange={e => setPw(e.target.value)} />
            <div className="mt-2 flex items-center gap-1.5" aria-hidden="true">{[0, 1, 2, 3].map(i => <span key={i} className={clsx('h-1 flex-1 rounded-full transition-colors duration-300', i < st ? (st >= 3 ? 'bg-accent' : st === 2 ? 'bg-amber-400' : 'bg-red-400') : 'bg-white/10')} />)}</div>
          </Field>
          <Field id="again" label="Yeni şifre (tekrar)"><Password id="again" name="again" autoComplete="new-password" minLength={8} maxLength={72} /></Field>
          <Msg {...f} /><Submit busy={f.busy}>Şifreyi kaydet</Submit>
        </Form>
      </Frame>
    </>
  );
}
