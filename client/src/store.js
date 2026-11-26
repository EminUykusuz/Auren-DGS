import { useMemo } from 'react';
import { create } from 'zustand';
import { get, post, put } from './lib/api.js';

const LS_MODE = 'auren_mode', LS_PART = 'auren_part';
const valid = (m) => (m === 'DGS' || m === 'YKS' || m === 'LGS' ? m : null);

// Sınav modu (DGS | YKS | LGS): kalıcı tercih hem tarayıcıda (anında) hem sunucuda (cihazlar arası) saklanır.
// Sunucu yapılandırması (bölümler, soru sayıları, müfredat) /api/exams-config'ten gelir.
export const useExam = create((set, getState) => ({
  mode: valid(localStorage.getItem(LS_MODE)) ?? 'DGS',
  parts: { DGS: 'DGS', LGS: 'LGS', YKS: localStorage.getItem(LS_PART) === 'AYT' ? 'AYT' : 'TYT' },
  config: null,
  async loadConfig() { try { set({ config: await get('/exams-config') }); } catch { /* sunucu yoksa App hata gösterir */ } },
  // Sunucudaki tercih kazanır (başka cihazda değiştirilmiş olabilir)
  adopt(mode) { const m = valid(mode); if (m) { localStorage.setItem(LS_MODE, m); set({ mode: m }); } },
  setMode(mode, { remote = true } = {}) {
    const m = valid(mode); if (!m || m === getState().mode) return;
    localStorage.setItem(LS_MODE, m); set({ mode: m });
    if (remote) put('/profile/mode', { examMode: m }).catch(() => {}); // tarayıcıda zaten kalıcı; sunucu hatası arayüzü bozmaz
  },
  setPart(part) {
    const { mode, parts } = getState();
    if (mode === 'YKS') localStorage.setItem(LS_PART, part);
    set({ parts: { ...parts, [mode]: part } });
  },
}));

// Geçerli moda ait yapılandırma ve sorgu yardımcıları
export function useExamCfg() {
  const mode = useExam(s => s.mode), config = useExam(s => s.config), part = useExam(s => s.parts[s.mode]);
  const base = config.types.find(t => t.id === mode);
  const partDef = base.parts.find(p => p.id === part) ?? base.parts[0];
  // cfg.subjects / cfg.curriculum seçili bölümün (DGS | TYT | AYT) ders ve konularını verir
  // Kararlı referans: cfg'ye bağlı useMemo'lar her render'da yeniden hesaplanmasın
  const cfg = useMemo(() => ({ ...base, subjects: partDef.subjects, curriculum: partDef.curriculum }), [base, partDef]);
  const topicLabel = (subject, key) => { for (const p of base.parts) { const t = p.curriculum[subject]?.flatMap(g => g.topics).find(t => t.value === key); if (t) return t.label; } return key; };
  const subjectLabel = (key) => base.parts.flatMap(p => p.subjects).find(s => s.key === key)?.label ?? base.parts.flatMap(p => p.sections).find(s => s.key === key)?.label ?? key;
  return { mode, cfg, part: partDef.id, partDef, topicLabel, subjectLabel, q: (extra = {}) => '?' + new URLSearchParams({ examType: mode, part: partDef.id, ...extra }) };
}

export const useAuth = create((set) => ({
  user: null, ready: false,
  async init() {
    await useExam.getState().loadConfig();
    try { const { user } = await get('/auth/me'); useExam.getState().adopt(user.examMode); set({ user, ready: true }); } catch { set({ user: null, ready: true }); }
  },
  patchUser(patch) { set(st => ({ user: st.user ? { ...st.user, ...patch } : st.user })); },
  async login(identifier, password) { const { user } = await post('/auth/login', { identifier, password }); useExam.getState().adopt(user.examMode); set({ user }); },
  async register(username, email, password, examTrack, examMode) {
    // Kayıtta seçilen sınav doğrudan hesaba yazılır; panel bu moda göre açılır
    const { user } = await post('/auth/register', { username, email, password, examTrack, examMode });
    useExam.getState().adopt(user.examMode);
    set({ user });
  },
  async logout() {
    // Sunucu isteği başarısız olsa bile oturum kapanır. Ardından tam sayfa yönlendirmesi yapılır:
    // zamanlayıcılar, GSAP/Lenis, bekleyen istekler ve router durumu tek hamlede sıfırlanır (beyaz ekran/yönlendirme döngüsü olmaz).
    try { await post('/auth/logout'); } catch { /* çerez zaten geçersiz olabilir */ }
    window.location.replace('/');   // user state yeniden yüklemede zaten temizlenir; ara render yok
  },
}));
