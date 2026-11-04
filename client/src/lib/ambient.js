// Ortam sesi: dış dosya gerektirmeden Web Audio ile üretilen sürekli gürültü + bitiş zili.
export const SOUNDS = [
  ['off', 'Kapalı'],
  ['brown', 'Kahverengi gürültü'],
  ['rain', 'Yağmur'],
  ['white', 'Beyaz gürültü'],
];

let ctx, master, current;

function noiseBuffer(c, kind) {
  const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  if (kind === 'brown') { let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } }
  else for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.3; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setVolume(v) { if (master) master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.05); }

export function stopSound() {
  if (!current) return;
  const { src, gain } = current; current = null;
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  setTimeout(() => { try { src.stop(); } catch { /* zaten durdu */ } }, 600);
}

export function playSound(kind, volume = 0.3) {
  stopSound();
  if (kind === 'off') return;
  const c = ensure(); if (!c) return;
  setVolume(volume);
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, kind === 'brown' ? 'brown' : 'white'); src.loop = true;
  const gain = c.createGain(); gain.gain.value = 0; gain.gain.setTargetAtTime(1, c.currentTime, 0.4);   // yumuşak giriş
  let node = src;
  if (kind === 'rain') {
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
    src.connect(hp); hp.connect(lp); node = lp;
  } else if (kind === 'white') {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000; src.connect(lp); node = lp;   // sert tizleri yumuşat
  }
  node.connect(gain); gain.connect(master); src.start();
  current = { src, gain };
}

// Faz bitişi zili: iki yumuşak sinüs notası
export function chime(volume = 0.3) {
  const c = ensure(); if (!c) return;
  [[659.25, 0], [880, 0.22]].forEach(([f, at]) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f;
    const t = c.currentTime + at; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(Math.max(0.05, volume) * 0.6, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 1.2);
  });
}
