import { net } from './api.js';

// Landing simülasyonu: sınav bölümleri (sunucudaki exams.js ile aynı soru sayıları)
export const EST = {
  DGS: { parts: { DGS: { label: 'DGS', sections: [['Matematik', 50], ['Türkçe', 50]] } } },
  LGS: { parts: { LGS: { label: 'LGS', div: 3, sections: [['Türkçe', 20], ['T.C. İnkılap Tarihi', 10], ['Din Kültürü', 10], ['İngilizce', 10], ['Matematik', 20], ['Fen Bilimleri', 20]] } } },
  YKS: {
    parts: {
      TYT: { label: 'TYT', sections: [['Türkçe', 40], ['Sosyal Bilimler', 20], ['Temel Matematik', 40], ['Fen Bilimleri', 20]] },
      AYT: { label: 'AYT', sections: [['Matematik', 40], ['Fizik', 14], ['Kimya', 13], ['Biyoloji', 13], ['Edebiyat', 24], ['Tarih', 10], ['Coğrafya', 6]] },
    },
  },
};

export const partMax = (sections) => sections.reduce((s, [, m]) => s + m, 0);

// Bölüm netlerinin toplamı. Doğru + yanlış, soru sayısını aşamaz.
export function partNet(sections, answers, div = 4) {
  return sections.reduce((sum, [name, max]) => {
    const a = answers?.[name] ?? { c: 0, w: 0 };
    const c = Math.min(max, Math.max(0, a.c | 0)), w = Math.min(max - c, Math.max(0, a.w | 0));
    return sum + net(c, w, div);
  }, 0);
}

// Yaklaşık puan: 100–500 ölçeğinde doğrusal tahmin. Gerçek puan, sınavın zorluğuna ve ÖSYM standart sapmasına göre değişir.
export const approxScore = (n, max) => 100 + (Math.max(0, n) / max) * 400;
// YKS yerleştirme: TYT %40 + AYT %60 (yaklaşık)
export const blendYks = (tyt, ayt) => tyt * 0.4 + ayt * 0.6;
