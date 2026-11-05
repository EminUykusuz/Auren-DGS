import { Link } from 'react-router-dom';
import { Timer, LineChart, SearchCheck, Target, ArrowRight, Sparkles } from 'lucide-react';

const features = [
  { icon: Timer, title: 'DGS Geri Sayım & Sayaç', text: 'Sınava kalan süreyi gün, saat ve dakika olarak anlık takip et.', tone: 'from-emerald-400/30' },
  { icon: LineChart, title: 'Gelişmiş Net & Puan Analizi', text: 'Deneme sonuçlarını gir, grafiklerle gelişimini adım adım izle.', tone: 'from-cyan-400/30' },
  { icon: SearchCheck, title: '"Neden Yanlış Yaptım?" Modülü', text: 'Hatalarının kaynağını bul: dikkat hatası mı, bilgi eksikliği mi?', tone: 'from-indigo-400/30' },
  { icon: Target, title: 'Pomodoro & Odaklanma Modu', text: 'Ders çalışırken süreni ve verimini tek yerden yönet.', tone: 'from-fuchsia-400/30' },
];

function AuthButtons({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Link to="/giris" className="btn-ghost">Giriş Yap</Link>
      <Link to="/kayit" className="btn">Hemen Başla</Link>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
        <nav className="glass-pill mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6" aria-label="Ana menü">
          <Link to="/" className="text-lg font-bold text-slate-100">Auren <span className="text-accent">DGS</span></Link>
          <AuthButtons />
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:pt-24">
          <span className="glass-pill inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-emerald-300">
            <Sparkles size={14} aria-hidden="true" /> DGS hazırlığında yeni nesil takip
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-50 sm:text-6xl">
            DGS'ye <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">akıllı</span> hazırlan
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-400 sm:text-lg">
            Geri sayımdan deneme analizine, hata incelemesinden odaklanma moduna kadar ihtiyacın olan her şey tek uygulamada.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/kayit" className="btn px-7 py-3 text-base shadow-[0_0_40px_-6px_rgb(var(--accent)/0.7)]">
              Hemen Başla <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/giris" className="btn-ghost px-7 py-3 text-base">Giriş Yap</Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-4" aria-label="Özellikler">
          {features.map(({ icon: Icon, title, text, tone }) => (
            <article key={title} className="card group transition hover:-translate-y-1 hover:border-white/20">
              <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${tone} to-transparent blur-2xl`} aria-hidden="true" />
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-accent shadow-[0_0_24px_-4px_rgb(var(--accent)/0.6)]">
                <Icon size={22} aria-hidden="true" />
              </div>
              <h2 className="text-base font-semibold text-slate-100">{title}</h2>
              <p className="mt-2 text-sm text-slate-400">{text}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="px-4 pb-8 text-center text-xs text-slate-500">
        <div className="glass-pill mx-auto inline-block px-5 py-2">
          Developed by <span className="font-medium text-emerald-400">Emin Uykusuz</span>
        </div>
      </footer>
    </div>
  );
}
