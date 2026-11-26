import { useState } from 'react';
import { Loader2, Plus, Trash2, Download, Paperclip, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { post, del } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';
import { Item } from '../components/ui.jsx';

const Err = ({ children }) => children ? <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{children}</p> : null;
const Spin = () => <div className="flex justify-center py-10 text-slate-500" role="status"><Loader2 className="animate-spin" size={18} aria-label="Yükleniyor" /></div>;
const fmtDate = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : '');

// Dosya yükleme: ham bayt olarak gider; sunucu içerik imzasını doğrular (.xlsx / .pdf, ≤2 MB)
async function uploadFile(id, file) {
  const res = await fetch('/api/odev/homework/' + id + '/file?name=' + encodeURIComponent(file.name), { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'Dosya yüklenemedi');
}

// "Konu; hedef" satırları (Excel'den iki sütun yapıştırılırsa sekmeyle ayrılır)
function parseItems(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(.*?)[\t;]\s*(\d{1,4})\s*$/);
    return m ? { topic: m[1].trim(), target: Number(m[2]) } : { topic: l, target: null };
  }).filter(i => i.topic);
}

function Create({ classes, onDone }) {
  const [f, setF] = useState({ classId: classes[0]?.id ?? '', title: '', dueDate: '', note: '', items: '' });
  const [file, setFile] = useState(null); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const items = parseItems(f.items);
  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setBusy(true);
    try {
      const { id } = await post('/odev/homework', { classId: Number(f.classId), title: f.title, note: f.note, dueDate: f.dueDate || null, items });
      if (file) { try { await uploadFile(id, file); } catch (er) { setMsg('Ödev kaydedildi ama dosya yüklenemedi: ' + er.message); } }
      setF(p => ({ ...p, title: '', dueDate: '', note: '', items: '' })); setFile(null); onDone();
    } catch (er) { setMsg(er.message); } finally { setBusy(false); }
  };
  return (
    <Item className="card">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <div><label htmlFor="o-cl">Sınıf</label><select id="o-cl" value={f.classId} onChange={set('classId')} required>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label htmlFor="o-due">Teslim tarihi</label><input id="o-due" type="date" value={f.dueDate} onChange={set('dueDate')} /></div>
        <div className="sm:col-span-2"><label htmlFor="o-t">Başlık</label><input id="o-t" value={f.title} onChange={set('title')} maxLength={120} required placeholder="ör. 12. Hafta ödevi" /></div>
        <div className="sm:col-span-2"><label htmlFor="o-i">Maddeler (her satır: konu; hedef soru)</label>
          <textarea id="o-i" rows={5} value={f.items} onChange={set('items')} placeholder={'Üslü ifadeler; 40\nParagraf; 30\nFiilimsiler'} />
          <p className="mt-1 text-xs text-slate-500">Excel&apos;de iki sütunu (konu, hedef) kopyalayıp yapıştırabilirsin. {items.length > 0 && items.length + ' madde.'}</p></div>
        <div className="sm:col-span-2"><label htmlFor="o-n">Not (isteğe bağlı)</label><textarea id="o-n" rows={2} value={f.note} onChange={set('note')} maxLength={1000} /></div>
        <div className="sm:col-span-2"><label htmlFor="o-f">Dosya eki (Excel veya PDF, en çok 2 MB)</label>
          <input id="o-f" type="file" accept=".xlsx,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          <p className="mt-1 text-xs text-slate-500">Hazır ödev dosyanı yükle; öğrenciler site üzerinden indirir.</p></div>
        <div className="flex items-center gap-3 sm:col-span-2"><button className="btn" disabled={busy || !f.classId || f.title.trim().length < 2 || items.length === 0}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}Ödevi ver</button><Err>{msg}</Err></div>
      </form>
    </Item>
  );
}

function Detail({ id }) {
  const { data, error } = useLoad('/odev/homework/' + id);
  if (error) return <Err>{error}</Err>;
  if (!data) return <Spin />;
  return (
    <div className="overflow-x-auto border-t border-white/10">
      <table className="w-full text-left text-xs">
        <thead><tr className="stat-label"><th className="px-4 py-2">Öğrenci</th>{data.items.map(i => <th key={i.id} className="px-2 py-2">{i.topic}{i.target ? ' (' + i.target + ')' : ''}</th>)}</tr></thead>
        <tbody>{data.students.map(s => (
          <tr key={s.id} className="border-t border-white/5"><td className="px-4 py-2 text-slate-200">{s.name}</td>
            {s.done.map((d, k) => <td key={k} className="px-2 py-2">{d ? <Check size={14} className="text-emerald-400" aria-label="Yapıldı" /> : <span className="text-slate-600">—</span>}</td>)}</tr>))}
          {data.students.length === 0 && <tr><td className="px-4 py-3 text-slate-500">Bu sınıfta öğrenci yok.</td></tr>}</tbody>
      </table>
    </div>
  );
}

export default function KurumOdev() {
  const { data: cl } = useLoad('/kurum/classes');
  const { data, error, reload } = useLoad('/odev/homework');
  const [open, setOpen] = useState(null); const [msg, setMsg] = useState('');
  const remove = async (h) => { if (!confirm('“' + h.title + '” ödevi silinsin mi? Öğrencilerin işaretleri de silinir.')) return; setMsg(''); try { await del('/odev/homework/' + h.id); reload(); } catch (e) { setMsg(e.message); } };
  const attach = async (h, file) => { setMsg(''); if (!file) return; try { await uploadFile(h.id, file); reload(); } catch (e) { setMsg(e.message); } };
  const detach = async (h) => { setMsg(''); try { await del('/odev/homework/' + h.id + '/file'); reload(); } catch (e) { setMsg(e.message); } };
  if (error) return <Err>{error}</Err>;
  if (!data || !cl) return <Spin />;
  const classes = cl.classes.filter(c => !c.isArchived);
  const base = '/api/odev/homework/';
  return (<>
    {classes.length === 0 ? <Item className="card text-sm text-slate-400">Ödev vermek için önce bir sınıf gerekir (öğretmenler için yönetici sınıf atamalı).</Item> : <Create classes={classes} onDone={reload} />}
    <Err>{msg}</Err>
    <Item className="card !p-0 overflow-hidden">
      {data.homework.length === 0 ? <p className="p-6 text-sm text-slate-400">Henüz ödev verilmedi.</p> : data.homework.map(h => (
        <div key={h.id} className="border-b border-white/5 last:border-0">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="mr-auto min-w-[180px]"><p className="font-semibold text-slate-100">{h.title}</p>
              <p className="text-xs text-slate-500">{h.className} · {h.items} madde{h.dueDate ? ' · teslim ' + fmtDate(h.dueDate) : ''} · {h.finished}/{h.students} öğrenci bitirdi</p></div>
            <a className="btn-ghost" href={base + h.id + '/sheet.xlsx'} download><Download size={14} />Ödev kâğıdı</a>
            <a className="btn-ghost" href={base + h.id + '/results.xlsx'} download><Download size={14} />Sonuçlar</a>
            {h.fileName
              ? <><a className="btn-ghost" href={base + h.id + '/file'} download><Paperclip size={14} />{h.fileName}</a><button className="btn-ghost" onClick={() => detach(h)} aria-label="Dosya ekini kaldır"><Trash2 size={14} /></button></>
              : <label className="btn-ghost cursor-pointer"><Paperclip size={14} />Dosya ekle<input type="file" accept=".xlsx,.pdf" className="sr-only" onChange={e => attach(h, e.target.files?.[0])} /></label>}
            <button className="btn-ghost" onClick={() => setOpen(open === h.id ? null : h.id)} aria-expanded={open === h.id} aria-label="Öğrenci durumunu aç/kapat">{open === h.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
            <button className="btn-ghost !text-red-300" onClick={() => remove(h)} aria-label="Ödevi sil"><Trash2 size={14} /></button>
          </div>
          {open === h.id && <Detail id={h.id} />}
        </div>))}
    </Item>
  </>);
}
