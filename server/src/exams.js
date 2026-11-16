// Sınav türleri (DGS | YKS), bölümleri, soru sayıları ve müfredat — tek kaynak.
// Net kuralı (DGS, TYT, AYT): 4 yanlış 1 doğruyu götürür → calc.js
import { DGS_TOPIC_GROUPS } from './curriculum.js';
import { YKS_TOPIC_GROUPS, YKS_BY_PART } from './curriculum-yks.js';

export const EXAM_TYPES = ['DGS', 'YKS'];
export const DEFAULT_EXAM = 'DGS';
export const isExamType = (x) => EXAM_TYPES.includes(x);

const sec = (key, label, max) => ({ key, label, max });
// PARTS: deneme bölümleri. DGS tek bölüm; YKS = TYT | AYT
export const PARTS = {
  DGS: { DGS: { label: 'DGS', sections: [sec('matematik', 'Matematik', 50), sec('turkce', 'Türkçe', 50)] } },
  YKS: {
    TYT: { label: 'TYT', sections: [sec('turkce', 'Türkçe', 40), sec('sosyal', 'Sosyal Bilimler', 20), sec('matematik', 'Temel Matematik', 40), sec('fen', 'Fen Bilimleri', 20)] },
    AYT: { label: 'AYT', sections: [sec('matematik', 'Matematik', 40), sec('fizik', 'Fizik', 14), sec('kimya', 'Kimya', 13), sec('biyoloji', 'Biyoloji', 13),
      sec('edebiyat', 'Edebiyat', 24), sec('tarih', 'Tarih', 10), sec('cografya', 'Coğrafya', 6)] },
  },
};
export const EXAM_LABEL = { DGS: 'Auren DGS', YKS: 'Auren YKS' };

const SUBJECT_LABELS = { matematik: 'Matematik', turkce: 'Türkçe', geometri: 'Geometri', fizik: 'Fizik', kimya: 'Kimya', biyoloji: 'Biyoloji', edebiyat: 'Edebiyat', tarih: 'Tarih', cografya: 'Coğrafya', felsefe: 'Felsefe', din: 'Din Kültürü' };
// Müfredat bölüm bazlıdır: DGS tek bölüm; YKS = TYT | AYT (her biri kendi ders ve konu listesine sahip)
export const CURRICULUM = { DGS: { DGS: DGS_TOPIC_GROUPS }, YKS: YKS_BY_PART };
const flat = (groups) => groups.flatMap(gr => gr.topics);
const lab = (key) => SUBJECT_LABELS[key] ?? key;
export const PART_SUBJECTS = Object.fromEntries(EXAM_TYPES.map(x => [x, Object.fromEntries(Object.entries(CURRICULUM[x]).map(([p, cur]) => [p, Object.keys(cur).map(key => ({ key, label: lab(key) }))]))]));
export const TOPIC_KEYS = Object.fromEntries(EXAM_TYPES.map(x => [x, Object.fromEntries(Object.entries(CURRICULUM[x]).map(([p, cur]) =>
  [p, Object.fromEntries(Object.entries(cur).map(([k, groups]) => [k, new Set(flat(groups).map(t => t.value))]))]))]));
export const TOTAL_TOPICS = Object.fromEntries(EXAM_TYPES.map(x => [x, Object.fromEntries(Object.entries(CURRICULUM[x]).map(([p, cur]) =>
  [p, Object.values(cur).reduce((s, groups) => s + flat(groups).length, 0)]))]));
export const topicCount = (x, part, subject) => flat(CURRICULUM[x]?.[part]?.[subject] ?? []).length;
export const defaultPartOf = (x) => Object.keys(PARTS[x])[0];

export const partOf = (examType, part) => PARTS[examType]?.[part] ?? null;
// Bir sınav türündeki tüm deneme bölümü anahtarları (hata nedenleri için geçerli "ders" kümesi)
export const sectionKeys = (examType) => [...new Set(Object.values(PARTS[examType]).flatMap(p => p.sections.map(s => s.key)))];

// İstemciye giden yapılandırma
export const publicConfig = () => ({
  types: EXAM_TYPES.map(id => ({
    id, label: EXAM_LABEL[id],
    parts: Object.entries(PARTS[id]).map(([pid, p]) => ({ id: pid, label: p.label, sections: p.sections, subjects: PART_SUBJECTS[id][pid], curriculum: CURRICULUM[id][pid] })),
  })),
});
