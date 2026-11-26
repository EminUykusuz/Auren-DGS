import { useState } from 'react';
import { Loader2, Download, Paperclip, CalendarClock, CheckCircle2, Undo2, MessageSquare, User, Users } from 'lucide-react';
import clsx from 'clsx';
import { put, post } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';
import { Page, Item, Title, Bar } from '../components/ui.jsx';
import { ThreadList, Pill, fmtDate } from '../components/HwThread.jsx';

const Err = ({ children }) => children ? <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{children}</p> : null;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

// Teslim tarihini öğretmenle konuşma: yeni tarih iste ya da not yaz
function DueTalk({ hw, onDone }) {
  const [open, setOpen] = useState(hw.requestOpen);
  const [body, setBody] = useState(''); const [due, setDue] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const min = iso(new Date(Date.now() + 864e5));
  const send = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await post('/odev/my/' + hw.id + '/thread', { body, proposedDue: due || null }); setBody(''); setDue(''); onDone(); }
    catch (er) { setErr(er.message); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.03]">
      <button type="button" className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-slate-300" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <MessageSquare size={15} className="text-accent" /><span className="mr-auto">Teslim tarihini öğretmenle konuş</span>
        {hw.requestOpen && <Pill tone="amber">Yanıt bekleniyor</Pill>}{!hw.requestOpen && hw.thread.length > 0 && <Pill>{hw.thread.length}</Pill>}
      </button>
      {open && (
        <div className="space-y-3 border-t border-white/10 p-3.5">
          <ThreadList thread={hw.thread} me="student" />
          <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={send}>
            <div><label htmlFor={'m' + hw.id} className="sr-only">Mesaj</label><input id={'m' + hw.id} value={body} onChange={e => setBody(e.target.value)} maxLength={500} placeholder="Mesaj (ör. neden süre istediğin)" /></div>
            <div><label htmlFor={'d' + hw.id} className="sr-only">İstediğin yeni tarih</label><input id={'d' + hw.id} type="date" min={min} value={due} onChange={e => setDue(e.target.value)} disabled={hw.requestOpen} title={hw.requestOpen ? 'Bekleyen talebin var' : 'İstediğin yeni teslim tarihi'} /></div>
            <button className="btn" disabled={busy || (!body.trim() && !due)}>{busy ? <Loader2 className="animate-spin" size={15} /> : null}{due ? 'Tarih iste' : 'Gönder'}</button>
          </form>
          <Err>{err}</Err>
        </div>)}
    </div>
  );
}

export default function Odev() {
  const { data, error, reload } = useLoad('/odev/my');
  const [msg, setMsg] = useState('');
  const toggle = async (hw, it) => { setMsg(''); try { await put('/odev/my/' + hw.id + '/items/' + it.id, { done: !it.done }); reload(); } catch (e) { setMsg(e.message); } };
  const submit = async (hw, done) => {
    setMsg('');
    if (done && !confirm('“' + hw.title + '” ödevini bitirdiğini onaylıyor musun? Tüm maddeler tamamlandı olarak işaretlenir; öğretmenin bunu görür.')) return;
    try { await post('/odev/my/' + hw.id + '/submit', { done }); reload(); } catch (e) { setMsg(e.message); }
  };
  const s = data?.summary;
  return (
    <Page className="space-y-4">
      <Title>Ödevlerim</Title>
      <Err>{error}</Err><Err>{msg}</Err>
      {!data && !error && <div className="flex justify-center py-10 text-slate-500" role="status"><Loader2 className="animate-spin" size={18} aria-label="Yükleniyor" /></div>}
      {data && data.homework.length === 0 && <Item className="card text-sm text-slate-400">Şu an ödevin yok. Öğretmenin ödev verince burada görünür.</Item>}
      {s && s.total > 0 && (
        <Item className="card space-y-3">
          <p className="text-lg font-semibold text-slate-100" role="status">
            {s.open > 0 ? <>{s.open} ödevin var · {s.items - s.itemsDone} madde kaldı</> : 'Tüm ödevlerini bitirdin, tebrikler!'}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Pill tone={s.late ? 'red' : 'slate'}>{s.late} gecikmiş</Pill><Pill tone="green">{s.submitted} bitirildi</Pill>
            <Pill>{s.itemsDone}/{s.items} madde tamam</Pill>{s.nextDue && s.open > 0 && <Pill tone="accent">En yakın teslim: {fmtDate(s.nextDue)}</Pill>}
          </div>
          <Bar percent={s.items ? s.itemsDone / s.items * 100 : 0} label={s.itemsDone + '/' + s.items + ' madde tamam'} />
        </Item>)}
      {data?.homework.map(h => {
        const done = h.items.filter(i => i.done).length;
        const changed = h.originalDue && h.dueDate && h.originalDue !== h.dueDate;
        return (
          <Item key={h.id} className="card space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="mr-auto min-w-[200px]">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  {h.kind === 'personal' ? <Pill tone="accent"><User size={11} className="mr-1" />Sana özel</Pill> : <Pill><Users size={11} className="mr-1" />{h.className ?? 'Sınıf'}</Pill>}
                  {h.status === 'done' && <Pill tone="green"><CheckCircle2 size={11} className="mr-1" />Bitirdin</Pill>}
                  {h.status === 'late' && <Pill tone="red">Gecikti</Pill>}
                </div>
                <p className="text-lg font-semibold text-slate-100">{h.title}</p>
                {h.dueDate && <p className={clsx('flex flex-wrap items-center gap-1.5 text-xs', h.status === 'late' ? 'text-red-300' : 'text-slate-400')}><CalendarClock size={13} />Teslim: {fmtDate(h.dueDate)}{changed && <span className="text-slate-500">(ilk tarih {fmtDate(h.originalDue)})</span>}</p>}
              </div>
              <a className="btn-ghost" href={'/api/odev/homework/' + h.id + '/sheet.xlsx'} download><Download size={14} />Excel</a>
              {h.fileName && <a className="btn-ghost" href={'/api/odev/homework/' + h.id + '/file'} download><Paperclip size={14} />{h.fileName}</a>}
            </div>
            {h.note && <p className="text-sm text-slate-400">{h.note}</p>}
            <Bar percent={h.items.length ? done / h.items.length * 100 : 0} label={done + '/' + h.items.length + ' madde tamam'} />
            <ul className="space-y-1.5">
              {h.items.map(i => (
                <li key={i.id}><label className={clsx('flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5', i.done && 'text-slate-500 line-through')}>
                  <input type="checkbox" className="!w-auto" checked={i.done} onChange={() => toggle(h, i)} />
                  <span className="mr-auto text-sm">{i.topic}</span>{i.target && <span className="num text-xs text-slate-500">{i.target} soru</span>}</label></li>))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              {h.submittedAt
                ? <><span className="text-sm text-emerald-300">Bitirdiğini bildirdin · {new Date(h.submittedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</span><button className="btn-ghost" onClick={() => submit(h, false)}><Undo2 size={14} />Geri al</button></>
                : <button className="btn" onClick={() => submit(h, true)}><CheckCircle2 size={16} />Ödevi bitirdim</button>}
            </div>
            <DueTalk key={h.thread.length + ':' + h.dueDate} hw={h} onDone={reload} />
          </Item>);
      })}
    </Page>
  );
}
