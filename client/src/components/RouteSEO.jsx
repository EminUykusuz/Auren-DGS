import { useLocation } from 'react-router-dom';
import useSEO, { DEFAULT_TITLE, DEFAULT_DESC } from '../hooks/useSEO.js';
import { LEGAL_TITLES } from '../lib/legal-docs.js';

// Yol → SEO kuralı. Burada olmayan her yol (panel, giriş, kayıt, bilinmeyen) noindex olur.
const PAGES = {
  '/': { title: DEFAULT_TITLE, description: DEFAULT_DESC },
  ...Object.fromEntries(Object.entries(LEGAL_TITLES).map(([k, t]) => ['/' + k, { title: `${t} – Auren Study`, description: `Auren Study ${t}. Verilerinin nasıl işlendiğini ve haklarını öğren.` }])),
};
const NOINDEX = {
  '/giris': 'Giriş yap – Auren Study', '/kayit': 'Kayıt ol – Auren Study', '/sifremi-unuttum': 'Şifremi unuttum – Auren Study', '/reset-password': 'Şifre sıfırla – Auren Study',
};

// Giriş yapmış kullanıcının "/" yolu panel (Dashboard); landing yalnızca oturumsuz görünür → user ile birlikte verilir
export default function RouteSEO({ loggedIn }) {
  const { pathname } = useLocation(); const p = pathname.replace(/(.)\/$/, '$1');
  const page = !loggedIn || p !== '/' ? PAGES[p] : null;
  useSEO(page ? { ...page, path: p } : { title: NOINDEX[p] ?? 'Auren Study', description: DEFAULT_DESC, path: p, noindex: true });
  return null;
}
