import { useEffect } from 'react';

export const SITE = 'https://aurenstudy.com.tr';
export const DEFAULT_TITLE = 'Auren Study – DGS ve YKS (TYT-AYT) çalışma, deneme ve rekabet takibi';
export const DEFAULT_DESC = 'Auren Study: DGS ve YKS (TYT-AYT) için çalışma süresi, deneme neti ve konu güç analizini takip et; arkadaşlarınla haftalık sıralamada yarış. Ücretsiz.';

// <head> etiketini bulur, yoksa oluşturur
function tag(sel, make) {
  let el = document.head.querySelector(sel);
  if (!el) { el = make(); document.head.appendChild(el); }
  return el;
}
const meta = (attr, key) => tag(`meta[${attr}="${key}"]`, () => { const m = document.createElement('meta'); m.setAttribute(attr, key); return m; });

// Sayfa başına başlık, açıklama, canonical ve robots (noindex) yönetimi.
// Oturum gerektiren/özel sayfalar noindex alır; unmount'ta bir sonraki sayfa kendi değerini yazar.
export default function useSEO({ title = DEFAULT_TITLE, description = DEFAULT_DESC, path = '/', noindex = false } = {}) {
  useEffect(() => {
    const url = SITE + (path === '/' ? '/' : path);
    document.title = title;
    meta('name', 'description').setAttribute('content', description);
    meta('name', 'robots').setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');
    tag('link[rel="canonical"]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l; }).setAttribute('href', url);
    meta('property', 'og:title').setAttribute('content', title);
    meta('property', 'og:description').setAttribute('content', description);
    meta('property', 'og:url').setAttribute('content', url);
    meta('name', 'twitter:title').setAttribute('content', title);
    meta('name', 'twitter:description').setAttribute('content', description);
  }, [title, description, path, noindex]);
}
