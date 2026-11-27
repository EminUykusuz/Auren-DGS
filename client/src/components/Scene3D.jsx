import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* Hero sahnesi: üst üste kitaplar, üzerinde kurşun kalem, arkada optik form. Bağımlılıksız (CSS 3D + GSAP).
   Süs amaçlıdır (aria-hidden). Hareket: açılışta düşüş, boşta yavaş salınım, fareyle ve kaydırmayla dönüş.
   Birimler px; koordinat: x sağ, y aşağı, z izleyiciye; zemin y=0. */

const face = (w, h, t) => ({ position: 'absolute', width: w, height: h, left: -w / 2, top: -h / 2, transform: t, backfaceVisibility: 'hidden' });

/* Kutu: 6 yüz. faces: { top, bottom, front, back, left, right } → { className, style, children } */
function Box({ w, h, d, faces }) {
  const T = {
    front: [w, h, `translateZ(${d / 2}px)`], back: [w, h, `rotateY(180deg) translateZ(${d / 2}px)`],
    right: [d, h, `rotateY(90deg) translateZ(${w / 2}px)`], left: [d, h, `rotateY(-90deg) translateZ(${w / 2}px)`],
    top: [w, d, `rotateX(90deg) translateZ(${h / 2}px)`], bottom: [w, d, `rotateX(-90deg) translateZ(${h / 2}px)`],
  };
  return <>{Object.entries(T).map(([k, [fw, fh, t]]) => { const f = faces[k] || {}; return <div key={k} className={f.className} style={{ ...face(fw, fh, t), ...f.style }}>{f.children}</div>; })}</>;
}

/* Kitap: kapak (üst, alt, sırt = sol) renkli; ön, arka ve sağ yüzler sayfa kenarı */
function Book({ w, h, d, cover, band }) {
  const pages = { className: 's3-pages' };
  const c = { className: 's3-cover', style: { background: cover } };
  return (
    <Box w={w} h={h} d={d} faces={{
      front: pages, back: pages, right: pages,
      left: { ...c, style: { background: cover, filter: 'brightness(.72)' } },
      bottom: { ...c, style: { background: cover, filter: 'brightness(.5)' } },
      top: { ...c, children: <><i className="s3-hinge" /><i className="s3-title" style={{ background: band }} /><i className="s3-title s3-title2" style={{ background: band }} /></> },
    }} />
  );
}

/* Altıgen prizma (kalem gövdesi): 6 yüz x ekseni boyunca */
function Hex({ len, R, bg, shades }) {
  const a = R * Math.cos(Math.PI / 6);
  return <>{shades.map((s, i) => <div key={i} style={{ ...face(len, R, `rotateX(${i * 60}deg) translateZ(${a}px)`), background: bg, filter: `brightness(${s})` }} />)}</>;
}

/* Kalem ucu: altıgen piramit; taban x=0, tepe sola. Üçgen yüzler eksene doğru yatırılır */
function Tip({ len, R }) {
  const a = R * Math.cos(Math.PI / 6), w = Math.hypot(len, a), phi = (Math.asin(a / w) * 180) / Math.PI;
  return <>{[1, 0.82, 0.6, 0.5, 0.64, 0.86].map((s, i) => (
    <div key={i} style={{ position: 'absolute', width: w, height: R, left: -w, top: -R / 2, transformOrigin: '100% 50%', backfaceVisibility: 'hidden',
      transform: `rotateX(${i * 60}deg) translateZ(${a}px) rotateY(${-phi}deg)`, clipPath: 'polygon(0 50%, 100% 0, 100% 100%)',
      background: 'linear-gradient(90deg, #2b2f3a 0 24%, #e9cfa6 24%)', filter: `brightness(${s})` }} />))}</>;
}

function Pencil() {
  const R = 10, seg = (x, children) => <div className="s3-seg" style={{ transform: `translateX(${x}px)` }}>{children}</div>;
  return (
    <>
      {seg(-91, <Tip len={60} R={R} />)}
      {seg(4, <Hex len={190} R={R} bg="rgb(var(--accent))" shades={[1, 0.86, 0.62, 0.46, 0.62, 0.86]} />)}
      {seg(114, <Hex len={30} R={R} bg="repeating-linear-gradient(90deg,#c9cfd8 0 5px,#8f98a6 5px 7px)" shades={[1, 0.9, 0.7, 0.55, 0.7, 0.9]} />)}
      {seg(140, <Hex len={22} R={R} bg="#f08aa0" shades={[1, 0.88, 0.7, 0.55, 0.7, 0.88]} />)}
    </>
  );
}

/* Optik form: satırlar halinde balonlar, birkaçı dolu */
const ROWS = 9, LET = ['A', 'B', 'C', 'D', 'E'], FILLED = { 0: 1, 1: 3, 2: 0, 4: 2, 5: 4, 6: 1, 8: 3 };
function Sheet() {
  return (
    <svg viewBox="0 0 150 210" width="150" height="210" aria-hidden="true">
      <rect width="150" height="210" fill="#fbf4f6" />
      <rect x="0" y="0" width="150" height="26" fill="#c43b5b" />
      <rect x="12" y="9" width="62" height="7" rx="1.5" fill="#fbf4f6" opacity=".9" />
      {Array.from({ length: ROWS }, (_, r) => (
        <g key={r}>
          {r % 2 === 0 && <rect x="8" y={38 + r * 18 - 8} width="134" height="16" fill="#f3d9e0" opacity=".7" />}
          <text x="13" y={38 + r * 18 + 3} fontSize="7" fill="#c43b5b" fontFamily="sans-serif">{r + 1}</text>
          {LET.map((l, c) => <circle key={l} cx={36 + c * 22} cy={38 + r * 18} r="6.2" fill={FILLED[r] === c ? '#14333a' : 'none'} stroke="#c43b5b" strokeWidth="1" data-s3-bubble={FILLED[r] === c ? 'on' : undefined} />)}
        </g>))}
    </svg>
  );
}

function SceneCSS({ className = '' }) {
  const root = useRef(null);

  useLayoutEffect(() => {
    const el = root.current; if (!el) return;
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // açılış: kitaplar sırayla düşer, kalem yerine döner, optik form belirir
        const tl = gsap.timeline({ delay: 0.35, defaults: { ease: 'power3.out' } });
        tl.from('[data-a="book"]', { y: -460, opacity: 0, duration: 1.1, stagger: 0.16, ease: 'bounce.out' })
          .from('[data-a="pencil"]', { y: -380, rotationZ: 70, rotationX: 120, opacity: 0, duration: 1.2, ease: 'back.out(1.3)' }, '-=0.5')
          .from('[data-a="sheet"]', { scale: 0.4, y: 80, opacity: 0, duration: 1, ease: 'back.out(1.6)' }, '-=0.9')
          .from('[data-a="shadow"]', { opacity: 0, scale: 0.6, duration: 1 }, 0.4)
          .from('[data-s3-bubble="on"]', { scale: 0, transformOrigin: '50% 50%', duration: 0.4, stagger: 0.1, ease: 'back.out(2.4)' }, '-=0.3');
        // boşta: nefes alan salınım
        gsap.to('[data-a="idle"]', { rotationY: 9, duration: 5.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        gsap.to('[data-a="sheet-float"]', { y: -10, rotationZ: 1.5, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        gsap.to('[data-a="pencil-float"]', { y: -4, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.6 });
        // kaydırma: sahne yavaşça döner
        gsap.fromTo('[data-a="scroll"]', { rotationY: 0 }, { rotationY: 55, ease: 'none', scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true } });
        // fare: sahne imleci izler (yalnızca fare olan cihazlar)
        if (window.matchMedia('(pointer: fine)').matches) {
          const ry = gsap.quickTo('[data-a="mouse"]', 'rotationY', { duration: 0.9, ease: 'power3' }), rx = gsap.quickTo('[data-a="mouse"]', 'rotationX', { duration: 0.9, ease: 'power3' });
          const mv = (e) => { ry((e.clientX / window.innerWidth - 0.5) * 40); rx(-(e.clientY / window.innerHeight - 0.5) * 14); };
          window.addEventListener('pointermove', mv);
          return () => window.removeEventListener('pointermove', mv);
        }
      });
    }, el);
    return () => { mm.revert(); ctx.revert(); };
  }, []);

  return (
    <div ref={root} aria-hidden="true" className={`s3 ${className}`}>
      <div className="s3-cam">
        <div className="s3-tilt">
          <div data-a="scroll" className="s3-g"><div data-a="mouse" className="s3-g"><div data-a="idle" className="s3-g">
            <div className="s3-place" style={{ transform: 'rotateX(90deg) translateZ(-1px)' }}><div data-a="shadow" className="s3-shadow" /></div>
            <div className="s3-place" style={{ transform: 'translateY(-18px)' }}><div data-a="book" className="s3-g"><Book w={190} h={36} d={130} cover="rgb(var(--accent))" band="#0b1f24" /></div></div>
            <div className="s3-place" style={{ transform: 'translateY(-51px) rotateY(12deg)' }}><div data-a="book" className="s3-g"><Book w={170} h={30} d={118} cover="#2a6f97" band="#e8f1f6" /></div></div>
            <div className="s3-place" style={{ transform: 'translateY(-79px) rotateY(-9deg)' }}><div data-a="book" className="s3-g"><Book w={150} h={26} d={106} cover="#d98e2b" band="#2b1b05" /></div></div>
            <div className="s3-place" style={{ transform: 'translateY(-103px) translateX(-6px) rotateY(-26deg) rotateZ(-3deg)' }}><div data-a="pencil" className="s3-g"><div data-a="pencil-float" className="s3-g"><Pencil /></div></div></div>
            <div className="s3-place" style={{ transform: 'translate3d(92px,-132px,-62px) rotateY(-24deg) rotateZ(3deg)' }}><div data-a="sheet" className="s3-g"><div data-a="sheet-float" className="s3-g">
              <div className="s3-sheet" style={{ ...face(150, 210, 'translateZ(0.5px)') }}><Sheet /></div>
              <div className="s3-sheet" style={{ ...face(150, 210, 'rotateY(180deg) translateZ(0.5px)'), background: '#f1e6e9' }} />
            </div></div></div>
          </div></div></div>
        </div>
      </div>
    </div>
  );
}

/* WebGL varsa gerçek ışık/gölgeli sahne (scene-gl.js, ayrı paket, boşta yüklenir); yoksa ya da yüklenemezse CSS sahnesi */
export default function Scene3D({ className = '' }) {
  const box = useRef(null);
  const [mode, setMode] = useState('loading');   // loading | gl | css
  useEffect(() => {
    let dispose = null, dead = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    import('./scene-gl.js').then(m => {
      if (dead) return;
      if (!m.webglOk()) return setMode('css');
      try { dispose = m.mountScene(box.current, { reduced }); setMode('gl'); } catch (e) { console.error('[Scene3D]', e); setMode('css'); }
    }).catch(() => !dead && setMode('css'));
    return () => { dead = true; dispose?.(); };
  }, []);
  if (mode === 'css') return <SceneCSS className={className} />;
  return <div ref={box} aria-hidden="true" className={`relative ${className}`} style={{ pointerEvents: 'none' }} />;
}
