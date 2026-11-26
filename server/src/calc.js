// Net hesabı (DGS, TYT, AYT): 4 yanlış 1 doğruyu götürür → Net = Doğru − Yanlış × 0.25.
// Kayan nokta hatasını önlemek için çeyrek (×4) tamsayı aritmetiği kullanılır.
export const MAX_Q = 50; // DGS bölümü başına soru (geriye dönük uyum)

// div: kaç yanlış bir doğruyu götürür (DGS/YKS 4, LGS 3). 4 için sonuç her zaman 0.25'in katıdır; 3 için 2 haneye yuvarlanır.
export function net(correct, wrong, div = 4) {
  if (![correct, wrong].every(Number.isInteger) || correct < 0 || wrong < 0) throw new RangeError('Geçersiz sayı');
  if (div === 4) return (correct * 4 - wrong) / 4;
  return Math.round((correct - wrong / div) * 100) / 100;
}

// sections: [{ key }], answers: { [key]: { correct, wrong } } → { nets: { key: net }, totalNet }
export function sectionNets(sections, answers, div = 4) {
  const nets = {}; let sum = 0;
  for (const s of sections) {
    const a = answers[s.key] ?? { correct: 0, wrong: 0 };
    nets[s.key] = net(a.correct, a.wrong, div);
    sum += nets[s.key];
  }
  return { nets, totalNet: Math.round(sum * 100) / 100 };
}

// Auren puanı (sıralama için): 10/saat + 1/10 soru + 2 × ortalama net — haftalık, sınav türüne göre
export const weeklyPoints = ({ weeklyHours, weeklyQuestions, avgNet }) =>
  Math.round(weeklyHours * 10 + weeklyQuestions / 10 + Math.max(0, avgNet) * 2);
