import { lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store.js';
import { Shell, Ambient } from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Register, Forgot, Reset } from './pages/AuthPages.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Study = lazy(() => import('./pages/Study.jsx'));
const Timer = lazy(() => import('./pages/Timer.jsx'));
const Exams = lazy(() => import('./pages/Exams.jsx'));
const Curriculum = lazy(() => import('./pages/Curriculum.jsx'));
const Friends = lazy(() => import('./pages/Friends.jsx'));
const Battle = lazy(() => import('./pages/Battle.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));

export default function App() {
  const { user, ready, init } = useAuth();
  useEffect(() => { init(); }, [init]);
  if (!ready) return <div className="p-10 text-center text-slate-500" role="status">Yükleniyor…</div>;
  if (!user) return (
    <><Ambient />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/giris" element={<Login />} />
        <Route path="/kayit" element={<Register />} />
        <Route path="/sifremi-unuttum" element={<Forgot />} />
        <Route path="/reset-password" element={<Reset />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></>
  );
  return (
    <Routes>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
