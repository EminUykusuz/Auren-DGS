import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Check, X, UserPlus, FileSpreadsheet, Search, KeyRound, ArrowRightLeft, Download, Upload, Loader2, Ban, CircleCheck, TriangleAlert, ClipboardList } from 'lucide-react';
import clsx from 'clsx';
import { api, get, post } from '../lib/api.js';
import { useAuth } from '../store.js';
import { useLoad } from '../lib/useLoad.js';
import { downloadCsv, readTextFile, TEMPLATE_ROWS } from '../lib/kurum.js';
import { Item } from '../components/ui.jsx';
import Credentials from '../components/Credentials.jsx';

const Err = ({ children }) => children ? <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{children}</p> : null;
const when = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';

// ---- Tek öğrenci ----
function AddOne({ classes, onDone }) {
  const { user } = useAuth(); const owner = user.role === 'owner';
  const [f, setF] = useState({ firstName: '', lastName: '', studentNo: '', classId: classes[0]?.id ?? '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const s = await post('/kurum/students', { firstName: f.firstName, lastName: f.lastName, studentNo: f.studentNo || null, classId: f.classId ? Number(f.classId) : null });
      setF(x => ({ ...x, firstName: '', lastName: '', studentNo: '' }));
      onDone([s]);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div><label htmlFor="a-fn">Ad</label><input id="a-fn" value={f.firstName} onChange={set('firstName')} required maxLength={40} /></div>
      <div><label htmlFor="a-ln">Soyad</label><input id="a-ln" value={f.lastName} onChange={set('lastName')} required maxLength={40} /></div>
      <div><label htmlFor="a-no">Öğrenci no (isteğe bağlı)</label><input id="a-no" value={f.studentNo} onChange={set('studentNo')} maxLength={20} /></div>
      <div><label htmlFor="a-cl">Sınıf</label>
        <select id="a-cl" value={f.classId} onChange={set('classId')} required={!owner}>{owner && <option value="">Sınıfsız</option>}{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="flex items-end"><button className="btn w-full" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}Ekle</button></div>
      <div className="sm:col-span-2 lg:col-span-5"><Err>{err}</Err></div>
    </form>
  );
}

// ---- Excel / CSV'den toplu ----
function AddBulk({ classes, onDone }) {
  const { user } = useAuth(); const owner = user.role === 'owner';
  const [text, setText] = useState(''); const [defClass, setDefClass] = useState('');
  const [pre, setPre] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const file = useRef(null);
  const body = () => ({ text, defaultClassId: defClass ? Number(defClass) : null });
  const preview = async () => { setErr(''); setBusy(true); try { setPre(await post('/kurum/students/preview', body())); } catch (e) { setErr(e.message); setPre(null); } finally { setBusy(false); } };
  const commit = async () => {
    setErr(''); setBusy(true);
    try {
      const out = await post('/kurum/students/bulk', { rows: pre.rows.map(({ line, ...r }) => ({ ...r, line })), defaultClassId: defClass ? Number(defClass) : null });
      setText(''); setPre(null); onDone(out.created, out.errors);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const onFile = async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setText(await readTextFile(f)); setPre(null); } };
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white/[0.04] p-3.5 text-xs leading-relaxed text-slate-400">
        <b className="text-slate-200">Excel&apos;den nasıl aktarılır?</b> Excel&apos;de <b>Ad, Soyad, No, Sınıf</b> sütunlarını (başlık satırı olsa da olmasa da) seç, kopyala ve aşağıdaki kutuya yapıştır.
        Ya da dosyayı <b>CSV</b> olarak kaydedip yükle. Tek sütunda &quot;Ad Soyad&quot; da olur. Sınıf sütunu boşsa aşağıdaki varsayılan sınıf kullanılır.
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => downloadCsv('ogrenci-sablonu.csv', TEMPLATE_ROWS)}><Download size={13} />Şablonu indir</button>
          <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => file.current?.click()}><Upload size={13} />CSV yükle</button>
          <input ref={file} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={onFile} aria-label="CSV dosyası seç" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div><label htmlFor="b-txt">Öğrenci listesi</label>
          <textarea id="b-txt" value={text} onChange={e => { setText(e.target.value); setPre(null); }} rows={7} spellCheck={false} placeholder={'Ad\tSoyad\tNo\tSınıf\nAyşe\tYılmaz\t101\t8-A'}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20" /></div>
        <div className="space-y-3">
          <div><label htmlFor="b-cl">Varsayılan sınıf</label>
            <select id="b-cl" value={defClass} onChange={e => { setDefClass(e.target.value); setPre(null); }}><option value="">{owner ? 'Yok (sütundan alınır)' : 'Seçin…'}</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <button className="btn w-full" onClick={preview} disabled={busy || !text.trim()}>{busy && !pre ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}Önizle</button>
        </div>
      </div>
      <Err>{err}</Err>
      {pre && (
        <div className="space-y-3">
          {pre.errors.length > 0 && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-3.5 text-xs text-amber-200" role="alert">
              <p className="mb-1.5 flex items-center gap-1.5 font-semibold"><TriangleAlert size={14} />{pre.errors.length} satır eklenmeyecek</p>
              <ul className="max-h-32 space-y-0.5 overflow-auto">{pre.errors.map((e, i) => <li key={i}>{e.line ? `Satır ${e.line}: ` : ''}{e.message}</li>)}</ul>
            </div>)}
          {pre.newClasses.length > 0 && <p className="rounded-2xl bg-accent/10 px-3.5 py-2.5 text-xs text-emerald-300">Şu sınıflar yok, otomatik oluşturulacak: <b>{pre.newClasses.join(', ')}</b></p>}
          <div className="max-h-72 overflow-auto rounded-2xl border border-white/[0.06]">
            <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-900/90"><tr className="stat-label"><th className="px-3 py-2">Satır</th><th className="px-3 py-2">Ad</th><th className="px-3 py-2">Soyad</th><th className="px-3 py-2">No</th><th className="px-3 py-2">Sınıf</th></tr></thead>
              <tbody>{pre.rows.map(r => <tr key={r.line} className="border-t border-white/[0.04]"><td className="px-3 py-1.5 text-slate-500">{r.line}</td><td className="px-3 py-1.5 text-slate-100">{r.firstName}</td><td className="px-3 py-1.5 text-slate-100">{r.lastName}</td><td className="px-3 py-1.5">{r.studentNo ?? '—'}</td><td className="px-3 py-1.5">{r.className ?? (classes.find(c => String(c.id) === defClass)?.name ?? '—')}</td></tr>)}</tbody></table>
          </div>
          <button className="btn" onClick={commit} disabled={busy || pre.rows.length === 0}>{busy ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}{pre.rows.length} öğrenciyi ekle</button>
        </div>)}
    </div>
  );
}

// ---- Liste ----
export default function Students() {
  const { user } = useAuth(); const owner = user.role === 'owner'; const nav = useNavigate();
  const cls = useLoad('/kurum/classes');
  const [filter, setFilter] = useState('');   // '' | 'u' (sınıfsız) | sınıf id
  const [q, setQ] = useState('');
  const path = useMemo(() => '/kurum/students?' + new URLSearchParams({ ...(filter === 'u' ? { unassigned: '1' } : filter ? { classId: filter } : {}), ...(q.trim() ? { q: q.trim() } : {}) }), [filter, q]);
  const list = useLoad(path);
  const [sel, setSel] = useState(new Set());
  const [mode, setMode] = useState(null);   // 'one' | 'bulk'
  const [creds, setCreds] = useState(null); const [skipped, setSkipped] = useState([]);
  const [target, setTarget] = useState(''); const [reason, setReason] = useState('');
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);

  const classes = (cls.data?.classes ?? []).filter(c => !c.isArchived);
  const students = list.data?.students ?? [];
  const allSel = students.length > 0 && students.every(s => sel.has(s.id));
  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const run = async (fn) => { setErr(''); setOk(''); setBusy(true); try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  const created = (rows, errs = []) => { setCreds({ rows, title: rows.length === 1 ? 'Öğrenci eklendi' : `${rows.length} öğrenci eklendi` }); setSkipped(errs); setMode(null); list.reload(); cls.reload(); };

  const resetPw = () => run(async () => {
    const out = await post('/kurum/students/reset-passwords', { studentIds: [...sel] });
    const cn = new Map(students.map(s => [s.id, s.className]));
    setCreds({ rows: out.credentials.map(c => ({ ...c, className: c.className ?? cn.get(c.id) })), title: 'Yeni geçici şifreler' }); setSel(new Set()); list.reload();
  });
  const move = () => run(async () => {
    const out = await post('/kurum/students/transfer', { moves: [...sel].map(studentId => ({ studentId, toClassId: target === 'none' ? null : Number(target) })), reason: reason.trim() || undefined });
    setOk(`${out.moved} öğrenci taşındı${out.unchanged ? `, ${out.unchanged} zaten o sınıftaydı` : ''}.`); setSel(new Set()); setTarget(''); setReason(''); list.reload(); cls.reload();
  });
  const [edit, setEdit] = useState(null);   // { id, fullName, studentNo }
  const saveEdit = () => run(async () => { await api('PATCH', '/kurum/students/' + edit.id, { fullName: edit.fullName.trim(), studentNo: edit.studentNo.trim() || null }); setEdit(null); list.reload(); });
  // Satırdaki sınıf seçicisi: seçince hemen taşır (geçmişe yazılır)
  const changeClass = (s, v) => run(async () => {
    await post('/kurum/students/transfer', { moves: [{ studentId: s.id, toClassId: v === '' ? null : Number(v) }], reason: 'Öğrenci listesinden değiştirildi' });
    setOk((s.fullName || s.username) + ' yeni sınıfına taşındı.'); list.reload(); cls.reload();
  });
  const setDisabled = (s) => run(async () => { await api('PATCH', `/kurum/students/${s.id}`, { isDisabled: !s.isDisabled }); list.reload(); });

  return (<>
    <Item className="card space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={clsx('btn', mode !== 'one' && '!bg-white/10 !text-slate-100 !shadow-none')} onClick={() => setMode(mode === 'one' ? null : 'one')}><UserPlus size={16} />Tek öğrenci</button>
        <button className={clsx('btn', mode !== 'bulk' && '!bg-white/10 !text-slate-100 !shadow-none')} onClick={() => setMode(mode === 'bulk' ? null : 'bulk')}><FileSpreadsheet size={16} />Excel / CSV&apos;den toplu ekle</button>
      </div>
      {mode === 'one' && <AddOne classes={classes} onDone={created} />}
      {mode === 'bulk' && <AddBulk classes={classes} onDone={created} />}
    </Item>

    {creds && <Item><Credentials rows={creds.rows} title={creds.title} onClose={() => { setCreds(null); setSkipped([]); }} loginUrl={`${location.origin}/k/${user.institution.slug}`} />
      {skipped.length > 0 && <p className="mt-2 rounded-2xl bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-200">{skipped.length} satır eklenmedi: {skipped.slice(0, 5).map(e => `satır ${e.line} (${e.message})`).join('; ')}{skipped.length > 5 ? '…' : ''}</p>}</Item>}

    <Item className="card space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]"><label htmlFor="f-cl">Sınıf</label>
          <select id="f-cl" value={filter} onChange={e => { setFilter(e.target.value); setSel(new Set()); }}><option value="">{owner ? 'Tüm sınıflar' : 'Tüm sınıflarım'}</option>{owner && <option value="u">Sınıfsız</option>}{(cls.data?.classes ?? []).map(c => <option key={c.id} value={c.id}>{c.name} ({c.studentCount})</option>)}</select></div>
        <div className="min-w-[200px] flex-1"><label htmlFor="f-q">Ara</label><input id="f-q" value={q} onChange={e => setQ(e.target.value)} placeholder="Ad, kullanıcı adı veya numara" maxLength={60} /></div>
      </div>

      {sel.size > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-accent/10 p-3" role="region" aria-label="Seçili öğrenciler için işlemler">
          <span className="self-center text-sm font-semibold text-slate-100">{sel.size} seçili</span>
          <div className="min-w-[150px]"><label htmlFor="m-to">Sınıfa taşı</label>
            <select id="m-to" value={target} onChange={e => setTarget(e.target.value)}><option value="">Seçin…</option>{owner && <option value="none">Sınıfsız</option>}{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="min-w-[160px] flex-1"><label htmlFor="m-why">Not (isteğe bağlı)</label><input id="m-why" value={reason} onChange={e => setReason(e.target.value)} maxLength={200} placeholder="ör. Kasım sınıf değiştirme sınavı" /></div>
          <button className="btn" disabled={busy || !target} onClick={move}><ArrowRightLeft size={15} />Taşı</button>
          <button className="btn-ghost" disabled={busy} onClick={() => nav('/kurum/odev', { state: { studentIds: [...sel] } })}><ClipboardList size={15} />Ödev ver</button>
          <button className="btn-ghost" disabled={busy} onClick={resetPw}><KeyRound size={15} />Şifre sıfırla ve çıktı al</button>
        </div>)}
      <Err>{err}</Err>{ok && <p role="status" className="rounded-2xl bg-accent/10 px-3.5 py-2.5 text-xs text-emerald-300">{ok}</p>}

      {list.error ? <Err>{list.error}</Err> : !list.data ? <div className="py-8 text-center text-slate-500"><Loader2 className="mx-auto animate-spin" size={18} aria-label="Yükleniyor" /></div> : students.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Bu görünümde öğrenci yok. Yukarıdan öğrenci ekleyebilirsin.</p>
      ) : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="stat-label">
            <th className="w-10 px-3 py-2"><input type="checkbox" className="!h-4 !w-4" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(students.map(s => s.id)))} aria-label="Hepsini seç" /></th>
            <th className="px-3 py-2">Ad Soyad</th><th className="px-3 py-2">Kullanıcı adı</th><th className="px-3 py-2">No</th><th className="px-3 py-2">Sınıf</th><th className="px-3 py-2">Ort. net</th><th className="px-3 py-2">Ödev</th><th className="px-3 py-2">Son giriş</th><th className="px-3 py-2">Durum</th></tr></thead>
          <tbody>{students.map(s => (
            <tr key={s.id} className={clsx('border-t border-white/[0.05]', s.isDisabled && 'opacity-50')}>
              <td className="px-3 py-2"><input type="checkbox" className="!h-4 !w-4" checked={sel.has(s.id)} onChange={() => toggle(s.id)} aria-label={`${s.fullName} seç`} /></td>
              <td className="px-3 py-2 text-slate-100">{edit?.id === s.id
                ? <input aria-label="Ad soyad" value={edit.fullName} onChange={e => setEdit({ ...edit, fullName: e.target.value })} maxLength={80} onKeyDown={e => { if (e.key === 'Enter' && edit.fullName.trim().length >= 3) saveEdit(); if (e.key === 'Escape') setEdit(null); }} autoFocus />
                : <span className="inline-flex items-center gap-2">{s.fullName || '—'}<button className="text-slate-500 hover:text-slate-200" onClick={() => setEdit({ id: s.id, fullName: s.fullName ?? '', studentNo: s.studentNo ?? '' })} aria-label={s.fullName + ' adını düzenle'}><Pencil size={12} /></button></span>}</td>
              <td className="px-3 py-2 font-mono text-xs">{s.username}</td>
              <td className="px-3 py-2">{edit?.id === s.id
                ? <span className="flex items-center gap-1"><input aria-label="Öğrenci no" className="!w-24" value={edit.studentNo} onChange={e => setEdit({ ...edit, studentNo: e.target.value })} maxLength={20} /><button className="btn !px-2 !py-1" disabled={busy || edit.fullName.trim().length < 3} onClick={saveEdit} aria-label="Kaydet"><Check size={13} /></button><button className="btn-ghost !px-2 !py-1" onClick={() => setEdit(null)} aria-label="Vazgeç"><X size={13} /></button></span>
                : (s.studentNo ?? '—')}</td><td className="px-3 py-2"><select aria-label={(s.fullName || s.username) + ' sınıfı'} value={s.classId ?? ''} disabled={busy || s.isDisabled} onChange={e => changeClass(s, e.target.value)} className="!w-32 !py-1.5">
                {(owner || s.classId == null) && <option value="">Sınıfsız</option>}{s.classId != null && !classes.some(c => c.id === s.classId) && <option value={s.classId}>{s.className}</option>}{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
              <td className="px-3 py-2 num">{s.avgNet ?? <span className="text-slate-600">—</span>}</td>
              <td className="px-3 py-2">{s.lateHomework > 0 ? <span className="badge bg-red-500/15 text-red-300">{s.lateHomework} gecikmiş</span> : s.openHomework > 0 ? <span className="badge bg-amber-400/15 text-amber-300">{s.openHomework} açık</span> : <span className="text-slate-600">—</span>}</td>
              <td className="px-3 py-2">{s.mustChangePassword ? <span className="badge bg-amber-400/15 text-amber-300">giriş bekliyor</span> : when(s.lastLoginAt)}</td>
              <td className="px-3 py-2"><button className="btn-ghost !px-2.5 !py-1 text-xs" disabled={busy} onClick={() => setDisabled(s)} aria-label={s.isDisabled ? 'Hesabı etkinleştir' : 'Hesabı pasife al'}>
                {s.isDisabled ? <><Ban size={12} />Pasif</> : <><CircleCheck size={12} className="text-accent" />Aktif</>}</button></td>
            </tr>))}</tbody>
        </table></div>)}
    </Item>
  </>);
}
