import { create } from 'zustand';
import { get, post } from './lib/api.js';

export const useAuth = create((set) => ({
  user: null, ready: false,
  async init() {
    try { set({ user: (await get('/auth/me')).user, ready: true }); } catch { set({ user: null, ready: true }); }
  },
  async login(identifier, password) { set({ user: (await post('/auth/login', { identifier, password })).user }); },
  async register(username, email, password) { set({ user: (await post('/auth/register', { username, email, password })).user }); },
  async logout() {
    // Sunucu isteği başarısız olsa bile arayüzde oturumu kapat ve landing'e dön
    try { await post('/auth/logout'); } catch { /* çerez zaten geçersiz olabilir */ }
    set({ user: null });
    window.history.replaceState(null, '', '/');
    window.scrollTo(0, 0);
  },
}));
