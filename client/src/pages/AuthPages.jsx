import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../store.js';
import { post } from '../lib/api.js';

function Frame({ title, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <div className="mb-5 text-xl font-bold text-slate-100">Auren <span className="text-accent">DGS</span></div>
        <h1 className="mb-4 text-sm font-medium text-slate-300">{title}</h1>
        {children}
        <div className="mt-4 space-y-1 text-center text-xs text-slate-400">{footer}</div>
      </div>
    </div>
  );
}

function useForm(action) {
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { const m = await action(Object.fromEntries(new FormData(e.target))); if (m) setMsg(m); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return { err, msg, busy, submit };
}
const Msg = ({ err, msg }) => (<>
  {err && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}
  {msg && <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-emerald-300">{msg}</p>}
</>);

export function Login() {
  const { login } = useAuth(); const nav = useNavigate();
  const f = useForm(async d => { await login(d.identifier, d.password); nav('/'); });
  return (
    <Frame title="Giriş yap" footer={<><Link className="text-cyan2" to="/sifremi-unuttum">Şifremi unuttum</Link><div>Hesabın yok mu? <Link className="text-cyan2" to="/kayit">Kayıt ol</Link></div></>}>
      <form onSubmit={f.submit} className="space-y-3">
        <div><label htmlFor="identifier">Kullanıcı adı veya e-posta</label><input id="identifier" name="identifier" required autoComplete="username" /></div>
        <div><label htmlFor="password">Şifre</label><input id="password" name="password" type="password" required autoComplete="current-password" /></div>
        <Msg {...f} /><button className="btn w-full" disabled={f.busy}>Giriş yap</button>
      </form>
    </Frame>
  );
}

export function Register() {
  const { register } = useAuth(); const nav = useNavigate();
  const f = useForm(async d => { await register(d.username, d.email, d.password); nav('/'); });
  return (
    <Frame title="Hesap oluştur" footer={<div>Zaten hesabın var mı? <Link className="text-cyan2" to="/giris">Giriş yap</Link></div>}>
      <form onSubmit={f.submit} className="space-y-3">
        <div><label htmlFor="username">Kullanıcı adı</label><input id="username" name="username" required minLength={3} maxLength={30} autoComplete="username" /><p className="mt-1 text-xs text-slate-500">Harf, rakam, _ . - kullanılabilir; boşluk olmaz.</p></div>
        <div><label htmlFor="email">E-posta</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
        <div><label htmlFor="password">Şifre</label><input id="password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
          <p className="mt-1 text-xs text-slate-500">En az 8 karakter, harf ve rakam içermeli.</p></div>
        <Msg {...f} /><button className="btn w-full" disabled={f.busy}>Kayıt ol</button>
      </form>
    </Frame>
  );
}

export function Forgot() {
  const f = useForm(async d => (await post('/auth/forgot-password', { email: d.email })).message);
  return (
    <Frame title="Şifre sıfırlama" footer={<Link className="text-cyan2" to="/giris">Girişe dön</Link>}>
      <form onSubmit={f.submit} className="space-y-3">
        <div><label htmlFor="email">E-posta</label><input id="email" name="email" type="email" required /></div>
        <Msg {...f} /><button className="btn w-full" disabled={f.busy}>Bağlantı gönder</button>
        <p className="text-xs text-slate-500">Bağlantı 15 dakika geçerlidir.</p>
      </form>
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
    <Frame title="Yeni şifre belirle" footer={<Link className="text-cyan2" to="/giris">Girişe dön</Link>}>
      <form onSubmit={f.submit} className="space-y-3">
        <div><label htmlFor="password">Yeni şifre</label><input id="password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></div>
        <Msg {...f} /><button className="btn w-full" disabled={f.busy}>Şifreyi güncelle</button>
      </form>
    </Frame>
  );
}
