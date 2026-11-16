import { useState } from 'react';

// Hazır avatarlar (DiceBear). Sunucu yalnızca bu kalıba uyan adresleri kabul eder (server/src/avatars.js).
const STYLES = ['adventurer', 'lorelei', 'bottts', 'fun-emoji'];
const SEEDS = ['Mila', 'Kaan', 'Defne', 'Arda', 'Zeynep', 'Emir'];
export const AVATARS = STYLES.flatMap(st => SEEDS.map(seed => `https://api.dicebear.com/9.x/${st}/svg?seed=${seed}`));

// Görsel yüklenemezse (çevrimdışı, engelleyici) baş harfe düşer
export default function Avatar({ name = '?', url, size = 32, className = '' }) {
  const [bad, setBad] = useState(false);
  const box = { width: size, height: size, fontSize: size * 0.4 };
  return url && !bad
    ? <img src={url} alt="" aria-hidden="true" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} style={box} className={`shrink-0 rounded-full bg-white/10 object-cover ${className}`} />
    : <span aria-hidden="true" style={box} className={`flex shrink-0 items-center justify-center rounded-full bg-accent/15 font-bold uppercase text-accent ${className}`}>{name.slice(0, 1)}</span>;
}
