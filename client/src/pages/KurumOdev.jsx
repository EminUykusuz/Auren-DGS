import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2, Plus, Trash2, Download, Paperclip, ChevronDown, ChevronUp, Check, FileSpreadsheet, X, Upload, Users, User, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { post, del } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';
import { Item } from '../components/ui.jsx';
import { ThreadList, Pill, fmtDate, fmtDay } from '../components/HwThread.jsx';

const Err = ({ children }) => children ? <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{children}</p> : null;
const Spin = () => <div className="flex justify-center py-10 text-slate-500" role="status"><Loader2 className="animate-spin" size={18} aria-label="Yükleniyor" /></div>;

// Ham bayt gönderen yardımcılar (dosya ya da yapıştırılan metin); sunucu içeriği kendisi doğrular
async function sendRaw(method, path, body) {
  const res = await fetch('/api' + path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream' }, body });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'İşlem başarısız');
  return d;
}
const uploadFile = (id, file) => sendRaw('PUT', '/odev/homework/' + id + '/file?name=' + encodeURIComponent(file.name), file);

// "Konu; hedef" satırları (Excel'den iki sütun yapıştırılırsa sekmeyle ayrılır)
function parseItems(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(.*?)[\t;]\s*(\d{1,4})\s*$/);
    return m ? { topic: m[1].trim(), target: Number(m[2]) } : { topic: l, target: null };
  }).filter(i => i.topic);
}

/* ---------- Sınıf ödevi ver ---------- */
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

/* ---------- Kişiye özel ödev ver ---------- */
function PersonalCreate({ onDone, preselect }) {
  const [f, setF] = useState({ title: '', dueDate: '', note: '' });
  const [source, setSource] = useState(preselect?.length ? 'manual' : 'excel');               // excel | manual
  const [paste, setPaste] = useState(''); const [list, setList] = useState(null);   // list: önizleme { assignments, errors }
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const preview = async (body) => {
    setMsg(''); setBusy(true);
    try { const r = await sendRaw('POST', '/odev/homework/personal/preview', body); setList({ assignments: r.assignments, errors: r.errors }); if (!r.assignments.length) setMsg('Dosyada ödev verilecek öğrenci bulunamadı.'); }
    catch (e) { setMsg(e.message); setList(null); } finally { setBusy(false); }
  };
  const commit = async () => {
    setMsg(''); setBusy(true);
    try {
      const r = await post('/odev/homework/personal', { title: f.title, note: f.note, dueDate: f.dueDate || null,
        assignments: list.assignments.map(a => ({ studentId: a.studentId, dueDate: a.dueDate || null, items: a.items })) });
      setList(null); setPaste(''); setF({ title: '', dueDate: '', note: '' }); setMsg(r.created + ' öğrenciye kişiye özel ödev verildi.'); onDone();
    } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  const patch = (i, d) => setList(l => ({ ...l, assignments: l.assignments.map((a, k) => (k === i ? { ...a, ...d } : a)) }));
  const total = list?.assignments.reduce((n, a) => n + a.items.length, 0) ?? 0;
  return (
    <Item className="card space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><label htmlFor="p-t">Başlık</label><input id="p-t" value={f.title} onChange={set('title')} maxLength={120} placeholder="ör. 12. Hafta · kişiye özel" /></div>
        <div><label htmlFor="p-due">Ortak teslim tarihi</label><input id="p-due" type="date" value={f.dueDate} onChange={set('dueDate')} /><p className="mt-1 text-xs text-slate-500">Excel&apos;de satırın kendi tarihi varsa o geçerli olur.</p></div>
        <div><label htmlFor="p-n">Not (isteğe bağlı)</label><input id="p-n" value={f.note} onChange={set('note')} maxLength={1000} /></div>
      </div>

      <div role="tablist" aria-label="Öğrenci kaynağı" className="glass-pill flex w-fit gap-1 p-1 text-sm">
        {[['excel', 'Excel / liste yükle', FileSpreadsheet], ['manual', 'Öğrenci seç', Users]].map(([k, l, Icon]) => (
          <button key={k} role="tab" aria-selected={source === k} onClick={() => { setSource(k); setList(null); setMsg(''); }} className={clsx('flex items-center gap-2 rounded-full px-4 py-1.5 transition', source === k ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200')}><Icon size={15} />{l}</button>))}
      </div>

      {source === 'excel' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Her satır bir öğrencinin bir konusudur: <b className="text-slate-200">Öğrenci no, Ad soyad, Konu, Hedef soru, Teslim tarihi</b>. Önce şablonu indir; öğrencilerin hazır gelir, sen yalnızca Konu sütununu doldurursun.</p>
          <div className="flex flex-wrap items-center gap-3">
            <a className="btn-ghost" href="/api/odev/homework/personal/template.xlsx" download><Download size={14} />Şablonu indir (öğrencilerle dolu)</a>
            <label className={clsx('btn cursor-pointer', busy && 'pointer-events-none opacity-60')}><Upload size={15} />Excel / CSV yükle
              <input type="file" accept=".xlsx,.csv,.txt,.tsv" className="sr-only" onChange={e => { const x = e.target.files?.[0]; e.target.value = ''; if (x) preview(x); }} /></label>
          </div>
          <details className="text-sm text-slate-400"><summary className="cursor-pointer select-none text-slate-300">Ya da Excel&apos;den kopyalayıp yapıştır</summary>
            <textarea className="mt-2" rows={4} value={paste} onChange={e => setPaste(e.target.value)} aria-label="Yapıştırılan liste" placeholder={'101\tAyşe Yılmaz\tÜslü ifadeler\t40\t18.12.2026\n102\tMehmet Kaya\tParagraf\t30'} />
            <button className="btn-ghost mt-2" disabled={busy || !paste.trim()} onClick={() => preview(new Blob([paste]))}>Listeyi oku</button></details>
        </div>)}
      {source === 'manual' && <ManualPick initial={preselect} onPick={(assignments) => { setList({ assignments, errors: [] }); setMsg(''); }} />}

      {list && (
        <div className="space-y-3">
          {list.errors.length > 0 && (
            <details className="rounded-2xl bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200" open={list.assignments.length === 0}>
              <summary className="cursor-pointer select-none font-medium">{list.errors.length} satır atlandı</summary>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">{list.errors.slice(0, 30).map((e, i) => <li key={i}>Satır {e.line}: {e.message}</li>)}{list.errors.length > 30 && <li>… ve {list.errors.length - 30} satır daha</li>}</ul></details>)}
          {list.assignments.length > 0 && (<>
            <p className="text-sm text-slate-300"><b>{list.assignments.length}</b> öğrenciye toplam <b>{total}</b> madde verilecek. Göndermeden önce kontrol et.</p>
            <div className="max-h-[420px] overflow-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-900/90 backdrop-blur"><tr className="stat-label"><th className="px-3 py-2">Öğrenci</th><th className="px-3 py-2">Konular</th><th className="px-3 py-2">Teslim</th><th className="w-8" /></tr></thead>
                <tbody>{list.assignments.map((a, i) => (
                  <tr key={a.studentId} className="border-t border-white/5 align-top">
                    <td className="px-3 py-2 text-slate-200">{a.name}<span className="block text-slate-500">{[a.no, a.className].filter(Boolean).join(' · ')}</span></td>
                    <td className="px-3 py-2 text-slate-300">{a.items.map((it, k) => <span key={k} className="block">{it.topic}{it.target ? <span className="num text-slate-500"> · {it.target}</span> : ''}</span>)}</td>
                    <td className="px-3 py-2"><input type="date" aria-label={a.name + ' teslim tarihi'} value={a.dueDate ?? ''} onChange={e => patch(i, { dueDate: e.target.value || null })} className="!min-w-[8.5rem] !py-1 text-xs" /></td>
                    <td className="px-1 py-2"><button className="btn-ghost !p-1.5" aria-label={a.name + ' listeden çıkar'} onClick={() => setList(l => ({ ...l, assignments: l.assignments.filter((_, k) => k !== i) }))}><X size={13} /></button></td>
                  </tr>))}</tbody>
              </table>
            </div>
            <button className="btn" disabled={busy || f.title.trim().length < 2} onClick={commit}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}{list.assignments.length} öğrenciye gönder</button>
            {f.title.trim().length < 2 && <span className="ml-3 text-xs text-slate-500">Önce başlık yaz.</span>}
          </>)}
        </div>)}
      <Err>{msg && !msg.includes('verildi') ? msg : ''}</Err>
      {msg.includes('verildi') && <p role="status" className="rounded-2xl bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300">{msg}</p>}
    </Item>
  );
}

// Elle seçim: öğrencileri işaretle, ortak maddeleri yaz (ya da her öğrenciye aynı listeyi ver)
function ManualPick({ onPick, initial }) {
  const { data, error } = useLoad('/kurum/students');
  const [q, setQ] = useState(''); const [sel, setSel] = useState(() => new Set(initial ?? [])); const [text, setText] = useState('');
  const students = useMemo(() => (data?.students ?? []).filter(s => !s.isDisabled), [data]);
  const shown = students.filter(s => !q || (s.fullName + ' ' + s.username + ' ' + (s.studentNo ?? '') + ' ' + (s.className ?? '')).toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')));
  const items = parseItems(text);
  const toggle = (id) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  if (error) return <Err>{error}</Err>;
  if (!data) return <Spin />;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="pm-q">Öğrenci ara</label><input id="pm-q" value={q} onChange={e => setQ(e.target.value)} placeholder="ad, numara ya da sınıf" />
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400"><button type="button" className="btn-ghost !px-2.5 !py-1" onClick={() => setSel(p => new Set([...p, ...shown.map(s => s.id)]))}>Görünenleri seç</button>
            <button type="button" className="btn-ghost !px-2.5 !py-1" onClick={() => setSel(new Set())}>Temizle</button><span className="ml-auto">{sel.size} seçili</span></div>
          <ul className="mt-2 max-h-64 space-y-0.5 overflow-auto rounded-2xl border border-white/10 p-1.5">
            {shown.map(s => (
              <li key={s.id}><label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
                <input type="checkbox" className="!w-auto" checked={sel.has(s.id)} onChange={() => toggle(s.id)} />
                <span className="mr-auto text-sm text-slate-200">{s.fullName || s.username}</span><span className="text-xs text-slate-500">{[s.studentNo, s.className].filter(Boolean).join(' · ')}</span></label></li>))}
            {shown.length === 0 && <li className="px-2 py-3 text-sm text-slate-500">Öğrenci bulunamadı.</li>}
          </ul>
        </div>
        <div><label htmlFor="pm-i">Maddeler (her satır: konu; hedef soru)</label>
          <textarea id="pm-i" rows={9} value={text} onChange={e => setText(e.target.value)} placeholder={'Üslü ifadeler; 40\nParagraf; 30'} />
          <p className="mt-1 text-xs text-slate-500">Seçtiğin her öğrenciye bu liste verilir; sonraki adımda öğrenci başına tarihi düzenleyebilirsin. {items.length > 0 && items.length + ' madde.'}</p></div>
      </div>
      <button type="button" className="btn-ghost" disabled={sel.size === 0 || items.length === 0}
        onClick={() => onPick(students.filter(s => sel.has(s.id)).map(s => ({ studentId: s.id, name: s.fullName || s.username, no: s.studentNo ?? '', className: s.className ?? null, items, dueDate: null })))}>Listeyi hazırla ({sel.size})</button>
    </div>
  );
}

/* ---------- Teslim tarihi görüşmesi (öğretmen) ---------- */
function StaffThread({ hwId, userId, onChange }) {
  const { data, error, reload } = useLoad('/odev/homework/' + hwId + '/thread/' + userId);
  const [body, setBody] = useState(''); const [due, setDue] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  if (error) return <Err>{error}</Err>;
  if (!data) return <Spin />;
  const last = [...data.thread].reverse().find(t => ['request', 'accept', 'reject', 'set'].includes(t.kind));
  const pending = last?.kind === 'request' ? last : null;
  const act = async (action, extra = {}) => {
    setMsg(''); setBusy(true);
    try { await post('/odev/homework/' + hwId + '/thread/' + userId, { action, body, ...extra }); setBody(''); setDue(''); reload(); onChange(); }
    catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3 rounded-2xl bg-white/[.03] p-3.5">
      <p className="text-xs text-slate-400">{data.student.name} · geçerli teslim: <b className="text-slate-200">{fmtDay(data.dueDate) || 'tarih yok'}</b>{data.originalDue && data.originalDue !== data.dueDate && ' (ilk tarih ' + fmtDay(data.originalDue) + ')'}</p>
      <ThreadList thread={data.thread} me="staff" />
      {pending && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-100">
          <span className="mr-auto">Öğrenci <b>{fmtDay(pending.proposedDue)}</b> tarihini istiyor.</span>
          <button className="btn !py-1.5" disabled={busy} onClick={() => act('accept')}><Check size={14} />Kabul et</button>
          <button className="btn-ghost !py-1.5" disabled={busy} onClick={() => act('reject')}>Reddet</button>
        </div>)}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div><label htmlFor={'sm' + hwId + userId} className="sr-only">Mesaj</label><input id={'sm' + hwId + userId} value={body} onChange={e => setBody(e.target.value)} maxLength={500} placeholder="Öğrenciye mesaj (isteğe bağlı)" /></div>
        <div><label htmlFor={'sd' + hwId + userId} className="sr-only">Yeni teslim tarihi</label><input id={'sd' + hwId + userId} type="date" value={due} onChange={e => setDue(e.target.value)} /></div>
        <button className="btn-ghost" disabled={busy || !due} onClick={() => act('set', { dueDate: due })}>Tarihi belirle</button>
        <button className="btn-ghost" disabled={busy || !body.trim()} onClick={() => act('msg')}>Mesaj gönder</button>
      </div>
      <Err>{msg}</Err>
    </div>
  );
}

const StatusCell = ({ s }) => (s.submittedAt ? <Pill tone="green">Bitirdi</Pill> : s.requestOpen ? <Pill tone="amber">Tarih talebi</Pill> : <span className="text-slate-600">—</span>);

/* ---------- Sınıf ödevi: öğrenci × madde tablosu ---------- */
function Detail({ id, onChange }) {
  const { data, error, reload } = useLoad('/odev/homework/' + id);
  const [talk, setTalk] = useState(null);
  if (error) return <Err>{error}</Err>;
  if (!data) return <Spin />;
  return (
    <div className="border-t border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="stat-label"><th className="px-4 py-2">Öğrenci</th>{data.items.map(i => <th key={i.id} className="px-2 py-2">{i.topic}{i.target ? ' (' + i.target + ')' : ''}</th>)}<th className="px-2 py-2">Teslim</th><th className="px-2 py-2">Durum</th><th className="w-10" /></tr></thead>
          <tbody>{data.students.map(s => (
            <tr key={s.id} className="border-t border-white/5"><td className="whitespace-nowrap px-4 py-2 text-slate-200">{s.name}</td>
              {s.done.map((d, k) => <td key={k} className="px-2 py-2">{d ? <Check size={14} className="text-emerald-400" aria-label="Yapıldı" /> : <span className="text-slate-600">—</span>}</td>)}
              <td className="whitespace-nowrap px-2 py-2 text-slate-300">{fmtDate(s.dueDate) || '—'}</td><td className="px-2 py-2"><StatusCell s={s} /></td>
              <td className="px-2 py-2"><button className={clsx('btn-ghost !p-1.5', s.requestOpen && '!text-amber-300')} aria-label={s.name + ' ile teslim tarihini konuş'} aria-expanded={talk === s.id} onClick={() => setTalk(talk === s.id ? null : s.id)}><MessageSquare size={13} /></button></td></tr>))}
            {data.students.length === 0 && <tr><td className="px-4 py-3 text-slate-500">Bu sınıfta öğrenci yok.</td></tr>}</tbody>
        </table>
      </div>
      {talk && <div className="p-3"><StaffThread hwId={id} userId={talk} onChange={() => { reload(); onChange(); }} /></div>}
    </div>
  );
}

/* ---------- Kişiye özel paket: öğrenci başına satır ---------- */
function BatchDetail({ batchId, onChange }) {
  const { data, error, reload } = useLoad('/odev/batch/' + batchId);
  const [talk, setTalk] = useState(null);
  if (error) return <Err>{error}</Err>;
  if (!data) return <Spin />;
  return (
    <div className="border-t border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="stat-label"><th className="px-4 py-2">Öğrenci</th><th className="px-2 py-2">Konular</th><th className="px-2 py-2">İlerleme</th><th className="px-2 py-2">Teslim</th><th className="px-2 py-2">Durum</th><th className="w-10" /></tr></thead>
          <tbody>{data.students.map(s => {
            const n = s.items.filter(i => i.done).length;
            return (
              <tr key={s.homeworkId} className="border-t border-white/5 align-top">
                <td className="whitespace-nowrap px-4 py-2 text-slate-200">{s.name}<span className="block text-slate-500">{[s.studentNo, s.className].filter(Boolean).join(' · ')}</span></td>
                <td className="px-2 py-2 text-slate-300">{s.items.map(i => <span key={i.id} className={clsx('block', i.done && 'text-slate-500 line-through')}>{i.topic}{i.target ? <span className="num text-slate-500"> · {i.target}</span> : ''}</span>)}</td>
                <td className="whitespace-nowrap px-2 py-2 num text-slate-300">{n}/{s.items.length}</td>
                <td className="whitespace-nowrap px-2 py-2 text-slate-300">{fmtDate(s.dueDate) || '—'}</td><td className="px-2 py-2"><StatusCell s={s} /></td>
                <td className="px-2 py-2"><button className={clsx('btn-ghost !p-1.5', s.requestOpen && '!text-amber-300')} aria-label={s.name + ' ile teslim tarihini konuş'} aria-expanded={talk === s.homeworkId} onClick={() => setTalk(talk === s.homeworkId ? null : s.homeworkId)}><MessageSquare size={13} /></button></td></tr>);
          })}</tbody>
        </table>
      </div>
      {talk && (() => { const s = data.students.find(x => x.homeworkId === talk); return s ? <div className="p-3"><StaffThread hwId={s.homeworkId} userId={s.id} onChange={() => { reload(); onChange(); }} /></div> : null; })()}
    </div>
  );
}

export default function KurumOdev() {
  const { data: cl } = useLoad('/kurum/classes');
  const { data, error, reload } = useLoad('/odev/homework');
  const pre = useLocation().state?.studentIds;                // öğrenci listesinden "Ödev ver" ile gelen seçim
  const [mode, setMode] = useState(pre?.length ? 'personal' : 'class');   // class | personal
  const [open, setOpen] = useState(null); const [msg, setMsg] = useState('');
  const remove = async (h) => { if (!confirm('“' + h.title + '” ödevi silinsin mi? Öğrencilerin işaretleri de silinir.')) return; setMsg(''); try { await del('/odev/homework/' + h.id); reload(); } catch (e) { setMsg(e.message); } };
  const removeBatch = async (b) => { if (!confirm('“' + b.title + '” paketindeki ' + b.students + ' kişisel ödev silinsin mi? İşaretler ve yazışmalar da silinir.')) return; setMsg(''); try { await del('/odev/batch/' + b.batchId); reload(); } catch (e) { setMsg(e.message); } };
  const attach = async (h, file) => { setMsg(''); if (!file) return; try { await uploadFile(h.id, file); reload(); } catch (e) { setMsg(e.message); } };
  const detach = async (h) => { setMsg(''); try { await del('/odev/homework/' + h.id + '/file'); reload(); } catch (e) { setMsg(e.message); } };
  if (error) return <Err>{error}</Err>;
  if (!data || !cl) return <Spin />;
  const classes = cl.classes.filter(c => !c.isArchived);
  const base = '/api/odev/homework/';
  return (<>
    <Item className="glass-pill mx-auto flex w-fit gap-1 p-1 text-sm" >
      {[['class', 'Sınıfa ödev', Users], ['personal', 'Kişiye özel ödev', User]].map(([k, l, Icon]) => (
        <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)} className={clsx('flex items-center gap-2 rounded-full px-4 py-2 transition', mode === k ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200')}><Icon size={15} />{l}</button>))}
    </Item>
    {mode === 'class'
      ? (classes.length === 0 ? <Item className="card text-sm text-slate-400">Ödev vermek için önce bir sınıf gerekir (öğretmenler için yönetici sınıf atamalı).</Item> : <Create classes={classes} onDone={reload} />)
      : <PersonalCreate onDone={reload} preselect={pre} />}
    <Err>{msg}</Err>

    {data.batches.length > 0 && (
      <Item className="card !p-0 overflow-hidden">
        <p className="stat-label px-4 pt-3">Kişiye özel ödevler</p>
        {data.batches.map(b => (
          <div key={b.batchId} className="border-b border-white/5 last:border-0">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="mr-auto min-w-[180px]"><p className="flex flex-wrap items-center gap-2 font-semibold text-slate-100">{b.title}{b.requests > 0 && <Pill tone="amber">{b.requests} tarih talebi</Pill>}</p>
                <p className="text-xs text-slate-500">{b.students} öğrenci · {b.items} madde{b.dueFrom ? ' · teslim ' + fmtDate(b.dueFrom) + (b.dueTo && b.dueTo !== b.dueFrom ? ' – ' + fmtDate(b.dueTo) : '') : ''} · {b.finished}/{b.students} bitirdi</p></div>
              <a className="btn-ghost" href={'/api/odev/batch/' + b.batchId + '/results.xlsx'} download><Download size={14} />Sonuçlar</a>
              <button className="btn-ghost" onClick={() => setOpen(open === b.batchId ? null : b.batchId)} aria-expanded={open === b.batchId} aria-label="Öğrenci durumunu aç/kapat">{open === b.batchId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
              <button className="btn-ghost !text-red-300" onClick={() => removeBatch(b)} aria-label="Paketi sil"><Trash2 size={14} /></button>
            </div>
            {open === b.batchId && <BatchDetail batchId={b.batchId} onChange={reload} />}
          </div>))}
      </Item>)}

    <Item className="card !p-0 overflow-hidden">
      <p className="stat-label px-4 pt-3">Sınıf ödevleri</p>
      {data.homework.length === 0 ? <p className="p-6 text-sm text-slate-400">Henüz sınıf ödevi verilmedi.</p> : data.homework.map(h => (
        <div key={h.id} className="border-b border-white/5 last:border-0">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="mr-auto min-w-[180px]"><p className="flex flex-wrap items-center gap-2 font-semibold text-slate-100">{h.title}{h.requests > 0 && <Pill tone="amber">{h.requests} tarih talebi</Pill>}</p>
              <p className="text-xs text-slate-500">{h.className} · {h.items} madde{h.dueDate ? ' · teslim ' + fmtDate(h.dueDate) : ''} · {h.finished}/{h.students} öğrenci bitirdi</p></div>
            <a className="btn-ghost" href={base + h.id + '/sheet.xlsx'} download><Download size={14} />Ödev kâğıdı</a>
            <a className="btn-ghost" href={base + h.id + '/results.xlsx'} download><Download size={14} />Sonuçlar</a>
            {h.fileName
              ? <><a className="btn-ghost" href={base + h.id + '/file'} download><Paperclip size={14} />{h.fileName}</a><button className="btn-ghost" onClick={() => detach(h)} aria-label="Dosya ekini kaldır"><Trash2 size={14} /></button></>
              : <label className="btn-ghost cursor-pointer"><Paperclip size={14} />Dosya ekle<input type="file" accept=".xlsx,.pdf" className="sr-only" onChange={e => attach(h, e.target.files?.[0])} /></label>}
            <button className="btn-ghost" onClick={() => setOpen(open === h.id ? null : h.id)} aria-expanded={open === h.id} aria-label="Öğrenci durumunu aç/kapat">{open === h.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
            <button className="btn-ghost !text-red-300" onClick={() => remove(h)} aria-label="Ödevi sil"><Trash2 size={14} /></button>
          </div>
          {open === h.id && <Detail id={h.id} onChange={reload} />}
        </div>))}
    </Item>
  </>);
}
