// Müfredat yardımcıları: G = seçili sınav türünün müfredatı ({ ders: [{ group, topics: [{label, value}] }] })
export const firstTopic = (G, subjectKey) => G[subjectKey][0].topics[0].value;

// Kayıtlı (localStorage) ders/konu seçimi başka bir moddan kalmış olabilir → geçerli çifte düzelt
export function validPick(G, subjectKey, topicKey) {
  const sk = G[subjectKey] ? subjectKey : Object.keys(G)[0];
  const has = G[sk].some(g => g.topics.some(t => t.value === topicKey));
  return { subjectKey: sk, topicKey: has ? topicKey : firstTopic(G, sk) };
}
