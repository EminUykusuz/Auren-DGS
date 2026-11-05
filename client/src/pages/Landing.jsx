import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Timer, LineChart, SearchCheck, Target, ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const features = [
  { icon: Timer, title: 'DGS Geri Sayım', text: 'Sınava kalan günü, saati ve dakikayı anlık takip et.', glow: 'from-emerald-400/40' },
  { icon: LineChart, title: 'Net & Puan Analizi', text: 'Deneme sonuçlarını gir; net ve puan gelişimini grafiklerle izle.', glow: 'from-cyan-400/40' },
  { icon: SearchCheck, title: 'Neden Yanlış Yaptım?', text: 'Hatanın kaynağını işaretle: dikkat mi, bilgi eksikliği mi, süre mi?', glow: 'from-indigo-400/40' },
  { icon: Target, title: 'Pomodoro & Odak', text: 'Çalışma sürelerini ve verimini tek ekrandan yönet.', glow: 'from-fuchsia-400/40' },
];

const Start = ({ big }) => (
  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
    <Link to="/kayit" className={big ? 'btn px-8 py-3.5 text-base shadow-[0_0_44px_-6px_rgb(var(--accent)/0.75)]' : 'btn'}>
      Hemen Başla {big && <ArrowRight size={18} aria-hidden="true" />}
    </Link>
  </motion.div>
);
const Login = ({ big }) => (
  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
    <Link to="/giris" className={big ? 'btn-ghost px-8 py-3.5 text-base' : 'btn-ghost'}>Giriş Yap</Link>
  </motion.div>
);

export default function Landing() {
  const root = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    // Lenis yumuşak kaydırma; GSAP ticker ile eşlenir
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (t) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.nav-in', { y: -30, opacity: 0, duration: 0.7 })
        .from('.hero-badge', { y: 20, opacity: 0, duration: 0.6 }, '-=0.3')
        .from('.hero-line', { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.12 }, '-=0.3')
        .from('.hero-sub', { y: 24, opacity: 0, duration: 0.7 }, '-=0.5')
        .from('.hero-cta', { y: 24, opacity: 0, duration: 0.7 }, '-=0.5');

      gsap.from('.feat-title', { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '.feat-title', start: 'top 85%' } });
      gsap.from('.feat-card', {
        y: 60, opacity: 0, scale: 0.96, duration: 0.8, stagger: 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: '.feat-grid', start: 'top 80%' },
      });
      gsap.from('.final-cta', { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '.final-cta', start: 'top 88%' } });
      gsap.to('.orb', { yPercent: -25, ease: 'none', scrollTrigger: { scrub: true, start: 0, end: 'max' } });
    }, root);

    return () => { ctx.revert(); gsap.ticker.remove(tick); lenis.destroy(); };
  }, []);

  return (
    <div ref={root} className="relative min-h-screen overflow-x-hidden">
      <div className="orb pointer-events-none absolute left-1/2 top-24 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-400/25 via-cyan-400/20 to-indigo-500/25 blur-3xl" aria-hidden="true" />

      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
        <nav className="nav-in glass-pill mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6" aria-label="Ana menü">
          <Link to="/" className="text-lg font-bold text-slate-100">Auren <span className="text-accent">DGS</span></Link>
          <div className="flex items-center gap-2"><Login /><Start /></div>
        </nav>
      </header>

      <main>
        <section className="mx-auto flex min-h-[78vh] max-w-4xl flex-col items-center justify-center px-4 text-center">
          <span className="hero-badge glass-pill px-4 py-1.5 text-xs font-medium text-emerald-300">DGS hazırlığı için tek uygulama</span>
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-50 sm:text-7xl">
            <span className="block overflow-hidden pb-1"><span className="hero-line block">Hedefine</span></span>
            <span className="block overflow-hidden pb-2"><span className="hero-line block bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">net net</span></span>
            <span className="block overflow-hidden pb-1"><span className="hero-line block">ilerle.</span></span>
          </h1>
          <p className="hero-sub mx-auto mt-6 max-w-xl text-base text-slate-400 sm:text-lg">
            Geri sayım, deneme analizi, hata takibi ve odak modu. Hepsi tek yerde, sade ve hızlı.
          </p>
          <div className="hero-cta mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Start big /><Login big />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="ozellikler">
          <h2 id="ozellikler" className="feat-title mb-10 text-center text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">İhtiyacın olan her şey</h2>
          <div className="feat-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text, glow }) => (
              <motion.article key={title} className="feat-card card"
                whileHover={{ y: -8, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <div className={`pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br ${glow} to-transparent blur-2xl`} aria-hidden="true" />
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-accent shadow-[0_0_28px_-4px_rgb(var(--accent)/0.65)]">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">{title}</h3>
                <p className="mt-2 text-sm text-slate-400">{text}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="final-cta mx-auto max-w-3xl px-4 pb-24 text-center">
          <div className="card py-12">
            <h2 className="text-2xl font-bold text-slate-50 sm:text-3xl">Hazırsan başlayalım.</h2>
            <p className="mt-2 text-slate-400">Ücretsiz hesap oluştur, ilk denemeni gir.</p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"><Start big /><Login big /></div>
          </div>
        </section>
      </main>

      <footer className="px-4 pb-8 text-center text-xs text-slate-500">
        <div className="glass-pill inline-block px-5 py-2">Developed by <span className="font-medium text-emerald-400">Emin Uykusuz</span></div>
      </footer>
    </div>
  );
}
