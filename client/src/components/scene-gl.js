// Hero 3B sahnesi (WebGL / three.js): üst üste kitaplar, kurşun kalem, optik form, süzülen balonlar.
// Yalnızca Landing'de, ihtiyaç anında yüklenir (dinamik import). Süs amaçlıdır; erişilebilirlik ağacında değildir.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap,
  HemisphereLight, DirectionalLight, PMREMGenerator, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, ShadowMaterial,
  PlaneGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, TorusGeometry, CircleGeometry, CanvasTexture, RepeatWrapping,
  AdditiveBlending, DoubleSide, Clock,
} from 'three';
import { governor } from './perf.js';
import { makeLoader } from './models.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x) => 1 - (1 - x) ** 3;
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
const easeOutBounce = (x) => { const n1 = 7.5625, d1 = 2.75; if (x < 1 / d1) return n1 * x * x; if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75; if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375; return n1 * (x -= 2.625 / d1) * x + 0.984375; };
const seg = (t, delay, dur) => clamp01((t - delay) / dur);   // ilerleme 0..1

export function canvasTex(w, h, draw, renderer, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

/* ---- Dokular ---- */
export const pagesTexture = (r) => canvasTex(64, 256, (g, w, h) => {
  g.fillStyle = '#f2ecdd'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 4) { g.fillStyle = y % 8 ? '#d9d0bb' : '#fbf7ec'; g.fillRect(0, y, w, 2); }
}, r, [1, 3]);

export function coverTexture(r, { bg, ink, title, sub }) {
  return canvasTex(768, 540, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, 56, h);                         // sırt kıvrımı
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(56, 0, 10, h);
    g.strokeStyle = ink; g.globalAlpha = 0.85; g.lineWidth = 5; g.strokeRect(120, 70, w - 190, h - 140); g.globalAlpha = 1;
    g.fillStyle = ink; g.font = `800 150px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(title, 120 + (w - 190) / 2, h / 2 - 28);
    g.font = `600 34px ${FONT}`; g.globalAlpha = 0.8; g.fillText(sub, 120 + (w - 190) / 2, h / 2 + 76); g.globalAlpha = 1;
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${i % 2 ? '255,255,255' : '0,0,0'},${Math.random() * 0.035})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }   // kâğıt dokusu
  }, r);
}

function sheetTexture(r) {
  const W = 1100, H = 1550;
  return canvasTex(W, H, (g) => {
    g.fillStyle = '#fbf5f7'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#c43b5b'; g.fillRect(0, 0, W, 150);
    g.fillStyle = '#fff'; g.font = `800 54px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('CEVAP FORMU', 60, 66);
    g.font = `600 28px ${FONT}`; g.globalAlpha = 0.85; g.fillText('TYT · AYT · DGS', 60, 114); g.globalAlpha = 1;
    const FILLED = { 0: 1, 1: 3, 2: 0, 3: 4, 4: 2, 6: 1, 7: 3, 8: 0, 10: 4, 11: 2, 13: 1, 14: 3, 15: 0, 17: 2, 18: 4 };
    const rows = 20, y0 = 230, dy = 62, x0 = 230, dx = 150;
    for (let rr = 0; rr < rows; rr++) {
      const y = y0 + rr * dy;
      if (rr % 2 === 0) { g.fillStyle = '#f5dce3'; g.fillRect(36, y - 28, W - 72, 56); }
      g.fillStyle = '#c43b5b'; g.font = `700 28px ${FONT}`; g.textAlign = 'right'; g.fillText(String(rr + 1), 150, y + 1);
      for (let c = 0; c < 5; c++) {
        const x = x0 + c * dx;
        g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2);
        if (FILLED[rr] === c) { g.fillStyle = '#16343b'; g.fill(); } else { g.lineWidth = 4; g.strokeStyle = '#a82a4a'; g.stroke(); g.fillStyle = '#a82a4a'; g.font = `600 22px ${FONT}`; g.textAlign = 'center'; g.fillText('ABCDE'[c], x, y + 1); }
      }
    }
    for (let i = 0; i < 7000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.025})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  }, r);
}

export function glowTexture(r) {
  return canvasTex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(16,185,129,.9)'); gr.addColorStop(0.5, 'rgba(16,185,129,.25)'); gr.addColorStop(1, 'rgba(16,185,129,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, r);
}

/* ---- Nesneler ---- */
function makeBook(r, { w, h, d, color, ink, title, sub }) {
  const g = new Group();
  const coverMat = new MeshPhysicalMaterial({ color, roughness: 0.5, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const pagesMat = new MeshStandardMaterial({ map: pagesTexture(r), roughness: 0.9 });
  const pages = new Mesh(new RoundedBoxGeometry(w - 0.08, h - 0.1, d - 0.08, 3, 0.02), pagesMat); pages.position.x = 0.04;
  const top = new Mesh(new RoundedBoxGeometry(w, 0.055, d, 3, 0.022), coverMat); top.position.y = h / 2 - 0.0275;
  const bot = new Mesh(new RoundedBoxGeometry(w, 0.055, d, 3, 0.022), coverMat); bot.position.y = -h / 2 + 0.0275;
  const spine = new Mesh(new RoundedBoxGeometry(0.1, h, d, 3, 0.03), coverMat); spine.position.x = -w / 2 + 0.05;
  const label = new Mesh(new PlaneGeometry(w - 0.02, d - 0.02), new MeshStandardMaterial({ map: coverTexture(r, { bg: '#' + color.toString(16).padStart(6, '0'), ink, title, sub }), roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  label.rotation.x = -Math.PI / 2; label.position.y = h / 2 + 0.0005;
  for (const m of [pages, top, bot, spine]) { m.castShadow = true; m.receiveShadow = true; }
  label.receiveShadow = true;
  g.add(pages, top, bot, spine, label);
  g.userData.h = h;
  return g;
}

export function makePencil() {
  const g = new Group(), R = 0.12;
  const body = new MeshStandardMaterial({ color: 0x10b981, roughness: 0.32, metalness: 0.05, flatShading: true });
  const wood = new MeshStandardMaterial({ color: 0xe7c897, roughness: 0.75, flatShading: true });
  const lead = new MeshStandardMaterial({ color: 0x23262e, roughness: 0.4, flatShading: true });
  const metal = new MeshStandardMaterial({ color: 0xc4cad4, roughness: 0.28, metalness: 1 });
  const rubber = new MeshStandardMaterial({ color: 0xf08aa0, roughness: 0.9 });
  const add = (geo, mat, x) => { const m = new Mesh(geo, mat); m.rotation.z = -Math.PI / 2; m.position.x = x; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const Rb = R / Math.cos(Math.PI / 6);   // altıgenin köşe yarıçapı
  add(new CylinderGeometry(Rb, Rb, 3.1, 6), body, 0);
  const tipLen = 0.78; const tip = add(new ConeGeometry(Rb, tipLen, 6), wood, -(1.55 + tipLen / 2 - 0.0005));
  const lt = add(new ConeGeometry(Rb * 0.3, tipLen * 0.3, 6), lead, -(1.55 + tipLen - tipLen * 0.15)); void tip; void lt;
  add(new CylinderGeometry(R * 1.04, R * 1.04, 0.42, 28), metal, 1.55 + 0.21);
  for (const dx of [0.08, 0.21, 0.34]) { const t = new Mesh(new TorusGeometry(R * 1.05, 0.012, 8, 32), metal); t.rotation.y = Math.PI / 2; t.position.x = 1.55 + dx; g.add(t); }
  add(new CylinderGeometry(R * 0.98, R * 0.98, 0.3, 28), rubber, 1.97 + 0.15);
  const cap = new Mesh(new SphereGeometry(R * 0.98, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), rubber); cap.rotation.z = -Math.PI / 2; cap.position.x = 1.97 + 0.3; cap.castShadow = true; g.add(cap);
  return g;
}

function makeSheet(r) {
  const geo = new PlaneGeometry(2.2, 3.1, 28, 40);
  const mat = new MeshStandardMaterial({ map: sheetTexture(r), roughness: 0.82, side: DoubleSide });
  const m = new Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
  m.userData.base = Float32Array.from(geo.attributes.position.array);
  return m;
}

/* ---- Montaj ---- */
export function mountScene(container, { reduced = false } = {}) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const el = renderer.domElement; el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .6s'; el.setAttribute('aria-hidden', 'true');
  container.appendChild(el);

  const scene = new Scene();
  const pm = new PMREMGenerator(renderer); const envRT = pm.fromScene(new RoomEnvironment(), 0.04); scene.environment = envRT.texture; scene.environmentIntensity = 0.28; pm.dispose();
  scene.add(new HemisphereLight(0xd6f5ea, 0x07151a, 0.3));
  const key = new DirectionalLight(0xfff1de, 1.9); key.position.set(4.5, 8, 5.5); key.castShadow = true;
  key.shadow.radius = 5; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 24 }); scene.add(key);
  // kalite yöneticisi: cihaza göre başlangıç + kare süresi uzarsa düşürme (gölge/çözünürlük)
  const gov = governor(renderer, key, { onChange: () => { resize(); scene.traverse((o) => { [].concat(o.material || []).forEach((m) => { m.needsUpdate = true; }); }); } });
  const rim = new DirectionalLight(0x22d3ee, 1.5); rim.position.set(-6, 3.5, -5); scene.add(rim);
  const fill = new DirectionalLight(0x10b981, 0.5); fill.position.set(-4, 1.5, 6); scene.add(fill);

  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  const world = new Group(); scene.add(world);

  // zemin: gölgeyi yakalar + marka renginde yumuşak ışıma
  const ground = new Mesh(new PlaneGeometry(40, 40), new ShadowMaterial({ opacity: 0.5, color: 0x000000 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const glow = new Mesh(new CircleGeometry(3.1, 48), new MeshBasicMaterial({ map: glowTexture(renderer), transparent: true, opacity: 0.42, blending: AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.004; scene.add(glow);

  // kitaplar (alttan üste)
  const defs = [
    { w: 3.1, h: 0.58, d: 2.2, color: 0x0f9d74, ink: '#e9fff7', title: 'TYT', sub: 'Deneme Kitabı', rot: 0.02 },
    { w: 2.8, h: 0.46, d: 1.98, color: 0x2a6f97, ink: '#eaf5fb', title: 'AYT', sub: 'Deneme Kitabı', rot: 0.26 },
    { w: 2.5, h: 0.4, d: 1.78, color: 0xd98e2b, ink: '#2b1b05', title: 'DGS', sub: 'Soru Bankası', rot: -0.2 },
  ];
  let y = 0; const books = defs.map((d) => { const b = makeBook(renderer, d); const rest = y + d.h / 2; b.position.y = rest; b.rotation.y = d.rot; y += d.h; b.userData.rest = rest; world.add(b); return b; });
  const topY = y;

  const pencil = new Group(), pencilRestY = topY + 0.1; pencil.position.set(-0.1, pencilRestY, 0.18); pencil.rotation.y = -0.5; pencil.visible = false; world.add(pencil);
  // kalem: Blender modeli (src/assets/models/pencil.glb), yüklenince gruba eklenir; uç orijinde olduğu için ortalanır
  makeLoader().loadAsync(new URL('../assets/models/pencil.glb', import.meta.url).href).then((g) => {
    if (disposed) return; const m = g.scene; m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    m.scale.setScalar(0.95); m.position.x = -2.135 * 0.95; m.rotation.x = Math.PI / 6; pencil.add(m);
  }).catch((e) => console.error('[Scene3D] kalem modeli', e));
  const sheet = makeSheet(renderer); const sheetRest = { x: 1.75, y: 1.8, z: -0.7 }; sheet.position.set(sheetRest.x, sheetRest.y, sheetRest.z); sheet.rotation.set(0, 0.22, 0.04); world.add(sheet);

  // süzülen balonlar (cevap kâğıdı baloncukları)
  const bubbleMats = [0x10b981, 0x22d3ee, 0x34d399, 0xfbbf24].map((c) => new MeshPhysicalMaterial({ color: c, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, emissive: c, emissiveIntensity: 0.18 }));
  const bubbles = Array.from({ length: 11 }, (_, i) => {
    const m = new Mesh(new SphereGeometry(0.05 + (i % 4) * 0.028, 24, 16), bubbleMats[i % 4]);
    const a = (i / 11) * Math.PI * 2 + (i % 3) * 0.4, rad = 2.7 + (i % 5) * 0.3;
    m.userData = { a, rad, y: 0.9 + ((i * 37) % 23) / 8, ph: i * 0.9, sp: 0.18 + (i % 4) * 0.05 }; world.add(m); return m;
  });

  // boyut / çerçeve
  const resize = () => {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight); renderer.setSize(w, h, false);
    const aspect = w / h; camera.aspect = aspect; const dist = Math.max(9.4, 11.4 / aspect);
    camera.position.set(0.4, 5.0 + (dist - 9.4) * 0.1, dist); camera.lookAt(0.55, 1.15, 0); camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  // girdi
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => { mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2; mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2; };
  if (!reduced && matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', onMove, { passive: true });

  const clock = new Clock(); let raf = 0, visible = true, started = false, disposed = false;
  const hero = document.querySelector('[data-hero]');

  let lastT = performance.now();
  const frame = () => {
    if (disposed) return;
    const nowT = performance.now(); gov.tick(nowT - lastT); lastT = nowT;
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime; const k = reduced ? 99 : t;   // reduced: son poz
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3); mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);
    const sc = hero ? clamp01(window.scrollY / Math.max(1, hero.offsetHeight)) : 0;

    // açılış
    books.forEach((b, i) => { const p = easeOutBounce(seg(k, 0.25 + i * 0.16, 1.15)); b.position.y = b.userData.rest + (1 - p) * 7; b.visible = k > 0.25 + i * 0.16; });
    const pp = seg(k, 0.95, 1.2); pencil.visible = pp > 0;
    pencil.position.y = pencilRestY + (1 - easeOutBounce(pp)) * 6 + (reduced ? 0 : Math.sin(t * 1.4) * 0.012);
    pencil.rotation.z = (1 - easeOutCubic(pp)) * 1.1; pencil.rotation.x = (1 - easeOutCubic(pp)) * 2.4;
    const sp = easeOutBack(seg(k, 1.15, 1.1)); sheet.visible = sp > 0.001; sheet.scale.setScalar(Math.max(0.001, sp));
    sheet.position.set(sheetRest.x, sheetRest.y + (reduced ? 0 : Math.sin(t * 0.9) * 0.07) - (1 - sp) * 0.8, sheetRest.z);
    sheet.rotation.z = 0.04 + (reduced ? 0 : Math.sin(t * 0.7) * 0.015);

    // kâğıt hafif kıvrılır + dalgalanır
    const pos = sheet.geometry.attributes.position, base = sheet.userData.base;
    for (let i = 0; i < pos.count; i++) { const x = base[i * 3], yy = base[i * 3 + 1]; pos.setZ(i, Math.sin((yy + 1.55) * 1.1) * 0.07 + (x + 1.1) ** 2 * 0.035 + (reduced ? 0 : Math.sin(t * 1.3 + yy * 1.8) * 0.012 * (1 - (yy + 1.55) / 3.1 + 0.3))); }
    pos.needsUpdate = true; sheet.geometry.computeVertexNormals();

    // balonlar
    bubbles.forEach((m) => { const u = m.userData, a = u.a + (reduced ? 0 : t * u.sp * 0.5), s = easeOutBack(seg(k, 1.5 + u.ph * 0.05, 0.8));
      m.position.set(Math.cos(a) * u.rad, u.y + (reduced ? 0 : Math.sin(t * 0.8 + u.ph) * 0.22), Math.sin(a) * u.rad * 0.55); m.scale.setScalar(Math.max(0.001, s)); m.visible = s > 0.001; });

    // dünya: kaydırma ve fareyle dönüş, yavaş nefes
    world.rotation.y = -0.55 + sc * 1.1 + mouse.x * 0.28 + (reduced ? 0 : Math.sin(t * 0.28) * 0.12);
    world.rotation.x = mouse.y * 0.05; world.position.y = -sc * 0.6;
    glow.material.opacity = 0.34 + (reduced ? 0 : Math.sin(t * 1.2) * 0.05);

    renderer.render(scene, camera);
    if (!started) { started = true; el.style.opacity = '1'; }
    if (!reduced && visible) raf = requestAnimationFrame(frame);
  };

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf && !reduced) { clock.getDelta(); lastT = performance.now(); raf = requestAnimationFrame(frame); } if (!visible) { cancelAnimationFrame(raf); raf = 0; } }, { threshold: 0 });
  io.observe(container);
  raf = requestAnimationFrame(frame);
  // reduced: bir kare yeter; yeniden boyutlanınca tekrar çiz
  const redraw = reduced ? new ResizeObserver(() => { if (!disposed) frame(); }) : null; redraw?.observe(container);

  return () => {
    disposed = true; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); redraw?.disconnect(); window.removeEventListener('pointermove', onMove);
    scene.traverse((o) => { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
    envRT.dispose(); renderer.dispose(); renderer.forceContextLoss?.(); el.remove();
  };
}

export function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
