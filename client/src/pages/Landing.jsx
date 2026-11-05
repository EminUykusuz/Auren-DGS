import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ArrowRight, Play, Pause, RotateCcw, Users, BookOpen, Timer, TrendingUp } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const spring = { type: 'spring', stiffness: 380, damping: 22 };
const pad = n => String(n).padStart(2, '0');
const nextJuly19 = (now) => { const t = new Date(now.getFullYear(), 6, 19); return t > now ? t : new Date(now.getFullYear() + 1, 6, 19); };

/* ---------- Ortak parçalar ---------- */
function Cta({ big, className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-3 sm:flex-row ${className}`}>
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} transition={spring}>
        <Link to="/kayit" className={`btn ${big ? 'px-8 py-3.5 text-base shadow-[0_0_48px_-6px_rgb(var(--accent)/0.8)]' : ''}`}>
          Hemen Başla {big && <ArrowRight size={18} aria-hidden="true" />}
        </Link>
      </motion.div>
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }} transition={spring}>
        <Link to="/giris" className={`btn-ghost ${big ? 'px-8 py-3.5 text-base' : ''}`}>Giriş Yap</Link>
      </motion.div>
    </div>
  );
}

function SectionHead({ title, text }) {
  return (
    <div className="reveal mb-8 max-w-2xl">
      <h2 className="text-3xl font-bold leading-tight tracking-tight text-slate-50 sm:text-5xl">{title}</h2>
      <p className="mt-3 text-base text-slate-400 sm:text-lg">{text}</p>
    </div>
  );
}

/* ---------- Canlı geri sayım (hero) ---------- */
function LiveCountdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const target = nextJuly19(now);
  const s = Math.max(0, Math.floor((target - now) / 1000));
  const cells = [['Gün', Math.floor(s / 86400)], ['Saat', Math.floor(s / 3600) % 24], ['Dakika', Math.floor(s / 60) % 60], ['Saniye', s % 60]];
  return (
    <div className="hero-count card mx-auto mt-10 w-full max-w-2xl" role="timer" aria-label={`Tahmini sınava ${cells[0][1]} gün ${cells[1][1]} saat kaldı`}>
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        {cells.map(([l, v], i) => (
          <div key={l} className="text-center">
            <div aria-hidden="true" className={`num text-4xl font-bold tracking-tight sm:text-7xl ${i === 0 ? 'text-accent drop-shadow-[0_0_24px_rgb(var(--accent)/0.6)]' : 'text-slate-50'}`}>{i === 0 ? v : pad(v)}</div>
            <div aria-hidden="true" className="mt-1 text-xs text-slate-400 sm:text-sm">{l}</div>
          </div>))}
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        Tahmini sınav tarihi: {target.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}. Kesin tarihi hesabında kendin girersin.
      </p>
    </div>
  );
}

/* ---------- Net hesaplayıcı ---------- */
function NetDemo() {
  const [c, setC] = useState(38); const [w, setW] = useState(8);
  const net = c - w / 4;
  const setCorrect = v => { v = Number(v); setC(v); if (v + w > 50) setW(50 - v); };
  const setWrong = v => { v = Number(v); setW(v); if (v + c > 50) setC(50 - v); };
  return (
    <div className="card reveal">
      <div className="grid gap-8 md:grid-cols-2 md:items-center">
        <div className="space-y-6">
          <div>
            <label htmlFor="nc" className="flex justify-between text-sm text-slate-300"><span>Doğru</span><span className="num font-semibold text-emerald-300">{c}</span></label>
            <input id="nc" type="range" min="0" max="50" value={c} onChange={e => setCorrect(e.target.value)} />
          </div>
          <div>
            <label htmlFor="nw" className="flex justify-between text-sm text-slate-300"><span>Yanlış</span><span className="num font-semibold text-red-300">{w}</span></label>
            <input id="nw" type="range" min="0" max="50" value={w} onChange={e => setWrong(e.target.value)} />
          </div>
          <p className="text-sm text-slate-400">Dört yanlış, bir doğruyu götürür. Yanlışlarının bedelini gör.</p>
        </div>
        <div className="text-center" aria-live="polite">
          <div className="text-sm text-slate-400">Netin</div>
          <motion.div key={net} initial={{ scale: 0.92, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={spring}
            className="num text-7xl font-extrabold tracking-tight text-slate-50 drop-shadow-[0_0_30px_rgb(var(--accent)/0.5)] sm:text-8xl">
            {net.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
          </motion.div>
          <div className="mt-2 text-sm text-slate-400">{w > 0 ? `${w} yanlış, ${(w / 4).toLocaleString('tr-TR')} net götürdü` : 'Hiç yanlışın yok'}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Neden yanlış yaptım ---------- */
const reasons = [
  { key: 'dikkat', label: 'Dikkat Hatası', color: '#F59E0B', n: 5, tip: 'Soruyu yanlış okudun ya da işlem hatası yaptın.' },
  { key: 'konu', label: 'Konu Eksiği', color: '#06B6D4', n: 3, tip: 'Konuyu henüz oturtmamışsın: müfredattan çalışılacak yer belli.' },
  { key: 'sure', label: 'Süre Yetmedi', color: '#818CF8', n: 2, tip: 'Bilgin var ama zaman yetmedi: hız çalışması zamanı.' },
  { key: 'formul', label: 'Formül Unuttum', color: '#10B981', n: 1, tip: 'Formül kartı hazırlamanın tam zamanı.' },
];
function WhyDemo() {
  const [sel, setSel] = useState('dikkat');
  const total = reasons.reduce((s, r) => s + r.n, 0);
  const cur = reasons.find(r => r.key === sel);
  return (
    <div className="card reveal">
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Yanlış nedenleri">
        {reasons.map(r => (
          <motion.button key={r.key} role="tab" aria-selected={sel === r.key} whileTap={{ scale: 0.94 }} onClick={() => setSel(r.key)}
            className={`rounded-full border px-4 py-2 text-sm transition ${sel === r.key ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10'}`}>
            <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />{r.label}
          </motion.button>))}
      </div>
      <div className="flex h-14 overflow-hidden rounded-2xl" aria-hidden="true">
        {reasons.map(r => (
          <motion.div key={r.key} layout animate={{ flexGrow: sel === r.key ? r.n * 2 : r.n, opacity: sel === r.key ? 1 : 0.45 }} transition={spring}
            style={{ background: r.color, flexBasis: 0 }} className="flex items-center justify-center text-sm font-bold text-onaccent">{r.n}</motion.div>))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={sel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-5 text-base text-slate-200">
          <strong>{cur.label}:</strong> {cur.tip} <span className="text-slate-500">(Örnek veri: {total} yanlış)</span>
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/* ---------- Pomodoro ---------- */
function PomoDemo() {
  const TOTAL = 25 * 60;
  const [left, setLeft] = useState(TOTAL); const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setLeft(l => (l <= 1 ? (setOn(false), TOTAL) : l - 1)), 1000);
    return () => clearInterval(t);
  }, [on]);
  const R = 88, C = 2 * Math.PI * R;
  return (
    <div className="card reveal flex flex-col items-center justify-center py-8">
      <div className="relative h-52 w-52">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgb(var(--fg) / .08)" strokeWidth="10" />
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgb(var(--accent))" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - left / TOTAL)} style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 8px rgb(var(--accent)/.8))' }} />
        </svg>
        <div className="num absolute inset-0 flex items-center justify-center text-5xl font-bold text-slate-50" role="timer">{pad(Math.floor(left / 60))}:{pad(left % 60)}</div>
      </div>
      <div className="mt-5 flex gap-2">
        <motion.button whileTap={{ scale: 0.94 }} className="btn" onClick={() => setOn(o => !o)}>{on ? <Pause size={16} /> : <Play size={16} />}{on ? 'Duraklat' : 'Odaklan'}</motion.button>
        <motion.button whileTap={{ scale: 0.94 }} className="btn-ghost" aria-label="Sıfırla" onClick={() => { setOn(false); setLeft(TOTAL); }}><RotateCcw size={16} /></motion.button>
      </div>
    </div>
  );
}

/* ---------- Deneme grafiği (örnek) ---------- */
function TrendDemo() {
  const pts = [38, 44, 41, 52, 58, 63, 71];
  const W = 320, H = 120, max = 80;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * W, H - (v / max) * H]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`-6 -10 ${W + 12} ${H + 20}`} className="w-full" role="img" aria-label="Örnek deneme net grafiği: yükselen çizgi">
      <path d={`${d} L${W} ${H} L0 ${H} Z`} fill="rgb(var(--accent) / .12)" />
      <path className="trend-line" d={d} fill="none" stroke="rgb(var(--accent))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgb(var(--accent)/.8))' }} />
      {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="rgb(var(--bg))" stroke="rgb(var(--accent))" strokeWidth="2.5" />)}
    </svg>
  );
}

/* ---------- Sayfa ---------- */
export default function Landing() {
  const root = useRef(null);
  const bento = useMemo(() => [
    { icon: TrendingUp, title: 'Denemelerin tek grafikte', text: 'Matematik, Türkçe ve toplam net zaman içinde nasıl değişiyor, en iyi denemen hangisi: hepsi tek bakışta.', wide: true, extra: <TrendDemo /> },
    { icon: BookOpen, title: 'Müfredat ve güç analizi', text: 'Konu konu hâkimiyetini işaretle, zayıf noktalarını önce çalış.' },
    { icon: Users, title: 'Arkadaşlarınla yüz yüze', text: 'Arkadaşlarını ekle, netlerini ve çalışma sürelerini karşılaştır. Rekabet motivasyondur.' },
    { icon: Timer, title: 'Çalışma kaydı ve zamanlayıcı', text: 'Hangi derse ne kadar çalıştığını kaydet, haftanın özetini gör.' },
  ], []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = t => lenis.raf(t * 1000);
    gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0);
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.nav-in', { y: -30, opacity: 0, duration: 0.7 })
        .from('.hero-line', { yPercent: 110, duration: 0.9, stagger: 0.12 }, '-=0.3')
        .from('.hero-sub', { y: 24, opacity: 0, duration: 0.7 }, '-=0.5')
        .from('.hero-count', { y: 40, opacity: 0, scale: 0.96, duration: 0.9 }, '-=0.5')
        .from('.hero-cta', { y: 24, opacity: 0, duration: 0.7 }, '-=0.6');
      gsap.utils.toArray('.reveal').forEach(el =>
        gsap.from(el, { y: 50, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
      gsap.from('.bento > *', { y: 50, opacity: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '.bento', start: 'top 82%', once: true } });
      gsap.from('.trend-line', { strokeDasharray: 600, strokeDashoffset: 600, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: '.bento', start: 'top 70%', once: true } });
      gsap.to('.orb-a', { yPercent: -30, ease: 'none', scrollTrigger: { scrub: true, start: 0, end: 'max' } });
      gsap.to('.orb-b', { yPercent: 25, ease: 'none', scrollTrigger: { scrub: true, start: 0, end: 'max' } });
    }, root);
    return () => { ctx.revert(); gsap.ticker.remove(tick); lenis.destroy(); };
  }, []);

  return (
    <div ref={root} className="relative overflow-x-hidden">
      <div className="orb-a pointer-events-none absolute left-[-10%] top-[10%] -z-10 h-[520px] w-[520px] rounded-full bg-emerald-400/20 blur-3xl" aria-hidden="true" />
      <div className="orb-b pointer-events-none absolute right-[-10%] top-[60%] -z-10 h-[620px] w-[620px] rounded-full bg-indigo-500/20 blur-3xl" aria-hidden="true" />

      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
        <nav className="nav-in glass-pill mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6" aria-label="Ana menü">
          <Link to="/" className="text-lg font-bold text-slate-100">Auren <span className="text-accent">DGS</span></Link>
          <div className="flex items-center gap-2">
            <Link to="/giris" className="btn-ghost">Giriş Yap</Link>
            <Link to="/kayit" className="btn">Hemen Başla</Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="flex min-h-[85vh] flex-col items-center justify-center py-16 text-center">
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-50 sm:text-7xl">
            <span className="block overflow-hidden pb-1"><span className="hero-line block">DGS'ye kalan</span></span>
            <span className="block overflow-hidden pb-2"><span className="hero-line block bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">her saniye değerli.</span></span>
          </h1>
          <p className="hero-sub mx-auto mt-6 max-w-xl text-base text-slate-300 sm:text-lg">
            Auren DGS; geri sayımı, deneme netlerini, hata nedenlerini ve çalışma süreni tek yerde toplayan DGS hazırlık platformu.
          </p>
          <LiveCountdown />
          <Cta big className="hero-cta mt-8" />
        </section>

        <section className="py-20" aria-labelledby="net">
          <SectionHead title={<span id="net">Yanlışın ne kadar pahalı?</span>} text="Barı oynat: her yanlış, doğrularından net götürür. Auren her denemende bunu senin yerine hesaplar ve gelişimini çizer." />
          <NetDemo />
        </section>

        <section className="py-20" aria-labelledby="why">
          <SectionHead title={<span id="why">Neden yanlış yaptım?</span>} text="Netin düşmesinin sebebi çoğu zaman bilgi değil. Her yanlışına bir neden ver; Auren nerede kaybettiğini gösterir." />
          <WhyDemo />
        </section>

        <section className="py-20" aria-labelledby="odak">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div className="reveal">
              <h2 id="odak" className="text-3xl font-bold leading-tight tracking-tight text-slate-50 sm:text-5xl">25 dakika. Sadece ders.</h2>
              <p className="mt-3 text-base text-slate-400 sm:text-lg">Pomodoro ile odaklan, bitince molanı ver. Çalışma sürelerin derslere göre kaydedilir, haftanın sonunda emeğini görürsün.</p>
            </div>
            <PomoDemo />
          </div>
        </section>

        <section className="py-20" aria-labelledby="hepsi">
          <SectionHead title={<span id="hepsi">Hazırlığın tamamı tek uygulamada</span>} text="Denemeden müfredata, arkadaşlarınla yarışmadan çalışma kaydına kadar." />
          <div className="bento grid gap-4 md:grid-cols-3">
            {bento.map(({ icon: Icon, title, text, wide, extra }) => (
              <motion.article key={title} whileHover={{ y: -8, scale: 1.015 }} transition={spring} className={`card ${wide ? 'md:col-span-2 md:row-span-2' : ''}`}>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-accent shadow-[0_0_28px_-4px_rgb(var(--accent)/0.65)]"><Icon size={22} aria-hidden="true" /></div>
                <h3 className="text-xl font-semibold text-slate-50">{title}</h3>
                <p className="mt-2 text-sm text-slate-400 sm:text-base">{text}</p>
                {extra && <div className="mt-6">{extra}<p className="mt-2 text-xs text-slate-500">Örnek veri</p></div>}
              </motion.article>))}
          </div>
        </section>

        <section className="py-20" aria-labelledby="son">
          <div className="card reveal py-16 text-center">
            <h2 id="son" className="text-3xl font-bold tracking-tight text-slate-50 sm:text-5xl">Saat işliyor. Başlayalım.</h2>
            <p className="mt-3 text-slate-400">Hesabını oluştur, ilk denemeni gir, gelişimini izlemeye başla.</p>
            <Cta big className="mt-8 justify-center" />
          </div>
        </section>
      </main>

      <footer className="px-4 pb-8 text-center text-xs text-slate-500">
        <div className="glass-pill inline-block px-5 py-2">Developed by <span className="font-medium text-emerald-400">Emin Uykusuz</span></div>
      </footer>
    </div>
  );
}
