// Net hesabı (DGS, TYT, AYT): 4 yanlış 1 doğruyu götürür → Net = Doğru − Yanlış × 0.25.
// Kayan nokta hatasını önlemek için çeyrek (×4) tamsayı aritmetiği kullanılır.
export const MAX_Q = 50; // DGS bölümü başına soru (geriye dönük uyum)

export function net(correct, wrong) {
  if (![correct, wrong].every(Number.isInteger) || correct < 0 || wrong < 0) throw new RangeError('Geçersiz sayı');
  return (correct * 4 - wrong) / 4; // her zaman 0.25'in katı → ikili olarak tam temsil edilir
}

// sections: [{ key }], answers: { [key]: { correct, wrong } } → { nets: { key: net }, totalNet }
export function sectionNets(sections, answers) {
  const nets = {}; let quarters = 0;
  for (const s of sections) {
    const a = answers[s.key] ?? { correct: 0, wrong: 0 };
    nets[s.key] = net(a.correct, a.wrong);
    quarters += nets[s.key] * 4;
  }
  return { nets, totalNet: quarters / 4 };
}

// Auren puanı (sıralama için): 10/saat + 1/10 soru + 2 × ortalama net — haftalık, sınav türüne göre
export const weeklyPoints = ({ weeklyHours, weeklyQuestions, avgNet }) =>
  Math.round(weeklyHours * 10 + weeklyQuestions / 10 + Math.max(0, avgNet) * 2);
