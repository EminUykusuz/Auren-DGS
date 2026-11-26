import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth, useExam } from './store.js';
import { Shell, Ambient } from './components/Layout.jsx';
import RouteSEO from './components/RouteSEO.jsx';
import { LEGAL_DOCS } from './lib/legal-docs.js';
import { Login, Register, Forgot, Reset, KurumLogin, ChangePassword } from './pages/AuthPages.jsx';
import { isStaff } from './lib/kurum.js';

const Landing = lazy(() => import('./pages/Landing.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Study = lazy(() => import('./pages/Study.jsx'));
const Timer = lazy(() => import('./pages/Timer.jsx'));
const Exams = lazy(() => import('./pages/Exams.jsx'));
const Curriculum = lazy(() => import('./pages/Curriculum.jsx'));
const Friends = lazy(() => import('./pages/Friends.jsx'));
const Battle = lazy(() => import('./pages/Battle.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Legal = lazy(() => import('./pages/Legal.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const Kurum = lazy(() => import('./pages/Kurum.jsx'));

export default function App() {
  const loc = useLocation();
  const { user, ready, init } = useAuth(); const config = useExam(s => s.config);
  useEffect(() => { init(); }, [init]);
  const seo = <RouteSEO loggedIn={!!user} />;
  if (!ready) return <div className="p-10 text-center text-slate-500" role="status">Yükleniyor…</div>;
  if (user && !config) return <div className="p-10 text-center text-sm text-red-300" role="alert">Sunucuya ulaşılamadı. <button className="underline" onClick={() => init()}>Tekrar dene</button></div>;
  if (!user) return (
    <>{seo}<Ambient />
      <Routes>
        <Route path="/" element={<Suspense fallback={null}><Landing /></Suspense>} />
        <Route path="/giris" element={<Login />} />
        <Route path="/k/:slug" element={<KurumLogin />} />
        <Route path="/kayit" element={<Register />} />
        <Route path="/sifremi-unuttum" element={<Forgot />} />
        <Route path="/reset-password" element={<Reset />} />
        {LEGAL_DOCS.map(d => <Route key={d} path={`/${d}`} element={<Suspense fallback={null}><Legal /></Suspense>} />)}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></>
  );
  // Geçici şifreyle giren kullanıcı (kurum öğrencisi/öğretmeni) şifresini değiştirmeden hiçbir yere gidemez
  if (user.mustChangePassword) return <>{seo}<ChangePassword /></>;
  // Kurum personeli (yönetici/öğretmen): öğrenci ekranları yerine kurum paneli
  if (isStaff(user)) return (
    <>{seo}<Routes>
      <Route element={<Shell />}>
        <Route path="/kurum/*" element={<Kurum />} />
        <Route path="/ayarlar" element={<Settings />} />
        {user.isAdmin && <Route path="/admin/*" element={<Admin />} />}
      </Route>
      {LEGAL_DOCS.map(d => <Route key={d} path={`/${d}`} element={<Suspense fallback={null}><Legal /></Suspense>} />)}
      <Route path="*" element={<Navigate to="/kurum" replace />} />
    </Routes></>
  );
  return (
    <>{seo}<Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/calisma" element={<Study />} />
        <Route path="/kronometre" element={<Timer />} />
        <Route path="/denemeler" element={<Exams />} />
        <Route path="/mufredat" element={<Curriculum />} />
        <Route path="/arkadaslar" element={<Friends />} />
        <Route path="/karsilastir" element={<Battle />} />
        <Route path="/karsilastir/:friendId" element={<Battle />} />
        <Route path="/ayarlar" element={<Settings />} />
        {user.isAdmin && <Route path="/admin/*" element={<Admin />} />}
      </Route>
      {LEGAL_DOCS.map(d => <Route key={d} path={`/${d}`} element={<Suspense fallback={null}><Legal /></Suspense>} />)}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></>
  );
}
