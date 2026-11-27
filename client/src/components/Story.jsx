import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* Kaydırmayla oynayan 3B hikâye: bölüm ekrana sabitlenir, kaydırma GSAP zaman çizelgesini sürer, çizelge de WebGL sahnesinin
   durum sayılarını (story-gl.js) ve sol taraftaki metinleri. WebGL yoksa ya da hareket azaltılmışsa düz kartlar gösterilir. */

const CHAPTERS = [
  ['Deneme defterini aç', 'Her deneme kayıt altında. Netin, süren ve hataların aynı sayfada başlar.'],
  ['Her yanlışın bir nedeni var', 'Bilgi eksiği mi, dikkatsizlik mi, süre mi? Auren Study nedenini yazar, konunu aralıklı tekrar planına koyar.'],
  ['Optik formu doldur', 'Cevap kâğıdını fotoğrafla yükle; işaretler tarayıcıda okunsun, sen yalnızca onayla.'],
  ['Netin yükselsin', 'Her deneme bir çubuk. Haftalık trendin ve hedefin tek bakışta.'],
];

function webglOk() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }

export default function Story() {
  const sec = useRef(null), box = useRef(null);
  const [mode, setMode] = useState('pin');   // pin | static

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !webglOk()) { setMode('static'); return; }
    let api = null, ctx = null, dead = false, io = null;
    const state = { intro: 0, open: 0, type: 0, flip1: 0, flip2: 0, s1: 0, fill: 0, s2: 0, bars: 0 };

    // sahne yalnızca bölüme yaklaşınca yüklenir (ağır paket)
    const start = () => import('./story-gl.js').then(({ mountStory }) => mountStory(box.current)).then((made) => {
      if (dead) { made.dispose(); return; }
      api = made; api.render(state);
      ctx = gsap.context(() => {
        const chaps = gsap.utils.toArray('[data-chap]');
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: sec.current, start: 'top top', end: '+=5200', pin: true, scrub: 0.9, anticipatePin: 1, invalidateOnRefresh: true },
          onUpdate: () => api.render(state),
        });
        const show = (i, at, out) => { tl.fromTo(chaps[i], { autoAlpha: 0, y: 44 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, at); if (out != null) tl.to(chaps[i], { autoAlpha: 0, y: -44, duration: 0.45, ease: 'power2.in' }, out); };
        // 1: defter belirir ve açılır
        tl.to(state, { intro: 1, duration: 1.1 }, 0).to(state, { open: 1, duration: 1.1 }, 0.7);
        show(0, 0, 1.55);
        // 2: yazı yazılır, sayfalar çevrilir
        tl.to(state, { type: 1, duration: 1.4 }, 1.9).to(state, { flip1: 1, duration: 1.0 }, 3.4).to(state, { flip2: 1, duration: 1.0 }, 4.2);
        show(1, 1.95, 4.55);
        // 3: defter gider, optik form gelir, kalem doldurur
        tl.to(state, { s1: 1, duration: 1.1 }, 4.9).to(state, { fill: 1, duration: 2.4 }, 6.1);
        show(2, 5.45, 8.35);
        // 4: form grafiğe dönüşür
        tl.to(state, { s2: 1, duration: 1.1 }, 8.6).to(state, { bars: 1, duration: 1.4 }, 9.4);
        show(3, 9.15, null);
        tl.to({}, { duration: 1 }, 10.8);   // sonda kısa bekleme
        api.render(state);
      }, sec.current);
      ScrollTrigger.refresh();
    }).catch((e) => { console.error('[Story]', e); !dead && setMode('static'); });

    io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { io.disconnect(); start(); } }, { rootMargin: '900px 0px' });
    io.observe(sec.current);
    return () => { dead = true; io?.disconnect(); ctx?.revert(); api?.dispose(); };
  }, []);

  const head = (
    <h2 className="sr-only">Denemeden netine: Auren Study nasıl çalışır</h2>
  );

  if (mode === 'static') {
    return (
      <section ref={sec} className="py-20 md:py-28" aria-label="Nasıl çalışır">
        <div className="mx-auto w-full max-w-[1200px] px-5 md:px-8">
          {head}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {CHAPTERS.map(([h, p], i) => <div key={h} className="card !p-6"><div className="stat-label !text-accent">{i + 1} / 4</div><h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-50">{h}</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">{p}</p></div>)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={sec} className="relative h-screen min-h-[560px] overflow-hidden" aria-label="Nasıl çalışır">
      {head}
      <div ref={box} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 mx-auto h-full w-full max-w-[1200px] px-5 md:px-8">
        {CHAPTERS.map(([h, p], i) => (
          <div key={h} data-chap className="absolute inset-x-5 bottom-10 rounded-2xl bg-black/45 p-5 backdrop-blur-sm md:inset-x-8 lg:bottom-auto lg:left-8 lg:right-auto lg:top-1/2 lg:w-[34%] lg:-translate-y-1/2 lg:bg-transparent lg:p-0 lg:backdrop-blur-none" style={{ opacity: 0, visibility: 'hidden' }}>
            <div className="stat-label !text-accent">{i + 1} / 4</div>
            <h3 className="mt-3 text-3xl font-semibold leading-[1.05] tracking-[-0.03em] text-slate-50 md:text-5xl">{h}</h3>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-300 md:text-[17px]">{p}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
