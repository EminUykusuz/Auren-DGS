// Cookie tabanlı oturum: token JS'ten erişilemez (HttpOnly)
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export async function api(method, path, body) {
  const res = await fetch(BASE + '/api' + path, {
    method, credentials: BASE ? 'include' : 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.details?.map(d => (d.path ? d.path + ': ' : '') + d.message).join(' · ');
    throw Object.assign(new Error(detail || data.error || 'İstek başarısız'), { status: res.status });
  }
  return data;
}
export const get = p => api('GET', p);
export const post = (p, b) => api('POST', p, b ?? {});
export const put = (p, b) => api('PUT', p, b);
export const del = p => api('DELETE', p);

// Sunucudaki calc.js ile aynı formül (yalnızca önizleme; kayıtta sunucu yeniden hesaplar)
export const net = (c, w) => (c * 4 - w) / 4;
export const fmt = n => Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
