// Sınav türleri (DGS | YKS), bölümleri, soru sayıları ve müfredat — tek kaynak.
// Net kuralı (DGS, TYT, AYT): 4 yanlış 1 doğruyu götürür → calc.js
import { DGS_TOPIC_GROUPS } from './curriculum.js';
import { YKS_TOPIC_GROUPS } from './curriculum-yks.js';

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
export const TOPIC_GROUPS = { DGS: DGS_TOPIC_GROUPS, YKS: YKS_TOPIC_GROUPS };
const map = (f) => Object.fromEntries(EXAM_TYPES.map(x => [x, f(x)]));
export const SUBJECTS = map(x => Object.keys(TOPIC_GROUPS[x]).map(key => ({ key, label: SUBJECT_LABELS[key] ?? key })));
export const TOPICS = map(x => Object.fromEntries(Object.entries(TOPIC_GROUPS[x]).map(([k, groups]) => [k, groups.flatMap(gr => gr.topics)])));
export const TOPIC_KEYS = map(x => Object.fromEntries(Object.entries(TOPICS[x]).map(([k, ts]) => [k, new Set(ts.map(t => t.value))])));
export const TOTAL_TOPICS = map(x => Object.values(TOPICS[x]).reduce((s, ts) => s + ts.length, 0));

export const partOf = (examType, part) => PARTS[examType]?.[part] ?? null;
// Bir sınav türündeki tüm deneme bölümü anahtarları (hata nedenleri için geçerli "ders" kümesi)
export const sectionKeys = (examType) => [...new Set(Object.values(PARTS[examType]).flatMap(p => p.sections.map(s => s.key)))];

// İstemciye giden yapılandırma
export const publicConfig = () => ({
  types: EXAM_TYPES.map(id => ({
    id, label: EXAM_LABEL[id], subjects: SUBJECTS[id], curriculum: TOPIC_GROUPS[id],
    parts: Object.entries(PARTS[id]).map(([pid, p]) => ({ id: pid, label: p.label, sections: p.sections })),
  })),
});
