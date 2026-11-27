// 3B sahneler için kalite yönetimi: cihaza göre başlangıç kalitesi + kare süresi uzarsa kendiliğinden düşürme.
// Amaç: zayıf telefon/dizüstünde site kasmasın; güçlü cihazda tam kalite.

/** Başlangıç kalitesi. low: telefon/az bellek/veri tasarrufu, mid: orta, high: masaüstü */
export function tier() {
  const nav = navigator, mem = nav.deviceMemory || 8, cores = nav.hardwareConcurrency || 8;
  const coarse = matchMedia('(pointer: coarse)').matches, saver = nav.connection?.saveData === true;
  if (saver || mem <= 2 || cores <= 2) return 'low';
  if (coarse || mem <= 4 || cores <= 4 || Math.min(screen.width, screen.height) < 600) return 'mid';
  return 'high';
}

const CFG = {
  low: { dpr: 1, shadow: 0, map: 512 },
  mid: { dpr: 1.5, shadow: 1, map: 1024 },
  high: { dpr: 2, shadow: 1, map: 2048 },
};

/** Gölge ışığına ve çizici ayarlarına uygular; döndürdüğü yönetici her karede `tick(dtMs)` ile beslenir. */
export function governor(renderer, keyLight, { onChange } = {}) {
  const t = tier(), c = CFG[t], dprMax = Math.min(window.devicePixelRatio || 1, c.dpr);
  let dpr = dprMax, shadows = !!c.shadow, avg = 16, n = 0, cool = 0;
  const apply = (notify = true) => {
    renderer.setPixelRatio(dpr);
    renderer.shadowMap.enabled = shadows; if (keyLight) { keyLight.castShadow = shadows; keyLight.shadow.mapSize.set(c.map, c.map); keyLight.shadow.map?.dispose(); keyLight.shadow.map = null; }
    if (notify) onChange?.({ dpr, shadows, tier: t });
  };
  apply(false);
  return {
    tier: t,
    // Her karede çağrılır: ~60 karelik hareketli ortalama 26 ms'yi (≈38 fps) aşarsa bir basamak düşürür
    tick(dt) {
      if (dt <= 0 || dt > 250) return;   // sekme dönüşü gibi sıçramaları yok say
      avg += (dt - avg) * 0.08; if (++n < 45 || cool-- > 0) return;
      if (avg > 26) {
        if (dpr > 1) dpr = Math.max(1, dpr - 0.5); else if (shadows) shadows = false; else return;
        cool = 40; n = 0; avg = 16; apply();
      }
    },
  };
}
