// DGS net hesabı: Net = Doğru - Yanlış × 0.25.
// Kayan nokta hatasını önlemek için çeyrek (×4) tamsayı aritmetiği kullanılır.
export const MAX_Q = 50; // Matematik ve Türkçe: 50'şer soru

export function net(correct, wrong) {
  if (![correct, wrong].every(Number.isInteger) || correct < 0 || wrong < 0) throw new RangeError('Geçersiz sayı');
  return (correct * 4 - wrong) / 4; // her zaman 0.25'in katı → ikili olarak tam temsil edilir
}

export function examNets({ mathCorrect, mathWrong, turkceCorrect, turkceWrong }) {
  const mathNet = net(mathCorrect, mathWrong);
  const turkceNet = net(turkceCorrect, turkceWrong);
  return { mathNet, turkceNet, totalNet: (mathNet * 4 + turkceNet * 4) / 4 };
}
