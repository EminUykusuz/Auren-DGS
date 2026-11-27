// Optik okuyucu çekirdeği (saf JS, DOM'suz): gri görüntü → balon tespiti → blok/yön çözümü → doluluk ölçümü.
// Şablonsuz çalışır: balonları kenar oylamasıyla (Hough) bulur, bloklara ayırır, formun yönünü Sosyal Bilimler-2
// bloğunun (46 soru) yerinden çıkarır. Form 90° yatık ya da ters çekilse de çalışır.
// Girdi: { w, h, gray: Uint8Array } — genişliği ~1500'e indirilmiş olmalı (bkz. normalizeWidth).

export const TARGET_LONG = 2000;   // uzun kenar (balon çapı ~22 px olur)
export const ANSWER_BLOCKS = [{ key: 'turkce', n: 40 }, { key: 'sosyal', n: 46 }, { key: 'mat', n: 40 }, { key: 'fen', n: 40 }];
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function normalizeSize({ w, h, gray }, to = TARGET_LONG) {
  const s = to / Math.max(w, h); if (Math.abs(s - 1) < 0.02) return { w, h, gray };
  const nw = Math.round(w * s), nh = Math.round(h * s), out = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) { const y0 = Math.floor(y / s), y1 = Math.max(y0 + 1, Math.min(h, Math.ceil((y + 1) / s))); for (let x = 0; x < nw; x++) {
    const x0 = Math.floor(x / s), x1 = Math.max(x0 + 1, Math.min(w, Math.ceil((x + 1) / s))); let sum = 0, c = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { sum += gray[yy * w + xx]; c++; }
    out[y * nw + x] = c ? sum / c : 0; } }
  return { w: nw, h: nh, gray: out };
}

// 1) Balon merkezleri: gradyan oylamalı daire tespiti (yarıçap 9–13 px @1500)
export function detectBalloons({ w, h, gray }, rmin = 9, rmax = 13) {
  const b = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += gray[(y + j) * w + x + i]; b[y * w + x] = s / 9; }
  const acc = new Float32Array(w * h);
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const i = y * w + x, gx = b[i + 1] - b[i - 1], gy = b[i + w] - b[i - w], m = Math.hypot(gx, gy); if (m < 9) continue;
    const ux = gx / m, uy = gy / m;
    for (let r = rmin; r <= rmax; r++) for (const sg of [1, -1]) { const cx = Math.round(x + sg * ux * r), cy = Math.round(y + sg * uy * r); if (cx >= 0 && cx < w && cy >= 0 && cy < h) acc[cy * w + cx]++; } }
  const sm = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += acc[(y + j) * w + x + i]; sm[y * w + x] = s; }
  const cand = [], R = 8;
  for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) { const v = sm[y * w + x]; if (v < 40) continue; let ok = true;
    for (let j = -R; j <= R && ok; j++) for (let i = -R; i <= R; i++) if ((i || j) && sm[(y + j) * w + x + i] > v) { ok = false; break; }
    if (ok) cand.push({ x, y, v }); }
  const vs = cand.map(p => p.v).sort((a, c) => a - c), p90 = vs[Math.floor(vs.length * 0.9)] || 1, thr = Math.max(60, p90 * 0.35);
  const peaks = cand.filter(p => p.v >= thr);
  return peaks;
}

// 2) Komşuluk kümeleri (balon aralığı ~28 px; bloklar arası boşluk > 38 px)
export function clusterBalloons(pts, link = 38) {
  const cell = link, key = (x, y) => Math.floor(x / cell) + ',' + Math.floor(y / cell), grid = new Map();
  pts.forEach((p, i) => { const k = key(p.x, p.y); (grid.get(k) ?? grid.set(k, []).get(k)).push(i); });
  const par = pts.map((_, i) => i), find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  pts.forEach((p, i) => { const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get((cx + dx) + ',' + (cy + dy)) ?? []) if (j > i && Math.hypot(pts[j].x - p.x, pts[j].y - p.y) < link) par[find(i)] = find(j); });
  const groups = new Map(); pts.forEach((p, i) => { const r = find(i); (groups.get(r) ?? groups.set(r, []).get(r)).push(p); });
  return [...groups.values()].filter(g => g.length >= 4);
}

// Bir kümenin ızgara yönü (0–90° arası, rad): en yakın komşu vektörlerinin açısı mod 90°
function gridAngle(g) {
  let sx = 0, sy = 0;
  for (const p of g.slice(0, 400)) { let best = 1e9, bx = 0, by = 0;
    for (const q of g) { if (q === p) continue; const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < best) { best = d; bx = q.x - p.x; by = q.y - p.y; } }
    const a = Math.atan2(by, bx) * 4; sx += Math.cos(a); sy += Math.sin(a); }
  return Math.atan2(sy, sx) / 4;
}
const centroid = g => ({ x: g.reduce((s, p) => s + p.x, 0) / g.length, y: g.reduce((s, p) => s + p.y, 0) / g.length });

// En küçük kareler: (satır, sütun) → (x, y); terimler 1, r, c, r·c, r² (perspektifi de karşılar)
function fitModel(samples) {
  const T = (r, c) => [1, r, c, r * c, r * r], K = 5;
  const solve = (vals) => { const A = Array.from({ length: K }, () => new Array(K + 1).fill(0));
    samples.forEach((s, si) => { const t = T(s.r, s.c); for (let i = 0; i < K; i++) { for (let j = 0; j < K; j++) A[i][j] += t[i] * t[j]; A[i][K] += t[i] * vals[si]; } });
    for (let i = 0; i < K; i++) A[i][i] += 1e-9;
    for (let i = 0; i < K; i++) { let p = i; for (let k = i + 1; k < K; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; [A[i], A[p]] = [A[p], A[i]];
      for (let k = i + 1; k < K; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j <= K; j++) A[k][j] -= f * A[i][j]; } }
    const x = new Array(K).fill(0); for (let i = K - 1; i >= 0; i--) { let v = A[i][K]; for (let j = i + 1; j < K; j++) v -= A[i][j] * x[j]; x[i] = v / A[i][i]; } return x; };
  const cx = solve(samples.map(s => s.x)), cy = solve(samples.map(s => s.y));
  return (r, c) => { const t = T(r, c); return { x: t.reduce((a, v, i) => a + v * cx[i], 0), y: t.reduce((a, v, i) => a + v * cy[i], 0) }; };
}

// 3) Formun yönünü ve cevap bloklarını çöz. Döner: { blocks: {turkce,sosyal,mat,fen: {n, cell(r,c)->{x,y}, found}} , up: {ux,uy}, issues:[] }
export function locateForm(peaks) {
  const issues = [], clusters = clusterBalloons(peaks);
  const big = clusters.filter(g => g.length >= 150 && g.length <= 260);
  if (big.length < 4) return { issues: [`Cevap blokları bulunamadı (${big.length}/4). Formun tamamı net ve kadrajda mı?`], blocks: null };
  // Sosyal-2 (46 soru × 5 = 230) en kalabalık olan
  const sorted = [...big].sort((a, b) => b.length - a.length), sosyal = sorted[0];
  if (sosyal.length < 205) issues.push('Sosyal Bilimler-2 bloğu eksik algılandı');
  const four = [sosyal, ...sorted.slice(1, 4)];
  const th = gridAngle(sosyal);
  let chosen = null;
  for (let k = 0; k < 4; k++) {
    const a = th + k * Math.PI / 2, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;   // yatay (soldan sağa) ve dikey (yukarıdan aşağı) birim vektörler
    const proj = four.map(g => { const c = centroid(g); return { g, px: c.x * ux + c.y * uy }; }).sort((p, q) => p.px - q.px);
    const ext = sosyal.map(p => ({ x: p.x * ux + p.y * uy, y: p.x * vx + p.y * vy })), wX = Math.max(...ext.map(e => e.x)) - Math.min(...ext.map(e => e.x)), wY = Math.max(...ext.map(e => e.y)) - Math.min(...ext.map(e => e.y));
    if (wY < wX * 3) continue;                                  // dik değil → bu yön olamaz
    if (proj[1].g !== sosyal) continue;                         // Sosyal soldan 2. olmalı (ters/180° çevrik olanı eler)
    chosen = { ux, uy, vx, vy, order: proj.map(p => p.g) }; break;
  }
  if (!chosen) return { issues: ['Formun yönü anlaşılamadı'], blocks: null };
  const { ux, uy, vx, vy, order } = chosen, keys = ['turkce', 'sosyal', 'mat', 'fen'], blocks = {};
  const baseA = Math.atan2(uy, ux);
  order.forEach((g, bi) => {
    const N = ANSWER_BLOCKS[bi].n;
    // bu bloğun kendi eğikliği: ızgara açısı, seçilen yönün yakınına (90°'nin katı kadar kaydırılarak) getirilir
    let ab = gridAngle(g); ab += Math.round((baseA - ab) / (Math.PI / 2)) * (Math.PI / 2);
    const bx = Math.cos(ab), by = Math.sin(ab), cx = -by, cy = bx;
    const pts = g.map(p => ({ x: p.x * bx + p.y * by, y: p.x * cx + p.y * cy, o: p }));
    // satırlar: y'ye göre sıralayıp boşluklardan böl (aralık ~28; satır içi sapma birkaç px)
    pts.sort((p, q) => p.y - q.y);
    const dy = []; for (let i = 1; i < pts.length; i++) dy.push(pts[i].y - pts[i - 1].y);
    const big = dy.filter(v => v > 8).sort((p, q) => p - q), pitch = big.length ? big[Math.floor(big.length * 0.75)] : 28, cut = pitch * 0.5;
    const rows = [[pts[0]]]; for (let i = 1; i < pts.length; i++) { if (pts[i].y - rows[rows.length - 1].reduce((m, q) => m + q.y, 0) / rows[rows.length - 1].length > cut) rows.push([pts[i]]); else rows[rows.length - 1].push(pts[i]); }
    const samples = [];
    if (rows.length === N) {
      const xs = pts.map(p => p.x), x0 = Math.min(...xs), px = (Math.max(...xs) - x0) / 4;
      rows.forEach((row, r) => { row.sort((p, q) => p.x - q.x);
        if (row.length === 5) row.forEach((p, c) => samples.push({ r, c, x: p.o.x, y: p.o.y }));
        else row.forEach(p => samples.push({ r, c: Math.max(0, Math.min(4, Math.round((p.x - x0) / px))), x: p.o.x, y: p.o.y })); });
    } else issues.push(`${keys[bi]} bloğunda ${rows.length} satır ayrıştı (beklenen ${N})`);
    if (samples.length < 20) { blocks[keys[bi]] = null; return; }
    const f = fitModel(samples), res = samples.map(s => Math.hypot(f(s.r, s.c).x - s.x, f(s.r, s.c).y - s.y)), good = samples.filter((_, i) => res[i] < 6);
    const f2 = fitModel(good);
    if (good.length < N * 5 * 0.9) issues.push(`${keys[bi]} bloğunda ${N * 5 - good.length} balon bulunamadı`);
    blocks[keys[bi]] = { n: N, cell: f2, found: good.length };
  });
  if (Object.values(blocks).some(v => !v)) return { issues: [...issues, 'Cevap blokları çözülemedi'], blocks: null };
  return { blocks, up: { ux, uy, vx, vy }, issues, clusters };
}

// 4) Doluluk ölçümü. Balonun iç diski (yarıçap 0.7r) ortalama koyuluğu; aynı sütun + aynı şerit eşliğindeki
// (pembe zemin satır aralıklı) boş balonların medyanına göre fark → "ek koyuluk".
export function discDarkness({ w, h, gray }, x, y, r = 9) {
  let s = 0, n = 0; const R = r * r;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { if (i * i + j * j > R) continue; const xx = Math.round(x + i), yy = Math.round(y + j); if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; s += 255 - gray[yy * w + xx]; n++; }
  return n ? s / n : 0;
}
const median = a => { const b = [...a].sort((p, q) => p - q); return b[b.length >> 1]; };

export function readAnswers(img, blocks) {
  const out = {};
  for (const key of Object.keys(blocks)) {
    const B = blocks[key], dark = [];
    for (let r = 0; r < B.n; r++) { dark.push([]); for (let c = 0; c < 5; c++) { const p = B.cell(r, c); dark[r].push(discDarkness(img, p.x, p.y)); } }
    // Model: koyuluk[r][c] = satırSeviyesi[r] + şıkFarkı[parite][c] (+ işaret). Çoğu balon boştur, medyanlar işareti yutar.
    // Satır seviyesi ışığın aşağı doğru değişimini, şık farkı harf biçiminin ve şerit renginin sabit etkisini alır.
    const lvl = new Array(B.n).fill(0), off = [new Array(5).fill(0), new Array(5).fill(0)];
    for (let it = 0; it < 4; it++) {
      for (let r = 0; r < B.n; r++) lvl[r] = median(dark[r].map((d, c) => d - off[r % 2][c]));
      for (const par of [0, 1]) for (let c = 0; c < 5; c++) off[par][c] = median(dark.map((row, r) => ({ r, d: row[c] })).filter(o => o.r % 2 === par).map(o => o.d - lvl[o.r]));
    }
    out[key] = dark.map((row, r) => row.map((d, c) => d - lvl[r] - off[r % 2][c]));
  }
  return out;
}

// Her soru için karar: 'dolu' (tek şık), 'boş', 'çoklu' (birden çok işaret) ya da 'belirsiz' (zayıf iz; öğretmen onaylar)
export const FILLED = 14, FAINT = 7;
export function decide(scores, alpha = LETTERS, FILLED_T = FILLED, FAINT_T = FAINT) {
  if (!Array.isArray(alpha)) alpha = LETTERS;   // scores.map(decide) gibi çağrılarda indeks gelmesin
  if (typeof FILLED_T !== 'number' || FILLED_T < 1) FILLED_T = FILLED;
  const marked = scores.map((v, i) => [v, i]).filter(([v]) => v >= FILLED_T).map(([, i]) => i);
  if (marked.length === 1) { const rest = Math.max(...scores.filter((_, i) => i !== marked[0])); return rest >= FAINT_T + 3 ? { s: 'belirsiz', pick: alpha[marked[0]] } : { s: 'dolu', pick: alpha[marked[0]] }; }
  if (marked.length > 1) return { s: 'çoklu', pick: marked.map(i => alpha[i]).join('') };
  const faint = Math.max(...scores); return faint >= FAINT_T ? { s: 'belirsiz', pick: alpha[scores.indexOf(faint)] } : { s: 'boş', pick: '' };
}
export { LETTERS };

// 5) Küçük bloklar: Öğrenci No (6 hane × 0–9) ve Kitapçık (A–D). Konum, Türkçe bloğunun ızgarasına göre
// (sütun/satır adımı cinsinden) tahmin edilir, sonra bulunan gerçek balonlara oturtulur.
// c0/r0: ilk balonun Türkçe-ızgarasındaki (sütun, satır) konumu. Ölçüler örnek formdan.
export const SMALL_BLOCKS = {
  ogrNo: { rows: 10, cols: 6, c0: -10.07, r0: 3.63, rowStep: 0.983 },
  kitapcik: { rows: 1, cols: 4, c0: -0.86, r0: -6.9, rowStep: 1 },
};

function predictGrid(turkce, spec) {
  const o = turkce.cell(0, 0), ex = turkce.cell(0, 1), ey = turkce.cell(1, 0);
  const ax = ex.x - o.x, ay = ex.y - o.y, bx = ey.x - o.x, by = ey.y - o.y, pitch = Math.hypot(ax, ay);
  const pos = (r, c) => ({ x: o.x + (spec.c0 + c) * ax + (spec.r0 + r * spec.rowStep) * bx, y: o.y + (spec.c0 + c) * ay + (spec.r0 + r * spec.rowStep) * by });
  return { pos, pitch };
}

// Tahmin edilen ızgarayı önce ofset oylamasıyla kaydırır, sonra balonlara oturtup modeli yinelemeli iyileştirir. Döner { cell, snapped, total }
function snapGrid(peaks, turkce, spec) {
  const { pos: pos0, pitch } = predictGrid(turkce, spec), total = spec.rows * spec.cols, med = a => { const b = [...a].sort((p, q) => p - q); return b[b.length >> 1]; };
  const near = (pos, tol) => { const s = []; for (let r = 0; r < spec.rows; r++) for (let c = 0; c < spec.cols; c++) { const p = pos(r, c); let best = null, bd = tol; for (const q of peaks) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } } if (best) s.push({ r, c, x: best.x, y: best.y, dx: best.x - p.x, dy: best.y - p.y }); } return s; };
  const first = near(pos0, pitch * 0.55);
  if (first.length < Math.max(3, total * 0.4)) return { cell: pos0, snapped: first.length, total, weak: true };
  const vx = med(first.map(s => s.dx)), vy = med(first.map(s => s.dy));
  // oylama sahte tepelere (el yazısı kutuları vb.) kilitlenebilir: ±1 adım kaydırmaları da dene, en çok balona oturanı seç
  let sx = vx, sy = vy, bestN = -1;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const tx = vx + i * pitch, ty = vy + j * pitch, n = near((r, c) => { const p = pos0(r, c); return { x: p.x + tx, y: p.y + ty }; }, pitch * 0.25).length; if (n > bestN) { bestN = n; sx = tx; sy = ty; } }
  let pos = (r, c) => { const p = pos0(r, c); return { x: p.x + sx, y: p.y + sy }; }, samples = near(pos, pitch * 0.4);
  for (let it = 0; it < 3 && samples.length >= Math.max(6, total * 0.5) && spec.rows > 1; it++) { pos = fitModel(samples); samples = near(pos, pitch * 0.3); }
  if (samples.length < Math.max(3, total * 0.6)) return { cell: pos, snapped: samples.length, total, weak: true };
  if (spec.rows > 1) pos = fitModel(samples);
  return { cell: pos, snapped: samples.length, total };
}

// Sütun başına en koyu balon (öğrenci no) ya da satırdaki en koyu balon (kitapçık). Her sütunun medyanı çıkarılır.
export function readSmall(img, peaks, blocks) {
  const issues = [], out = {};
  const num = snapGrid(peaks, blocks.turkce, SMALL_BLOCKS.ogrNo);
  if (num.weak) issues.push(`Öğrenci no alanı net görünmüyor (${num.snapped}/${num.total} balon bulundu)`);
  const NC = SMALL_BLOCKS.ogrNo.cols, raw = [];   // raw[c][d]
  for (let c = 0; c < NC; c++) { const d = []; for (let r = 0; r < 10; r++) { const p = num.cell(r, c); d.push(discDarkness(img, p.x, p.y)); } raw.push(d); }
  // Model: ham = sütunSeviyesi[c] + rakamFarkı[d] + işaret. Rakam farkı (8,9 koyu, 1 açık) işaretli hücreler dışlanarak kestirilir;
  // bir rakamın tüm hücreleri işaretliyse (örn. 000000) farkı 0 alınır.
  const lvl = raw.map(col => median(col)), off = new Array(10).fill(0); let skip = raw.map((col, c) => col.map(x => x - lvl[c] >= FILLED * 0.8));   // başlangıç adayları
  for (let it = 0; it < 4; it++) {
    for (let d = 0; d < 10; d++) { const v = []; for (let c = 0; c < NC; c++) if (!skip[c][d]) v.push(raw[c][d] - lvl[c]); off[d] = v.length >= 2 ? median(v) : 0; }
    for (let c = 0; c < NC; c++) { const v = raw[c].map((x, d) => x - off[d]).filter((_, d) => !skip[c][d]); lvl[c] = v.length ? median(v) : lvl[c]; }
    skip = raw.map((col, c) => col.map((x, d) => skip[c][d] && x - off[d] - lvl[c] >= FILLED * 0.5 || x - off[d] - lvl[c] >= FILLED * 0.7));
  }
  const cols = raw.map((col, c) => col.map((x, d) => x - off[d] - lvl[c]));
  // gürültü: işaretsiz hücrelerin artık dağılımı (MAD) → bu fotoğraf için belirsizlik taban değeri
  const rest = []; cols.forEach((col, c) => col.forEach((x, d) => { if (!skip[c][d]) rest.push(x); }));
  const m0 = median(rest), sigma = 1.4826 * median(rest.map(x => Math.abs(x - m0)));
  out.ogrNoNoise = { m0, sigma, max: Math.max(...rest) };
  if (out.ogrNoNoise.max >= FAINT + 3) issues.push('Öğrenci no alanı gürültülü (gölge/yansıma olabilir); haneleri kontrol edin');
  out.ogrNo = cols;   // [hane][rakam] ek koyuluk
  const kit = snapGrid(peaks, blocks.turkce, SMALL_BLOCKS.kitapcik);
  if (kit.weak) issues.push(`Kitapçık alanı net görünmüyor (${kit.snapped}/${kit.total} balon bulundu)`);
  const kd = []; for (let c = 0; c < 4; c++) { const p = kit.cell(0, c); kd.push(discDarkness(img, p.x, p.y)); }
  const km = median(kd); out.kitapcik = kd.map(v => v - km);
  return { scores: out, issues };
}

// Öğrenci no: her hane için tek işaret → rakam; belirsiz/boş hane '?' olur ve öğretmene gösterilir. Döner { text, digits:[{s,pick}] }
export const DIGITS = '0123456789'.split('');
export function decideStudentNo(cols) { return cols.map(col => decide(col, DIGITS)); }
export function decideBooklet(scores) { return decide(scores, ['A', 'B', 'C', 'D'], 10, 6); }   // tek satır, harf farkı düzeltilemiyor: daha düşük eşik
