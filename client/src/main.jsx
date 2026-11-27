import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useTheme } from './theme.js';
import { useExam } from './store.js';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

// Performans modunda Framer Motion dönüşüm/yerleşim animasyonlarını tamamen kapatır
function Root() {
  const perf = useTheme(s => s.perf);
  const exam = useExam(s => s.mode);
  React.useEffect(() => { document.documentElement.dataset.exam = exam; }, [exam]);   // vurgu rengi: landing, giriş ve panel ortak
  return <MotionConfig reducedMotion={perf ? 'always' : 'user'}><ErrorBoundary><BrowserRouter><App /></BrowserRouter></ErrorBoundary></MotionConfig>;
}

// Oturumsuz ziyaretçi (kayıtlı sınav tercihi yok) "/" açıyorsa Landing paketi, /api/auth/me yanıtını beklemeden paralel inmeye başlar.
// Giriş yapmış kullanıcıda bu anahtar vardır; onlar için 50 KB'lık Landing indirilmez.
if (location.pathname === '/' && !localStorage.getItem('auren_mode')) import('./pages/Landing.jsx');

// Yeni sürüm yayınlanınca eski hash'li parçalar sunucudan kalkar; açık sekmede sayfa geçişi parça indiremez.
// Bir kez yenile (sonsuz döngü olmasın diye 30 sn içinde ikinci kez yenilenmez).
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  const last = Number(sessionStorage.getItem('auren_reload') || 0);
  if (Date.now() - last > 30_000) { sessionStorage.setItem('auren_reload', String(Date.now())); location.reload(); }
});

createRoot(document.getElementById('root')).render(<Root />);
