// Kaydırmayla oynayan 3B hikâye (Story.jsx içinde GSAP zaman çizelgesi bu dosyadaki `state`i sürer).
// Sahne: deneme defteri açılır, sayfaya yazı yazılır ve sayfalar çevrilir → kalem optik formu doldurur → form, net grafiğine dönüşür.
// Defter ve kalem Blender'da modellendi (src/assets/models/*.glb, kaynak: tools/blender). Koordinat: y yukarı, masa y=0.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Vector3, Euler, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap,
  HemisphereLight, DirectionalLight, PMREMGenerator, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, ShadowMaterial,
  PlaneGeometry, CylinderGeometry, CircleGeometry, SpriteMaterial, Sprite, AdditiveBlending, BufferGeometry, BufferAttribute,
} from 'three';
import { makeLoader } from './models.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { governor } from './perf.js';
import { canvasTex, glowTexture } from './scene-gl.js';

const BOOK_URL = new URL('../assets/models/book.glb', import.meta.url).href;
const PENCIL_URL = new URL('../assets/models/pencil.glb', import.meta.url).href;

const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);   // easeInOutCubic
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };

/* ---- Sayfa dokuları (768×1024; üst = masanın uzak ucu). Hepsi YALNIZ BİR KEZ çizilir; yazı animasyonunda sadece hazır katman kopyalanır ---- */
const PW = 768, PH = 1024, PAGE_BG = '#f6f0e2', INK = '#1d2a2e', ACC = '#0f9d74';
function pageBase(g) { g.fillStyle = PAGE_BG; g.fillRect(0, 0, PW, PH); for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`; g.fillRect(Math.random() * PW, Math.random() * PH, 2, 2); } }
function bars(g, x, y, w, items, color) { items.forEach(([name, v, max], i) => { const yy = y + i * 108; g.fillStyle = INK; g.font = `600 40px ${FONT}`; g.textAlign = 'left'; g.fillText(name, x, yy); g.fillStyle = 'rgba(0,0,0,.09)'; g.fillRect(x, yy + 20, w, 28); g.fillStyle = color; g.fillRect(x, yy + 20, w * (v / max), 28); g.fillStyle = INK; g.textAlign = 'right'; g.fillText(String(v) + (max === 100 ? '%' : ''), x + w, yy); }); }
const folio = (g, n, right) => { g.fillStyle = 'rgba(0,0,0,.35)'; g.font = `600 26px ${FONT}`; g.textAlign = right ? 'right' : 'left'; g.fillText(String(n), right ? 704 : 64, 972); };

const TYPED = 'Matematikte 6 yanlışın 4’ü dikkatsizlik. Bu hafta işlem hatalarına odaklan; iki gün sonra konu tekrarın hazır.';
function drawTypedBase(g) {
  pageBase(g);
  g.fillStyle = ACC; g.font = `800 48px ${FONT}`; g.textAlign = 'left'; g.fillText('TYT · DENEME 4', 64, 115);
  g.fillStyle = INK; g.font = `800 190px ${FONT}`; g.fillText('62,5', 58, 320); g.font = `600 44px ${FONT}`; g.globalAlpha = 0.6; g.fillText('net', 64, 380); g.globalAlpha = 1;
  folio(g, 1, true);
}
function wrapLines(g, text, maxW) { g.font = `500 46px ${FONT}`; const out = []; let line = ''; for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
const pageReasons = (g) => { pageBase(g); g.fillStyle = INK; g.font = `800 62px ${FONT}`; g.textAlign = 'left'; g.fillText('Yanlışların', 64, 120); g.font = `500 38px ${FONT}`; g.globalAlpha = 0.65; g.fillText('nedenlerine göre', 64, 178); g.globalAlpha = 1; bars(g, 64, 320, 640, [['Bilgi eksiği', 9, 12], ['Dikkatsizlik', 6, 12], ['Süre yetmedi', 3, 12]], '#d9534f'); folio(g, 2, false); };
const pageStrength = (g) => { pageBase(g); g.fillStyle = INK; g.font = `800 62px ${FONT}`; g.textAlign = 'left'; g.fillText('Konu gücü', 64, 120); g.font = `500 38px ${FONT}`; g.globalAlpha = 0.65; g.fillText('aralıklı tekrarla', 64, 178); g.globalAlpha = 1; bars(g, 64, 320, 640, [['Matematik', 72, 100], ['Türkçe', 58, 100], ['Fen Bilimleri', 41, 100]], ACC); folio(g, 3, true); };
const pagePlan = (g) => { pageBase(g); g.fillStyle = INK; g.font = `800 62px ${FONT}`; g.textAlign = 'left'; g.fillText('Bu hafta', 64, 120); g.fillStyle = ACC; g.font = `800 180px ${FONT}`; g.fillText('63', 58, 330); g.fillStyle = INK; g.font = `500 46px ${FONT}`; g.fillText('soru hedefi', 64, 405); g.fillText('Pzt · Çar · Cum', 64, 500); g.globalAlpha = 0.6; g.fillText('Matematik tekrarı', 64, 565); g.globalAlpha = 1; folio(g, 4, false); };
const pageBlank = (g) => { pageBase(g); folio(g, 5, true); };

/* ---- Optik form (tek seferlik çizim; işaretler 3B daireler) ---- */
const SW = 1100, SH = 1550, ROWS = 20, X0 = 230, DX = 150, Y0 = 230, DY = 62;
const ANSWERS = [[0, 1], [1, 3], [2, 0], [3, 4], [4, 2], [5, 1], [6, 3], [7, 0], [8, 4], [9, 2], [10, 1], [11, 3]];   // doldurma sırası (satır, şık)
const cellXY = (r, c) => [X0 + c * DX, Y0 + r * DY];
function drawSheet(g) {
  g.fillStyle = '#fbf5f7'; g.fillRect(0, 0, SW, SH); g.fillStyle = '#c43b5b'; g.fillRect(0, 0, SW, 150);
  g.fillStyle = '#fff'; g.font = `800 54px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('CEVAP FORMU', 60, 66); g.font = `600 28px ${FONT}`; g.globalAlpha = 0.85; g.fillText('TYT · AYT · DGS', 60, 114); g.globalAlpha = 1;
  for (let r = 0; r < ROWS; r++) {
    const y = Y0 + r * DY; if (r % 2 === 0) { g.fillStyle = '#f5dce3'; g.fillRect(36, y - 28, SW - 72, 56); }
    g.fillStyle = '#a82a4a'; g.font = `700 28px ${FONT}`; g.textAlign = 'right'; g.fillText(String(r + 1), 150, y + 1);
    for (let c = 0; c < 5; c++) { const [x] = cellXY(r, c); g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = '#a82a4a'; g.stroke(); g.fillStyle = '#a82a4a'; g.font = `600 22px ${FONT}`; g.textAlign = 'center'; g.fillText('ABCDE'[c], x, y + 1); }
  }
}

const label = (r, text, w = 512, h = 192, color = '#eafff7') => { const t = canvasTex(w, h, (g) => { g.font = `800 120px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, w / 2, h / 2); }, r); const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(1.6, 0.6, 1); return s; };

/* ---- Defter geometrisi ölçüleri (Blender ile aynı: tools/blender/book2.py) ---- */
const W = 3.0, D = 4.0, TOP = 0.45, COVER_Y = 0.485, TABLE_COVER_Y = 0.035, COVER_TOP_OPEN = 0.0715;
const PAGE_W = W - 0.06, PAGE_D = D - 0.1, NSEG = 28;
const START_Y = [TOP + 0.007, TOP + 0.0035, TOP + 0.001];
const endY = (i) => COVER_TOP_OPEN + 0.006 + 0.004 * (i + 1) + 0.001;

/* Bükülen sayfa: menteşe x=0; k=0 sağda düz, k=1 solda düz; ortada ucu geride kalarak kıvrılır */
function makePage(frontTex, backTex) {
  const mkGeo = (back) => {
    const g = new BufferGeometry(), n = (NSEG + 1) * 2, uv = new Float32Array(n * 2), idx = [];
    for (let i = 0; i <= NSEG; i++) for (let j = 0; j < 2; j++) { uv[(i * 2 + j) * 2] = back ? 1 - i / NSEG : i / NSEG; uv[(i * 2 + j) * 2 + 1] = j; }
    for (let i = 0; i < NSEG; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; if (back) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('uv', new BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  };
  const mat = (map) => new MeshStandardMaterial({ map, roughness: 0.88 });
  const front = new Mesh(mkGeo(false), mat(frontTex)), back = new Mesh(mkGeo(true), mat(backTex));
  front.castShadow = true; front.receiveShadow = true; back.receiveShadow = true; front.frustumCulled = back.frustumCulled = false;
  const g = new Group(); g.add(front, back);
  let lastK = -1;
  g.userData.pose = (k, y0, y1) => {
    if (Math.abs(k - lastK) < 1e-5) return; lastK = k;
    const th = k * Math.PI, curl = 0.5 * Math.sin(th), ds = PAGE_W / NSEG, hy = lerp(y0, y1, k);
    let x = 0, y = hy;
    for (let i = 0; i <= NSEG; i++) {
      for (const m of [front, back]) { const p = m.geometry.attributes.position; p.setXYZ(i * 2, x, y, PAGE_D / 2); p.setXYZ(i * 2 + 1, x, y, -PAGE_D / 2); }
      const a = th - curl * ((i + 0.5) / NSEG); x += ds * Math.cos(a); y += ds * Math.sin(a);
    }
    for (const m of [front, back]) { m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); }
  };
  return g;
}

function prep(root) { root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return root; }

export async function mountStory(container) {
  const loader = makeLoader();
  const [bookGltf, pencilGltf] = await Promise.all([loader.loadAsync(BOOK_URL), loader.loadAsync(PENCIL_URL)]);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const el = renderer.domElement; el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; el.setAttribute('aria-hidden', 'true'); container.appendChild(el);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new Scene();
  const pm = new PMREMGenerator(renderer); const envRT = pm.fromScene(new RoomEnvironment(), 0.04); scene.environment = envRT.texture; scene.environmentIntensity = 0.4; pm.dispose();
  scene.add(new HemisphereLight(0xd6f5ea, 0x07151a, 0.3));
  const key = new DirectionalLight(0xfff1de, 1.6); key.position.set(3, 9, 5); key.castShadow = true; key.shadow.radius = 5; key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 }); scene.add(key);
  const gov = governor(renderer, key, { onChange: () => { resize(); scene.traverse((o) => { [].concat(o.material || []).forEach((m) => { m.needsUpdate = true; }); }); render(last); } });
  const rim = new DirectionalLight(0x22d3ee, 1.4); rim.position.set(-6, 3, -5); scene.add(rim);
  const camera = new PerspectiveCamera(32, 1, 0.1, 80);

  const ground = new Mesh(new PlaneGeometry(60, 60), new ShadowMaterial({ opacity: 0.55 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const glow = new Mesh(new CircleGeometry(5.2, 48), new MeshBasicMaterial({ map: glowTexture(renderer), transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.004; scene.add(glow);

  /* ----- Defter (Blender modeli) ----- */
  const bookG = new Group(); scene.add(bookG);
  const book = prep(bookGltf.scene); bookG.add(book);
  // Omurga ve altın bantlar: defter açılınca kapakla birlikte alçalır (aksi hâlde sol sayfaların üstünde dik bir duvar gibi kalır)
  const spine = [book.getObjectByName('Spine'), ...[0, 1, 2, 3].map(i => book.getObjectByName('SpineBand' + i))].filter(Boolean).map(o => ({ o, y: o.position.y, sy: o.scale.y }));
  const coverPivot = book.getObjectByName('CoverPivot'), blockMat = book.getObjectByName('Block').material;
  const topPaper = new MeshStandardMaterial({ color: 0xf1ecdd, roughness: 0.9 });
  const leftStack = new Mesh(new RoundedBoxGeometry(W - 0.02, 1, D - 0.07, 2, 0.006), [blockMat, blockMat, topPaper, topPaper, blockMat, blockMat]); leftStack.visible = false; leftStack.position.x = -W / 2; leftStack.receiveShadow = true; leftStack.castShadow = true; bookG.add(leftStack);

  // sayfalar: hepsi bir kez çizilir; yazı animasyonu yalnız hazır katmanı kopyalar
  const tex = (draw) => { const t = canvasTex(PW, PH, draw, renderer); t.anisotropy = aniso; return t; };
  const baseCv = document.createElement('canvas'); baseCv.width = PW; baseCv.height = PH; drawTypedBase(baseCv.getContext('2d'));
  const typedCv = document.createElement('canvas'); typedCv.width = PW; typedCv.height = PH; const tg = typedCv.getContext('2d'); tg.drawImage(baseCv, 0, 0);
  const typedTex = canvasTex(PW, PH, () => {}, renderer); typedTex.image = typedCv; typedTex.anisotropy = aniso; typedTex.needsUpdate = true;
  const lines = wrapLines(tg, TYPED, 636);
  const blank = tex(pageBlank);
  const pages = [makePage(typedTex, tex(pageReasons)), makePage(tex(pageStrength), tex(pagePlan)), makePage(blank, blank)];
  pages.forEach((p) => bookG.add(p));
  pages.forEach((p, i) => p.userData.pose(0, START_Y[i], endY(i)));

  /* ----- Optik form + işaretler + kalem (Blender modeli) ----- */
  const sheetTex = tex(() => {}); sheetTex.image = (() => { const c = document.createElement('canvas'); c.width = SW; c.height = SH; drawSheet(c.getContext('2d')); return c; })(); sheetTex.needsUpdate = true;
  const SHW = 2.6, SHD = SHW * (SH / SW), SHT = 0.014;
  const paperSide = new MeshStandardMaterial({ color: 0xf3e7ea, roughness: 0.9 });
  const sheetG = new Group(); scene.add(sheetG);
  const sheet = new Mesh(new RoundedBoxGeometry(SHW, SHT, SHD, 2, 0.005), [paperSide, paperSide, new MeshStandardMaterial({ map: sheetTex, roughness: 0.82 }), paperSide, paperSide, paperSide]);
  sheet.position.y = SHT / 2; sheet.castShadow = true; sheet.receiveShadow = true; sheetG.add(sheet);
  const bubbleXY = (r, c) => { const [px, py] = cellXY(r, c); return [(px / SW - 0.5) * SHW, (py / SH - 0.5) * SHD]; };
  const markMat = new MeshStandardMaterial({ color: 0x14202a, roughness: 0.3, metalness: 0.45 }), markGeo = new CylinderGeometry(0.056, 0.056, 0.006, 28);
  const marks = ANSWERS.map(([r, c]) => { const [x, z] = bubbleXY(r, c); const m = new Mesh(markGeo, markMat); m.position.set(x, SHT + 0.002, z); m.receiveShadow = true; m.scale.setScalar(0.001); sheetG.add(m); return m; });
  const pencil = prep(pencilGltf.scene); pencil.scale.setScalar(0.46); scene.add(pencil);

  /* ----- Net grafiği ----- */
  const chart = new Group(); scene.add(chart);
  const VALS = [62.5, 68, 71.25, 74.5, 78.5], barMats = VALS.map((_, i) => new MeshPhysicalMaterial({ color: i === 4 ? 0x10d99a : 0x0f7a62, roughness: 0.3, clearcoat: 0.6, emissive: i === 4 ? 0x0a8f66 : 0x041a14, emissiveIntensity: i === 4 ? 0.5 : 0.2 }));
  const barH = VALS.map((v) => (v - 50) * 0.085), barGeo = new RoundedBoxGeometry(0.62, 1, 0.62, 4, 0.08);
  const barMeshes = VALS.map((v, i) => { const m = new Mesh(barGeo, barMats[i]); m.position.x = (i - 2) * 0.95; m.castShadow = true; m.receiveShadow = true; chart.add(m); return m; });
  const plate = new Mesh(new CylinderGeometry(3.1, 3.2, 0.12, 64), new MeshPhysicalMaterial({ color: 0x0c2a2b, roughness: 0.35, metalness: 0.4, clearcoat: 0.5 })); plate.position.y = 0.06; plate.receiveShadow = true; plate.castShadow = true; chart.add(plate);
  const labels = VALS.map((v, i) => { const s = label(renderer, String(v).replace('.', ','), 512, 192, i === 4 ? '#7dffd2' : '#cfeee3'); s.scale.set(0.95, 0.36, 1); s.position.x = (i - 2) * 0.95; chart.add(s); return s; });
  const badge = label(renderer, '+16,0 net', 768, 192, '#7dffd2'); badge.scale.set(2.2, 0.55, 1); chart.add(badge);
  chart.visible = false;

  const resize = () => { const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; if (w > 1000) camera.setViewOffset(w, h, -w * 0.2, 0, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(() => { resize(); render(last); }); ro.observe(container); resize();

  // sahne durumu → nesneler (state: GSAP'in tweenlediği sayılar, hepsi 0..1)
  let last = { intro: 0, open: 0, type: 0, flip1: 0, flip2: 0, s1: 0, fill: 0, s2: 0, bars: 0 }, typedN = -1;
  const e = new Euler(0, 0.55, 0.95), P = new Vector3();
  function render(s) {
    last = s;
    const aspect = camera.aspect, wide = Math.max(1.22, 1.0 / aspect);   // dar ekranda kamera geri çekilir

    // defter: düşer, açılır (kapak masaya iner), sol sayfa yığını pürüzsüzce büyür; sayfalar bükülerek çevrilir
    const intro = easeOut(s.intro), open = ease(s.open), k0 = ease(s.flip1), k1 = ease(s.flip2), e1 = ease(s.s1);
    bookG.position.set(lerp(-W / 2, 0, open) - e1 * 16, lerp(1.3, 0, intro), lerp(0.5, 0, intro)); bookG.scale.setScalar(lerp(0.8, 1, intro));
    bookG.rotation.y = lerp(-0.9, -0.05, intro) - e1 * 0.4; bookG.visible = e1 < 0.995;
    coverPivot.rotation.z = open * Math.PI; coverPivot.position.set(-0.1 * Math.sin(Math.PI * open), lerp(COVER_Y, TABLE_COVER_Y, open), 0);
    const sp = lerp(1, 0.15, smooth((open - 0.3) / 0.4)); for (const p of spine) { p.o.scale.y = p.sy * sp; p.o.position.y = p.y * sp; }
    const hl = 0.006 * smooth((open - 0.9) / 0.1) + 0.004 * (k0 + k1);
    leftStack.visible = hl > 0.0008; leftStack.scale.y = Math.max(0.0005, hl); leftStack.position.y = COVER_TOP_OPEN + Math.max(0.0005, hl) / 2;
    pages[0].userData.pose(k0, START_Y[0], endY(0)); pages[1].userData.pose(k1, START_Y[1], endY(1));

    // yazı: yalnız satırlar yeniden yazılır (hazır katman kopyalanır, gürültü yeniden üretilmez)
    const n = Math.floor(clamp01(s.type) * TYPED.length);
    if (n !== typedN) {
      typedN = n; tg.drawImage(baseCv, 0, 0); tg.fillStyle = INK; tg.font = `500 46px ${FONT}`; tg.textAlign = 'left'; tg.textBaseline = 'alphabetic';
      let left = n, y = 500; for (const ln of lines) { if (left <= 0) break; const part = ln.slice(0, left); tg.fillText(part, 64, y); left -= ln.length + 1; if (left <= 0 && n < TYPED.length) tg.fillText('▍', 64 + tg.measureText(part).width + 4, y); y += 66; }
      typedTex.needsUpdate = true;
    }

    // form: sağdan gelir, kalem işaretler, sola çıkar; kalem uçtan hizalanır (ucu orijinde)
    const exit = ease(clamp01(s.s2 * 1.8));   // form, grafik gelmeden önce tamamen çıkar
    sheetG.position.set(lerp(8, 0, e1) - exit * 9, 0, 0.1); sheetG.visible = sheetG.position.x < 7.9 && exit < 0.995;
    const nf = clamp01(s.fill) * (ANSWERS.length - 0.001) + (s.fill > 0 ? 0.001 : 0), fn = Math.floor(nf), fr = nf - fn;
    marks.forEach((m, i) => { m.scale.setScalar(Math.max(0.001, easeOutBack(clamp01((nf - i) * 4)))); m.visible = nf - i > 0; });
    const a = ANSWERS[Math.min(fn, ANSWERS.length - 1)], b = ANSWERS[Math.min(fn + 1, ANSWERS.length - 1)];
    const [ax, az] = bubbleXY(a[0], a[1]), [bx, bz] = bubbleXY(b[0], b[1]);
    const win = smooth(s.fill / 0.05), wout = smooth((s.fill - 0.95) / 0.05), hover = 0.025 + Math.sin(fr * Math.PI) * 0.2 + wout * 0.9 + exit * 1.2;
    P.set(sheetG.position.x + lerp(ax, bx, ease(fr)), SHT + hover, sheetG.position.z + lerp(az, bz, ease(fr)));
    P.x = lerp(sheetG.position.x + 1.1, P.x, win); P.y = lerp(1.8, P.y, win); P.z = lerp(sheetG.position.z - 0.4, P.z, win);
    pencil.rotation.copy(e); pencil.position.copy(P); pencil.visible = sheetG.visible;

    // grafik
    const cs = easeOutBack(clamp01((s.s2 - 0.4) / 0.6)); chart.visible = s.s2 > 0.4; chart.scale.setScalar(Math.max(0.001, cs));
    barMeshes.forEach((m, i) => { const k = easeOut(clamp01(s.bars * 1.35 - i * 0.12)); const h = Math.max(0.001, barH[i] * k); m.scale.y = h; m.position.y = 0.12 + h / 2; labels[i].position.y = 0.12 + h + 0.38; labels[i].material.opacity = clamp01(k * 1.4 - 0.4); });
    badge.position.set(0.2, 0.12 + barH[4] + 1.05, 0); badge.material.opacity = clamp01((s.bars - 0.7) * 3.3);
    chart.rotation.y = lerp(-0.7, -0.15, ease(s.bars));

    // kamera: defter → form (yukarıdan) → grafik
    const portrait = aspect < 0.9, fitD = 2.35 / (0.2867 * aspect), px = lerp(1.0, 0, ease(clamp01(s.flip1 * 1.3))), wideA = Math.max(wide * 1.12, 1.55 / aspect);
    const A = portrait ? [px, fitD * 0.8, fitD * 0.6, px, 0.1, 0.1] : [0.3, 6.6 * wideA, 7.6 * wideA, 0, 0.1, 0.1], B = [0, 8.6 * wide, 5.4 * wide, 0, 0, 0.2], C = [0.3, 5.8 * wide, 11.8 * wide, 0, 1.3, 0];
    const k2 = ease(s.s2), m = (i) => lerp(lerp(A[i], B[i], e1), C[i], k2);
    camera.position.set(m(0), m(1), m(2)); camera.lookAt(m(3), m(4), m(5));
    glow.material.opacity = 0.36;
    renderer.render(scene, camera);
  }

  return {
    render, resize,
    dispose() {
      ro.disconnect(); scene.traverse((o) => { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach((m) => { m.map?.dispose?.(); m.normalMap?.dispose?.(); m.dispose?.(); }); });
      envRT.dispose(); renderer.dispose(); renderer.forceContextLoss?.(); el.remove();
    },
  };
}
