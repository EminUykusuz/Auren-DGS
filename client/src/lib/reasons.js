// Yanlış nedenleri (sunucudaki REASONS ile aynı anahtarlar)
export const REASONS = [
  { key: 'dikkat', label: 'Dikkat Hatası', color: '#F59E0B' },
  { key: 'konu', label: 'Konu Eksiği', color: '#06B6D4' },
  { key: 'sure', label: 'Süre Yetmedi', color: '#818CF8' },
  { key: 'formul', label: 'Formül Unuttum', color: '#10B981' },
  { key: 'diger', label: 'Diğer', color: '#94A3B8' },
];
export const REASON_LABEL = Object.fromEntries(REASONS.map(r => [r.key, r.label]));
export const SUBJECT_LABEL = { matematik: 'Matematik', turkce: 'Türkçe' };

// [{subject, reason, count}] <-> { matematik: {dikkat: 2}, turkce: {...} }
export const toMap = (list = []) => list.reduce((m, e) => ((m[e.subject] ??= {})[e.reason] = e.count, m), { matematik: {}, turkce: {} });
export const toList = (map) => Object.entries(map).flatMap(([subject, rs]) => Object.entries(rs).filter(([, c]) => c > 0).map(([reason, count]) => ({ subject, reason, count })));
export const sumOf = (rs = {}) => Object.values(rs).reduce((s, c) => s + c, 0);
