// Konu Güç Analizi: saf fonksiyonlar (test edilebilir).
//
// Skor (0-100) = taban × (0.6 + 0.4 × tutunma)
//   taban   = 0.55·doğruluk + 0.25·hacim + 0.20·sıklık
//   doğruluk= net oranı ((D − Y/4) / (D+Y)), az veride 0'a doğru çekilir (güven = min(1, cevaplanan/20))
//   hacim   = min(1, çözülen / hedef soru)
//   sıklık  = min(1, farklı çalışma günü / 4)
//   tutunma = exp(−günGeçen / kararlılık)  — aralıklı tekrar: tekrar sayısı arttıkça kararlılık (gün) uzar
//             kararlılık = min(60, 5 + 7 × farklı çalışma günü)
export const LEVELS = { critical: 40, developing: 70 }; // <40 Kritik, 40-69 Gelişiyor, >=70 Güçlü

export function levelOf(score) {
  return score < LEVELS.critical ? 'critical' : score < LEVELS.developing ? 'developing' : 'strong';
}

export function masteryOf({ correct = 0, wrong = 0, solved = 0, days = 0, daysSince = null, target = 100 }) {
  const answered = correct + wrong;
  if (!answered && !solved && !days) return { score: 0, level: 'none', retention: 0, accuracy: null };
  const netRatio = answered ? Math.max(0, (correct - wrong / 4) / answered) : 0;
  const confidence = Math.min(1, answered / 20);
  const accuracy = netRatio * confidence;
  const volume = Math.min(1, solved / Math.max(1, target));
  const frequency = Math.min(1, days / 4);
  const base = 0.55 * accuracy + 0.25 * volume + 0.2 * frequency;
  const stability = Math.min(60, 5 + 7 * days);
  const retention = daysSince == null ? 0 : Math.exp(-Math.max(0, daysSince) / stability);
  const score = Math.round(100 * base * (0.6 + 0.4 * retention));
  return {
    score, level: levelOf(score), retention: Math.round(retention * 100) / 100,
    accuracy: answered ? Math.round((correct / answered) * 100) : null,
  };
}
