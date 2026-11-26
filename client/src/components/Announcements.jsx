import { useState } from 'react';
import { Megaphone, Check } from 'lucide-react';
import clsx from 'clsx';
import { post } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';
import { Item } from './ui.jsx';

// Kurum öğrencisinin ana sayfasındaki duyurular: okunmamışlar vurgulanır; "Okudum" ile işaretlenir.
export default function Announcements() {
  const { data, reload } = useLoad('/duyuru/my');
  const [err, setErr] = useState('');
  if (!data || data.announcements.length === 0) return null;
  const read = async (a) => { setErr(''); try { await post('/duyuru/my/' + a.id + '/read'); reload(); } catch (e) { setErr(e.message); } };
  return (
    <Item className="card space-y-3">
      <div className="stat-label flex items-center gap-2"><Megaphone size={13} className="text-accent" />Duyurular{data.unread > 0 && <span className="badge bg-accent/15 text-accent">{data.unread} yeni</span>}</div>
      <ul className="space-y-2">
        {data.announcements.slice(0, 5).map(a => (
          <li key={a.id} className={clsx('rounded-2xl border px-4 py-3', a.read ? 'border-white/5 bg-white/[.02]' : 'border-accent/30 bg-accent/[.06]')}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto font-semibold text-slate-100">{a.title}</p>
              <span className="text-xs text-slate-500">{a.className ?? 'Tüm kurum'} · {new Date(a.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-300">{a.body}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">{a.author && <span>{a.author}</span>}
              {!a.read && <button className="btn-ghost !px-3 !py-1 text-xs" onClick={() => read(a)}><Check size={12} />Okudum</button>}</div>
          </li>))}
      </ul>
      {err && <p role="alert" className="text-xs text-red-300">{err}</p>}
    </Item>
  );
}
