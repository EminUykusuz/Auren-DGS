// Kaydırmayla oynayan 3B hikâye (Story.jsx içinde GSAP zaman çizelgesi bu dosyadaki `state`i sürer).
// Sahne: deneme defteri açılır, sayfalara yazı yazılır ve çevrilir → kalem optik formu doldurur → form, net grafiğine dönüşür.
// Koordinat: y yukarı, masa y=0; defter/form masanın üstünde yatar.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Vector3, Euler, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap,
  HemisphereLight, DirectionalLight, PMREMGenerator, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, ShadowMaterial,
  PlaneGeometry, CylinderGeometry, CircleGeometry, SpriteMaterial, Sprite, AdditiveBlending, DoubleSide,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { governor } from './perf.js';
import { canvasTex, makePencil, pagesTexture, glowTexture, coverTexture } from './scene-gl.js';

const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);   // easeInOutCubic
const easeOut = (x) => 1 - (1 - x) ** 3;

/* ---- Sayfa dokuları (768×1024; üst = masanın uzak ucu) ---- */
const PAGE_BG = '#f6f0e2', INK = '#1d2a2e', ACC = '#0f9d74';
function pageBase(g, w, h) { g.fillStyle = PAGE_BG; g.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }
const wrap = (g, text, x, y, maxW, lh) => { let line = ''; for (const word of text.split(' ')) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); line = word; y += lh; } else line = t; } if (line) g.fillText(line, x, y); return y; };
function bars(g, x, y, w, items, color) { items.forEach(([name, v, max], i) => { const yy = y + i * 92; g.fillStyle = INK; g.font = `600 30px ${FONT}`; g.textAlign = 'left'; g.fillText(name, x, yy); g.fillStyle = 'rgba(0,0,0,.09)'; g.fillRect(x, yy + 18, w, 22); g.fillStyle = color; g.fillRect(x, yy + 18, w * (v / max), 22); g.fillStyle = INK; g.textAlign = 'right'; g.fillText(String(v) + (max === 100 ? '%' : ''), x + w, yy); }); }

const TYPED = 'Matematikte 6 yanlışın 4’ü dikkatsizlik. Bu hafta işlem hatalarına odaklan; iki gün sonra konu tekrarın hazır.';
function drawTyped(g, n) {
  pageBase(g, 768, 1024);
  g.fillStyle = ACC; g.font = `800 40px ${FONT}`; g.textAlign = 'left'; g.fillText('TYT · DENEME 4', 64, 110);
  g.fillStyle = INK; g.font = `800 150px ${FONT}`; g.fillText('62,5', 58, 290); g.font = `600 34px ${FONT}`; g.globalAlpha = 0.6; g.fillText('net', 64, 340); g.globalAlpha = 1;
  g.fillStyle = INK; g.font = `500 36px ${FONT}`; const t = TYPED.slice(0, n); wrap(g, t + (n < TYPED.length && n > 0 ? '▍' : ''), 64, 470, 640, 54);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.font = `600 26px ${FONT}`; g.textAlign = 'right'; g.fillText('1', 704, 972);
}
const pageReasons = (g) => { pageBase(g, 768, 1024); g.fillStyle = INK; g.font = `800 52px ${FONT}`; g.textAlign = 'left'; g.fillText('Yanlışların', 64, 120); g.font = `500 30px ${FONT}`; g.globalAlpha = 0.65; g.fillText('nedenlerine göre', 64, 168); g.globalAlpha = 1; bars(g, 64, 290, 640, [['Bilgi eksiği', 9, 12], ['Dikkatsizlik', 6, 12], ['Süre yetmedi', 3, 12]], '#d9534f'); g.fillStyle = 'rgba(0,0,0,.35)'; g.font = `600 26px ${FONT}`; g.textAlign = 'left'; g.fillText('2', 64, 972); };
const pageStrength = (g) => { pageBase(g, 768, 1024); g.fillStyle = INK; g.font = `800 52px ${FONT}`; g.textAlign = 'left'; g.fillText('Konu gücü', 64, 120); g.font = `500 30px ${FONT}`; g.globalAlpha = 0.65; g.fillText('aralıklı tekrarla', 64, 168); g.globalAlpha = 1; bars(g, 64, 290, 640, [['Matematik', 72, 100], ['Türkçe', 58, 100], ['Fen Bilimleri', 41, 100]], ACC); g.fillStyle = 'rgba(0,0,0,.35)'; g.font = `600 26px ${FONT}`; g.textAlign = 'right'; g.fillText('3', 704, 972); };
const pagePlan = (g) => { pageBase(g, 768, 1024); g.fillStyle = INK; g.font = `800 52px ${FONT}`; g.textAlign = 'left'; g.fillText('Bu hafta', 64, 120); g.fillStyle = ACC; g.font = `800 180px ${FONT}`; g.fillText('63', 58, 330); g.fillStyle = INK; g.font = `500 36px ${FONT}`; g.fillText('soru hedefi', 64, 390); g.fillText('Pzt · Çar · Cum', 64, 470); g.globalAlpha = 0.6; g.fillText('Matematik tekrarı', 64, 520); g.globalAlpha = 1; };
const pageBlank = (g) => { pageBase(g, 768, 1024); g.fillStyle = 'rgba(0,0,0,.35)'; g.font = `600 26px ${FONT}`; g.textAlign = 'left'; g.fillText('4', 64, 972); };
const endpaper = (g) => { pageBase(g, 768, 1024); g.fillStyle = '#0f9d74'; g.fillRect(0, 0, 768, 1024); g.fillStyle = '#eafff7'; g.textAlign = 'center'; g.font = `800 96px ${FONT}`; g.fillText('Auren', 384, 470); g.fillText('Study', 384, 580); g.font = `600 34px ${FONT}`; g.globalAlpha = 0.85; g.fillText('DGS · YKS · LGS', 384, 660); g.globalAlpha = 1; };

/* ---- Optik form (yatay yatan, canlı dolan) ---- */
const SW = 1100, SH = 1550, ROWS = 20, X0 = 230, DX = 150, Y0 = 230, DY = 62;
const ANSWERS = [[0, 1], [1, 3], [2, 0], [3, 4], [4, 2], [5, 1], [6, 3], [7, 0], [8, 4], [9, 2], [10, 1], [11, 3]];   // doldurma sırası (satır, şık)
const cellXY = (r, c) => [X0 + c * DX, Y0 + r * DY];
function drawSheet(g, nFilled) {
  g.fillStyle = '#fbf5f7'; g.fillRect(0, 0, SW, SH); g.fillStyle = '#c43b5b'; g.fillRect(0, 0, SW, 150);
  g.fillStyle = '#fff'; g.font = `800 54px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('CEVAP FORMU', 60, 66); g.font = `600 28px ${FONT}`; g.globalAlpha = 0.85; g.fillText('TYT · AYT · DGS', 60, 114); g.globalAlpha = 1;
  const filled = new Map(ANSWERS.slice(0, Math.floor(nFilled)).map(([r, c]) => [r, c]));
  for (let r = 0; r < ROWS; r++) {
    const y = Y0 + r * DY; if (r % 2 === 0) { g.fillStyle = '#f5dce3'; g.fillRect(36, y - 28, SW - 72, 56); }
    g.fillStyle = '#a82a4a'; g.font = `700 28px ${FONT}`; g.textAlign = 'right'; g.fillText(String(r + 1), 150, y + 1);
    for (let c = 0; c < 5; c++) { const [x] = cellXY(r, c); g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); if (filled.get(r) === c) { g.fillStyle = '#16343b'; g.fill(); } else { g.lineWidth = 4; g.strokeStyle = '#a82a4a'; g.stroke(); g.fillStyle = '#a82a4a'; g.font = `600 22px ${FONT}`; g.textAlign = 'center'; g.fillText('ABCDE'[c], x, y + 1); } }
  }
}

const label = (r, text, w = 512, h = 192, color = '#eafff7') => { const t = canvasTex(w, h, (g) => { g.font = `800 120px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, w / 2, h / 2); }, r); const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(1.6, 0.6, 1); return s; };

export function mountStory(container) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const el = renderer.domElement; el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; el.setAttribute('aria-hidden', 'true'); container.appendChild(el);

  const scene = new Scene();
  const pm = new PMREMGenerator(renderer); const envRT = pm.fromScene(new RoomEnvironment(), 0.04); scene.environment = envRT.texture; scene.environmentIntensity = 0.3; pm.dispose();
  scene.add(new HemisphereLight(0xd6f5ea, 0x07151a, 0.3));
  const key = new DirectionalLight(0xfff1de, 2.0); key.position.set(3, 9, 5); key.castShadow = true; key.shadow.radius = 5; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 }); scene.add(key);
  const gov = governor(renderer, key, { onChange: () => { resize(); scene.traverse((o) => { [].concat(o.material || []).forEach((m) => { m.needsUpdate = true; }); }); render(last); } });
  const rim = new DirectionalLight(0x22d3ee, 1.4); rim.position.set(-6, 3, -5); scene.add(rim);
  const camera = new PerspectiveCamera(32, 1, 0.1, 80);

  const ground = new Mesh(new PlaneGeometry(60, 60), new ShadowMaterial({ opacity: 0.55 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const glow = new Mesh(new CircleGeometry(5.2, 48), new MeshBasicMaterial({ map: glowTexture(renderer), transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.004; scene.add(glow);

  /* ----- Defter ----- */
  const W = 3.0, D = 4.0, T = 0.5, book = new Group(); scene.add(book); book.position.set(-W / 2, 0, 0);   // omurga x=0 (grup içinde)
  const coverMat = new MeshPhysicalMaterial({ color: 0x0f9d74, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const add = (parent, geo, mat, x, y, z) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  add(book, new RoundedBoxGeometry(W + 0.12, 0.07, D + 0.12, 3, 0.025), coverMat, W / 2 + 0.04, 0.035, 0);                              // arka kapak
  add(book, new RoundedBoxGeometry(0.12, T + 0.14, D + 0.12, 3, 0.04), coverMat, -0.04, (T + 0.14) / 2, 0);                                // omurga
  add(book, new RoundedBoxGeometry(W - 0.02, T - 0.06, D - 0.04, 3, 0.02), new MeshStandardMaterial({ map: pagesTexture(renderer), roughness: 0.9 }), W / 2, 0.07 + (T - 0.06) / 2, 0); // sayfa bloğu
  const leftStack = add(book, new RoundedBoxGeometry(W - 0.02, 1, D - 0.04, 3, 0.02), new MeshStandardMaterial({ map: pagesTexture(renderer), roughness: 0.9 }), -W / 2, 0.5, 0); leftStack.visible = false;
  const leftBack = add(book, new RoundedBoxGeometry(W + 0.12, 0.07, D + 0.12, 3, 0.025), coverMat, -W / 2 - 0.04, 0.035, 0); leftBack.visible = false;

  const coverPivot = new Group(); book.add(coverPivot);
  add(coverPivot, new RoundedBoxGeometry(W + 0.12, 0.07, D + 0.12, 3, 0.025), coverMat, W / 2 + 0.04, 0, 0);
  const top = new Mesh(new PlaneGeometry(W + 0.06, D + 0.06), new MeshStandardMaterial({ map: coverTexture(renderer, { bg: '#0f9d74', ink: '#eafff7', title: 'TYT', sub: 'Deneme Defteri' }), roughness: 0.55 })); top.rotation.x = -Math.PI / 2; top.position.set(W / 2 + 0.04, 0.0365, 0); coverPivot.add(top);
  const inner = new Mesh(new PlaneGeometry(W + 0.06, D + 0.06), new MeshStandardMaterial({ map: canvasTex(768, 1024, endpaper, renderer), roughness: 0.7 })); inner.rotation.set(Math.PI / 2, 0, Math.PI); inner.position.set(W / 2 + 0.04, -0.0365, 0); coverPivot.add(inner);

  // sayfalar: her biri omurgadan menteşeli, ön yüz yukarı bakar; arka yüz çevrilince görünür
  const typedCtx = (() => { const c = document.createElement('canvas'); c.width = 768; c.height = 1024; return c.getContext('2d'); })(); drawTyped(typedCtx, 0);
  const typedTex = canvasTex(768, 1024, () => {}, renderer); typedTex.image = typedCtx.canvas; typedTex.needsUpdate = true;
  const mk = (draw) => canvasTex(768, 1024, draw, renderer);
  const mirror = (t) => { t.wrapS = 1000; t.repeat.x = -1; t.offset.x = 1; return t; };   // arka yüz: ayna yazı çevrilince düzelir
  const defs = [{ front: typedTex, back: mk(pageReasons) }, { front: mk(pageStrength), back: mk(pagePlan) }, { front: mk(pageBlank), back: mk(pageBlank) }];
  const pages = defs.map((d, i) => {
    const pv = new Group(); book.add(pv);
    const mat = (map) => new MeshStandardMaterial({ map, roughness: 0.88 });
    const f = new Mesh(new PlaneGeometry(W - 0.04, D - 0.06), mat(d.front)); f.rotation.x = -Math.PI / 2; f.position.set(W / 2, 0.0015, 0); f.receiveShadow = true; f.castShadow = true;
    const b = new Mesh(new PlaneGeometry(W - 0.04, D - 0.06), mat(d.back)); b.rotation.set(Math.PI / 2, 0, Math.PI); b.position.set(W / 2, -0.0015, 0); b.receiveShadow = true;
    pv.add(f, b); return pv;
  });
  const bookTop = 0.07 + (T - 0.06);

  /* ----- Optik form + kalem ----- */
  const sheetCtx = (() => { const c = document.createElement('canvas'); c.width = SW; c.height = SH; return c.getContext('2d'); })(); drawSheet(sheetCtx, 0);
  const sheetTex = canvasTex(SW, SH, () => {}, renderer); sheetTex.image = sheetCtx.canvas; sheetTex.needsUpdate = true;
  const SHW = 2.6, SHD = SHW * (SH / SW), sheet = new Mesh(new PlaneGeometry(SHW, SHD), new MeshStandardMaterial({ map: sheetTex, roughness: 0.85, side: DoubleSide, transparent: true }));
  sheet.rotation.x = -Math.PI / 2; sheet.position.set(8, 0.02, 0); sheet.receiveShadow = true; sheet.castShadow = true; scene.add(sheet);
  const pencil = makePencil(); pencil.scale.setScalar(0.62); scene.add(pencil);
  const tipLocal = new Vector3(-(1.55 + 0.78) * 0.62, 0, 0);
  const bubbleXY = (r, c) => { const [px, py] = cellXY(r, c); return [(px / SW - 0.5) * SHW, (py / SH - 0.5) * SHD]; };

  /* ----- Net grafiği ----- */
  const chart = new Group(); scene.add(chart);
  const VALS = [62.5, 68, 71.25, 74.5, 78.5], barMats = VALS.map((_, i) => new MeshPhysicalMaterial({ color: i === 4 ? 0x10d99a : 0x0f7a62, roughness: 0.3, clearcoat: 0.6, emissive: i === 4 ? 0x0a8f66 : 0x041a14, emissiveIntensity: i === 4 ? 0.5 : 0.2 }));
  const barH = VALS.map((v) => (v - 50) * 0.085), barGeo = new RoundedBoxGeometry(0.62, 1, 0.62, 4, 0.08);
  const barMeshes = VALS.map((v, i) => { const m = new Mesh(barGeo, barMats[i]); m.position.x = (i - 2) * 0.95; m.castShadow = true; m.receiveShadow = true; chart.add(m); return m; });
  const plate = new Mesh(new CylinderGeometry(3.1, 3.2, 0.12, 64), new MeshPhysicalMaterial({ color: 0x0c2a2b, roughness: 0.35, metalness: 0.4, clearcoat: 0.5 })); plate.position.y = 0.06; plate.receiveShadow = true; plate.castShadow = true; chart.add(plate);
  const labels = VALS.map((v, i) => { const s = label(renderer, String(v).replace('.', ','), 512, 192, i === 4 ? '#7dffd2' : '#cfeee3'); s.scale.set(0.95, 0.36, 1); s.position.x = (i - 2) * 0.95; chart.add(s); return s; });
  const badge = label(renderer, '+16,0 net', 768, 192, '#7dffd2'); badge.scale.set(2.2, 0.55, 1); chart.add(badge);
  chart.position.x = 0; chart.visible = false;

  const resize = () => { const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; if (w > 1000) camera.setViewOffset(w, h, -w * 0.2, 0, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(() => { resize(); render(last); }); ro.observe(container); resize();

  // sahne durumu → nesneler (state: GSAP'in tweenlediği sayılar, hepsi 0..1)
  let last = { intro: 0, open: 0, type: 0, flip1: 0, flip2: 0, s1: 0, fill: 0, s2: 0, bars: 0 }, typedN = -1, filledN = -1;
  const e = new Euler(), tipW = new Vector3(), P = new Vector3();
  function render(s, now = 0) {
    last = s; const t = now / 1000;
    const aspect = camera.aspect, wide = Math.max(1.12, 0.95 / aspect);   // dar ekranda kamera geri çekilir

    // defter
    const open = ease(s.open), intro = easeOut(s.intro);
    book.position.set(-W / 2 - ease(s.s1) * 16, lerp(2.4, 0, intro) + Math.sin(t * 0.9) * 0.02, lerp(0.8, 0, intro));
    book.rotation.y = lerp(-0.9, -0.05, intro) - ease(s.s1) * 0.4;
    coverPivot.rotation.z = open * Math.PI * 0.992; coverPivot.position.y = lerp(bookTop + 0.035, 0.5 * 0.5 + 0.075, open);
    leftStack.visible = leftBack.visible = open > 0.35; leftStack.scale.y = 0.25; leftStack.position.y = 0.07 + 0.125;
    [s.flip1, s.flip2, 0].forEach((f, i) => { const k = ease(f); pages[i].rotation.z = k * Math.PI * 0.992; pages[i].position.y = lerp(bookTop + 0.004 * (3 - i), 0.07 + 0.25 + 0.004 * (i + 1), k); });
    const n = Math.floor(clamp01(s.type) * TYPED.length); if (n !== typedN) { typedN = n; drawTyped(typedCtx, n); typedTex.needsUpdate = true; }

    // form + kalem
    sheet.position.x = lerp(8, 0, ease(s.s1)) - ease(s.s2) * 9; sheet.position.z = 0.1; sheet.rotation.z = Math.sin(t * 0.6) * 0.004;
    const nf = clamp01(s.fill) * (ANSWERS.length + 0.001); const fn = Math.floor(nf); if (fn !== filledN) { filledN = fn; drawSheet(sheetCtx, fn); sheetTex.needsUpdate = true; }
    const idx = Math.min(ANSWERS.length - 1, fn), a = ANSWERS[idx], b = ANSWERS[Math.min(ANSWERS.length - 1, idx + 1)], fr = nf - fn;
    const [ax, az] = bubbleXY(a[0], a[1]), [bx, bz] = bubbleXY(b[0], b[1]);
    const pr = s.fill > 0 && s.fill < 1;
    const hover = pr ? 0.02 + Math.sin(fr * Math.PI) * 0.22 : 0.9;
    P.set(sheet.position.x + lerp(ax, bx, ease(fr)), 0.04 + hover, sheet.position.z + lerp(az, bz, ease(fr)));
    e.set(0, 0.55, 0.95); pencil.rotation.copy(e); tipW.copy(tipLocal).applyEuler(e); pencil.position.copy(P).sub(tipW);
    if (s.fill <= 0) pencil.position.set(sheet.position.x + 1.1, 1.8, sheet.position.z - 0.4);
    pencil.visible = ease(s.s1) > 0.02 && s.s2 < 0.98;
    sheet.visible = sheet.position.x < 7.9 && s.s2 < 0.98;

    // grafik
    chart.visible = s.s2 > 0.02; chart.position.y = lerp(-1.4, 0, easeOut(clamp01(s.s2 * 1.6)));
    barMeshes.forEach((m, i) => { const k = easeOut(clamp01(s.bars * 1.35 - i * 0.12)); const h = Math.max(0.001, barH[i] * k); m.scale.y = h; m.position.y = 0.12 + h / 2; labels[i].position.y = 0.12 + h + 0.38; labels[i].material.opacity = clamp01(k * 1.4 - 0.4); });
    badge.position.set(0.2, 0.12 + barH[4] + 1.05, 0); badge.material.opacity = clamp01((s.bars - 0.7) * 3.3);
    chart.rotation.y = lerp(-0.7, -0.15, ease(s.bars)) + Math.sin(t * 0.4) * 0.05;

    // kamera: defter → form (yukarıdan) → grafik
    const wideA = Math.max(wide, 1.45 / aspect), A = [aspect < 1 ? -0.6 : 0.4, 6.4 * wideA, 7.4 * wideA, aspect < 1 ? -0.6 : 0, 0.2, 0], B = [0, 8.6 * wide, 5.4 * wide, 0, 0, 0.2], C = [0.3, 5.8 * wide, 11.8 * wide, 0, 1.3, 0];
    const k1 = ease(s.s1), k2 = ease(s.s2); const m = (i) => lerp(lerp(A[i], B[i], k1), C[i], k2);
    camera.position.set(m(0), m(1), m(2)); camera.lookAt(m(3), m(4), m(5));
    glow.position.x = 0; glow.material.opacity = 0.32 + Math.sin(t * 1.1) * 0.04;
    renderer.render(scene, camera);
  }

  return {
    render, resize,
    dispose() {
      ro.disconnect(); scene.traverse((o) => { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
      envRT.dispose(); renderer.dispose(); renderer.forceContextLoss?.(); el.remove();
    },
  };
}
