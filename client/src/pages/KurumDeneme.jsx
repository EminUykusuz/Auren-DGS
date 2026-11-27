import { useState } from 'react';
import { Loader2, Trash2, Download, Trophy, Plus } from 'lucide-react';
import clsx from 'clsx';
import { post, del } from '../lib/api.js';
import { useAuth, useExam } from '../store.js';
import { useLoad } from '../lib/useLoad.js';
import { Item } from '../components/ui.jsx';

const Err = ({ children }) => children ? <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{children}</p> : null;
const Spin = () => <div className="flex justify-center py-8 text-slate-500" role="status"><Loader2 className="animate-spin" size={18} aria-label="Yükleniyor" /></div>;
const fmt = n => n == null ? '—' : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };

function download(name, text) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

function Create({ classes, owner, onDone }) {
  const config = useExam(s => s.config);
  const [f, setF] = useState({ examType: 'YKS', part: 'TYT', examName: '', examDate: today(), classId: owner ? '' : String(classes[0]?.id ?? '') });
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const type = config.types.find(t => t.id === f.examType), set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await post('/kurum/exams', { ...f, classId: f.classId ? Number(f.classId) : null }); setF(p => ({ ...p, examName: '' })); onDone(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Item className="card">
      <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={submit}>
        <div><label htmlFor="ke-t">Sınav</label><select id="ke-t" value={f.examType} onChange={e => { const t = config.types.find(x => x.id === e.target.value); setF(p => ({ ...p, examType: t.id, part: t.parts[0].id })); }}>{config.types.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}</select></div>
        <div><label htmlFor="ke-p">Bölüm</label><select id="ke-p" value={f.part} onChange={set('part')}>{type.parts.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
        <div><label htmlFor="ke-n">Deneme adı</label><input id="ke-n" required minLength={2} maxLength={60} value={f.examName} onChange={set('examName')} placeholder="örn. Deneme 3" /></div>
        <div><label htmlFor="ke-d">Tarih</label><input id="ke-d" type="date" required value={f.examDate} onChange={set('examDate')} /></div>
        <div><label htmlFor="ke-c">Kime?</label><select id="ke-c" value={f.classId} onChange={set('classId')}>{owner && <option value="">Tüm kurum</option>}{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="sm:col-span-2 lg:col-span-5"><Err>{err}</Err><button className="btn mt-1" disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}Deneme oluştur</button></div>
      </form>
    </Item>
  );
}

function Detail({ id, onChange }) {
  const { data, error, reload } = useLoad(`/kurum/exams/${id}`);
  const [text, setText] = useState(''), [prev, setPrev] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [ok, setOk] = useState('');
  if (error) return <Err>{error}</Err>;
  if (!data) return <Spin />;
  const { exam, students, classes, sectionAvg } = data;
  const template = () => download(`${exam.name.replace(/[^\w-]+/g, '_')}-sonuc-sablonu.csv`, ['Öğrenci no', ...exam.sections.flatMap(s => [s.label + ' D', s.label + ' Y'])].join(';') + '\r\n');
  const run = async (dryRun) => {
    setErr(''); setOk(''); setBusy(true);
    try {
      const r = await post(`/kurum/exams/${id}/results`, { text, dryRun });
      if (dryRun) setPrev(r); else { setPrev(null); setText(''); setOk(`${r.saved} öğrencinin sonucu kaydedildi` + (r.errors.length ? `, ${r.errors.length} satır atlandı` : '')); reload(); onChange(); }
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Item className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="font-semibold text-slate-100">{exam.name} <span className="badge ml-1 bg-white/[0.07] text-slate-300">{exam.part}</span></p><p className="text-xs text-slate-400">{exam.date} · {exam.className ?? 'Tüm kurum'} · sütunlar: {exam.sections.map(s => `${s.label} (${s.max})`).join(', ')}</p></div>
          <button className="btn-ghost text-xs" onClick={template}><Download size={14} />Şablon (CSV)</button>
        </div>
        <label htmlFor="ke-r">Sonuçları yapıştır</label>
        <textarea id="ke-r" rows={6} value={text} onChange={e => { setText(e.target.value); setPrev(null); }} spellCheck={false} className="font-mono text-xs"
          placeholder={`Excel'den kopyala-yapıştır. Her satır: öğrenci no, ardından her ders için doğru ve yanlış sayısı (${exam.sections.length * 2} sayı).\n101\t${exam.sections.map(() => '20\t5').join('\t')}`} />
        <Err>{err}</Err>
        {ok && <p role="status" className="rounded-2xl bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300">{ok}</p>}
        {prev && (
          <div className="space-y-2 rounded-2xl bg-white/[0.04] p-3 text-xs">
            <p className="text-slate-200"><b>{prev.preview.length}</b> öğrenci eşleşti{prev.errors.length > 0 && <>, <b className="text-amber-300">{prev.errors.length}</b> satır sorunlu</>}. Kaydedince bu öğrencilerin eski sonucu (varsa) değiştirilir.</p>
            {prev.errors.length > 0 && <ul className="max-h-32 space-y-0.5 overflow-auto text-amber-300">{prev.errors.map((e, i) => <li key={i}>Satır {e.line}: {e.message}</li>)}</ul>}
          </div>)}
        <div className="flex gap-2">
          <button className="btn-ghost" disabled={busy || !text.trim()} onClick={() => run(true)}>Önizle</button>
          <button className="btn" disabled={busy || !text.trim() || !prev || prev.preview.length === 0} onClick={() => run(false)}>{busy && <Loader2 size={14} className="animate-spin" />}Kaydet</button>
        </div>
      </div>
      {students.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="card overflow-x-auto !p-0">
            <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-3 py-2.5">Sıra</th><th className="px-3 py-2.5">Öğrenci</th><th className="px-3 py-2.5">Sınıf</th>{exam.sections.map(s => <th key={s.key} className="px-3 py-2.5 text-right">{s.label}</th>)}<th className="px-3 py-2.5 text-right">Net</th></tr></thead>
              <tbody>{students.map(s => (
                <tr key={s.userId} className="border-t border-white/[0.06]">
                  <td className="num px-3 py-2">{s.rank <= 3 ? <Trophy size={14} className={clsx(s.rank === 1 ? 'text-amber-300' : s.rank === 2 ? 'text-slate-300' : 'text-orange-400')} aria-label={s.rank + '. sıra'} /> : s.rank}</td>
                  <td className="px-3 py-2 text-slate-100">{s.fullName}<span className="ml-1.5 text-xs text-slate-500">{s.studentNo}</span></td><td className="px-3 py-2 text-slate-400">{s.className ?? '—'}</td>
                  {exam.sections.map(x => <td key={x.key} className="num px-3 py-2 text-right text-slate-300">{fmt(s.nets[x.key])}</td>)}<td className="num px-3 py-2 text-right font-semibold text-accent">{fmt(s.totalNet)}</td></tr>))}</tbody></table>
          </div>
          <div className="space-y-4">
            <div className="card"><p className="stat-label mb-2">Sınıf ortalamaları</p><ul className="space-y-1.5 text-sm">{classes.map(c => <li key={c.name} className="flex justify-between"><span className="text-slate-200">{c.name} <span className="text-xs text-slate-500">({c.count})</span></span><span className="num text-accent">{fmt(c.avgNet)}</span></li>)}</ul></div>
            <div className="card"><p className="stat-label mb-2">Ders ortalamaları</p><ul className="space-y-1.5 text-sm">{sectionAvg.map(s => <li key={s.key} className="flex justify-between"><span className="text-slate-200">{s.label}</span><span className="num text-slate-300">{fmt(s.avg)} <span className="text-xs text-slate-500">/ {s.max}</span></span></li>)}</ul></div>
          </div>
        </div>)}
    </Item>
  );
}

export default function KurumDeneme() {
  const { user } = useAuth(); const owner = user.role === 'owner';
  const cls = useLoad('/kurum/classes'); const { data, error, reload } = useLoad('/kurum/exams');
  const [sel, setSel] = useState(null), [msg, setMsg] = useState('');
  const classes = (cls.data?.classes ?? []).filter(c => !c.isArchived);
  if (error) return <Err>{error}</Err>;
  if (!data || !cls.data) return <Spin />;
  const remove = async (e) => {
    if (!confirm(`“${e.name}” ve öğrencilerin bu denemedeki sonuçları silinsin mi?`)) return;
    setMsg(''); try { await del('/kurum/exams/' + e.id); if (sel === e.id) setSel(null); reload(); } catch (x) { setMsg(x.message); }
  };
  return (<>
    <Create classes={classes} owner={owner} onDone={reload} />
    <Err>{msg}</Err>
    <Item className="card !p-0 overflow-x-auto">
      {data.exams.length === 0 ? <p className="p-5 text-sm text-slate-400">Henüz kurum denemesi yok. Yukarıdan bir deneme oluştur, sonra sonuçları Excel’den yapıştır; sonuçlar öğrencilerin Denemeler sayfasına düşer.</p> : (
        <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-400"><th className="px-4 py-2.5">Deneme</th><th className="px-3 py-2.5">Kime</th><th className="px-3 py-2.5">Tarih</th><th className="px-3 py-2.5 text-right">Sonuç</th><th className="px-3 py-2.5 text-right">Ort. net</th><th /></tr></thead>
          <tbody>{data.exams.map(e => (
            <tr key={e.id} className={clsx('border-t border-white/[0.06]', sel === e.id && 'bg-white/[0.04]')}>
              <td className="px-4 py-2.5 text-slate-100">{e.name} <span className="badge ml-1 bg-white/[0.07] text-slate-300">{e.part}</span></td><td className="px-3 py-2.5 text-slate-400">{e.className ?? 'Tüm kurum'}</td><td className="num px-3 py-2.5 text-slate-400">{e.date}</td>
              <td className="num px-3 py-2.5 text-right">{e.results}</td><td className="num px-3 py-2.5 text-right text-accent">{fmt(e.avgNet)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right"><button className="btn-ghost !px-3 !py-1 text-xs" onClick={() => setSel(sel === e.id ? null : e.id)}>{sel === e.id ? 'Kapat' : 'Sonuç / sıralama'}</button>
                {(owner || e.classId) && <button aria-label={`${e.name} sil`} className="ml-2 text-slate-500 transition hover:text-red-300" onClick={() => remove(e)}><Trash2 size={14} /></button>}</td></tr>))}</tbody></table>)}
    </Item>
    {sel && <Detail key={sel} id={sel} onChange={reload} />}
  </>);
}
