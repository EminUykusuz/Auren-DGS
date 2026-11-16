// Hazır avatarlar: DiceBear (api.dicebear.com) SVG adresleri. Keyfi URL kabul edilmez:
// yalnızca bu stiller ve basit "seed" değerleri geçerlidir (izleme pikseli / zararlı adres engellenir).
export const AVATAR_STYLES = ['adventurer', 'avataaars', 'bottts', 'fun-emoji', 'lorelei', 'notionists', 'thumbs', 'big-smile'];
export const AVATAR_RE = new RegExp(String.raw`^https://api\.dicebear\.com/9\.x/(${AVATAR_STYLES.join('|')})/svg\?seed=[A-Za-z0-9]{1,24}$`);
export const isAvatar = (u) => typeof u === 'string' && AVATAR_RE.test(u);
