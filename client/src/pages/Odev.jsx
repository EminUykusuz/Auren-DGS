import { useState } from 'react';
import { Loader2, Download, Paperclip, CalendarClock } from 'lucide-react';
import clsx from 'clsx';
import { put } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';
import { Page, Item, Title, Bar } from '../components/ui.jsx';

const fmtDate = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : '');
const Err = ({ children }) => children ? <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{children}</p> : null;

export default function Odev() {
  const { data, error, reload } = useLoad('/odev/my');
  const [msg, setMsg] = useState('');
  const toggle = async (hw, it) => { setMsg(''); try { await put('/odev/my/' + hw.id + '/items/' + it.id, { done: !it.done }); reload(); } catch (e) { setMsg(e.message); } };
  return (
    <Page className="space-y-4">
      <Title>Haftalık ödevler</Title>
      <Err>{error}</Err><Err>{msg}</Err>
      {!data && !error && <div className="flex justify-center py-10 text-slate-500" role="status"><Loader2 className="animate-spin" size={18} aria-label="Yükleniyor" /></div>}
      {data && data.homework.length === 0 && <Item className="card text-sm text-slate-400">Henüz sınıfına ödev verilmedi.</Item>}
      {data?.homework.map(h => {
        const done = h.items.filter(i => i.done).length;
        return (
          <Item key={h.id} className="card space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="mr-auto"><p className="text-lg font-semibold text-slate-100">{h.title}</p>
                {h.dueDate && <p className="flex items-center gap-1.5 text-xs text-slate-400"><CalendarClock size={13} />Teslim: {fmtDate(h.dueDate)}</p>}</div>
              <a className="btn-ghost" href={'/api/odev/homework/' + h.id + '/sheet.xlsx'} download><Download size={14} />Excel</a>
              {h.fileName && <a className="btn-ghost" href={'/api/odev/homework/' + h.id + '/file'} download><Paperclip size={14} />{h.fileName}</a>}
            </div>
            {h.note && <p className="text-sm text-slate-400">{h.note}</p>}
            <Bar percent={h.items.length ? done / h.items.length * 100 : 0} label={done + '/' + h.items.length + ' madde tamam'} />
            <ul className="space-y-1.5">
              {h.items.map(i => (
                <li key={i.id}><label className={clsx('flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5', i.done && 'text-slate-500 line-through')}>
                  <input type="checkbox" className="!w-auto" checked={i.done} onChange={() => toggle(h, i)} />
                  <span className="mr-auto text-sm">{i.topic}</span>{i.target && <span className="num text-xs text-slate-500">{i.target} soru</span>}</label></li>))}
            </ul>
          </Item>);
      })}
    </Page>
  );
}
