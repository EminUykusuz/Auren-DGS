import { Link } from 'react-router-dom';
import clsx from 'clsx';

// Altlık bağlantıları: Landing, panel ve kayıt ekranında ortak (metinler ayrı, tembel yüklenen Legal.jsx'te)
export const LEGAL_LINKS = [['gizlilik', 'Gizlilik'], ['kvkk', 'KVKK'], ['kosullar', 'Koşullar'], ['cerez', 'Çerezler']];

export default function LegalLinks({ className }) {
  return (
    <nav aria-label="Yasal" className={clsx('flex flex-wrap gap-x-5 gap-y-1', className)}>
      {LEGAL_LINKS.map(([k, l]) => <Link key={k} to={`/${k}`} className="transition hover:text-slate-100 hover:underline">{l}</Link>)}
    </nav>
  );
}
