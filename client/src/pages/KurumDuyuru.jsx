import { useState } from 'react';
import { Loader2, Megaphone, Trash2, Send } from 'lucide-react';
import { post, del } from '../lib/api.js';
import { useAuth } from '../store.js';
import { useLoad } from '../lib/useLoad.js';
import { Item } from '../components/ui.jsx';

const Err = ({ children }) => children ? <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{children}</p> : null;

export default function KurumDuyuru() {
  const { user } = useAuth(); const owner = user.role === 'owner';
  const cls = useLoad('/kurum/classes'); const { data, error, reload } = useLoad('/duyuru');
  const classes = (cls.data?.classes ?? []).filter(c => !c.isArchived);
  const [f, setF] = useState({ title: '', body: '', classId: owner ? '' : 'first', expiresAt: '' });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const target = f.classId === 'first' ? classes[0]?.id ?? '' : f.classId;
  const send = async (e) => {
    e.preventDefault(); setMsg(''); setBusy(true);
    try { await post('/duyuru', { title: f.title, body: f.body, classId: target ? Number(target) : null, expiresAt: f.expiresAt || null }); setF(p => ({ ...p, title: '', body: '', expiresAt: '' })); reload(); }
    catch (er) { setMsg(er.message); } finally { setBusy(false); }
  };
  const remove = async (a) => { if (!confirm('“' + a.title + '” duyurusu silinsin mi?')) return; setMsg(''); try { await del('/duyuru/' + a.id); reload(); } catch (er) { setMsg(er.message); } };
  if (error) return <Err>{error}</Err>;
  if (!data || !cls.data) return <div className="flex justify-center py-10 text-slate-500" role="status"><Loader2 className="animate-spin" size={18} aria-label="Yükleniyor" /></div>;
  return (<>
    <Item className="card">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={send}>
        <div><label htmlFor="d-cl">Kime?</label>
          <select id="d-cl" value={target} onChange={e => setF(p => ({ ...p, classId: e.target.value }))}>{owner && <option value="">Tüm kurum</option>}{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label htmlFor="d-ex">Son gösterim tarihi (isteğe bağlı)</label><input id="d-ex" type="date" value={f.expiresAt} onChange={set('expiresAt')} /></div>
        <div className="sm:col-span-2"><label htmlFor="d-t">Başlık</label><input id="d-t" value={f.title} onChange={set('title')} maxLength={120} required placeholder="ör. Cumartesi deneme sınavı" /></div>
        <div className="sm:col-span-2"><label htmlFor="d-b">Duyuru</label><textarea id="d-b" rows={4} value={f.body} onChange={set('body')} maxLength={2000} required /></div>
        <div className="flex items-center gap-3 sm:col-span-2"><button className="btn" disabled={busy || f.title.trim().length < 2 || f.body.trim().length < 2 || (!owner && !target)}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}Yayınla</button><Err>{msg}</Err></div>
      </form>
    </Item>
    <Item className="card !p-0 overflow-hidden">
      {data.announcements.length === 0 ? <p className="p-6 text-sm text-slate-400">Henüz duyuru yok. Yayınladığın duyuru öğrencilerin ana sayfasında görünür.</p> : data.announcements.map(a => (
        <div key={a.id} className="flex flex-wrap items-start gap-3 border-b border-white/5 px-4 py-3 last:border-0">
          <Megaphone size={16} className="mt-1 text-accent" />
          <div className="mr-auto min-w-[200px]"><p className="font-semibold text-slate-100">{a.title}{a.expired && <span className="badge ml-2 bg-white/10 text-slate-400">süresi doldu</span>}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-300">{a.body}</p>
            <p className="mt-1 text-xs text-slate-500">{a.className ?? 'Tüm kurum'} · {a.author} · {new Date(a.createdAt).toLocaleDateString('tr-TR')} · {a.read}/{a.audience} öğrenci okudu</p></div>
          {(owner || a.mine) && <button className="btn-ghost !text-red-300" onClick={() => remove(a)} aria-label="Duyuruyu sil"><Trash2 size={14} /></button>}
        </div>))}
    </Item>
  </>);
}
