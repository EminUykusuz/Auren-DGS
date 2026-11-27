import { useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Trash2, Check, RotateCcw, X, NotebookPen } from 'lucide-react';
import clsx from 'clsx';
import { post, del, api } from '../lib/api.js';
import { useExamCfg } from '../store.js';
import { useLoad } from '../lib/useLoad.js';
import { REASONS, REASON_LABEL } from '../lib/reasons.js';
import { Page, Item, Title } from '../components/ui.jsx';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const photoUrl = (id) => `${BASE}/api/defter/${id}/photo`;
const MAX_BYTES = 300 * 1024;

// Fotoğrafı tarayıcıda küçült: uzun kenar ≤ 1400 px, JPEG; boyut sınırın altına inene dek kaliteyi düşür.
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  for (let q = 0.8; q >= 0.35; q -= 0.1) {
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
    if (blob && (blob.size <= MAX_BYTES || q < 0.4)) {
      if (blob.size > MAX_BYTES) throw new Error('Fotoğraf çok büyük; daha yakından/kırpılmış çekin');
      return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res({ url: fr.result, size: blob.size }); fr.onerror = rej; fr.readAsDataURL(blob); });
    }
  }
}

function Add({ onDone }) {
  const { mode, cfg, part, subjectLabel } = useExamCfg();
  const [photo, setPhoto] = useState(null), [subject, setSubject] = useState(''), [topic, setTopic] = useState(''), [reason, setReason] = useState(''), [note, setNote] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''); const file = useRef(null);
  const subj = subject || cfg.subjects[0]?.key || '';
  const topics = useMemo(() => (cfg.curriculum?.[subj] ?? []).flatMap(g => g.topics), [cfg, subj]);
  const pick = async (e) => {
    const f = e.target.files?.[0]; if (!f) return; setErr('');
    try { setPhoto(await shrink(f)); } catch (x) { setErr(x.message || 'Fotoğraf okunamadı'); }
    e.target.value = '';
  };
  const save = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await post('/defter', { examType: mode, part, subject: subj, topic: topic || undefined, reason: reason || null, note: note || undefined, photo: photo?.url });
      setPhoto(null); setTopic(''); setNote(''); setReason(''); onDone();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Item className="card">
      <form onSubmit={save} className="grid gap-4 md:grid-cols-[220px_1fr]">
        <div>
          <button type="button" onClick={() => file.current?.click()} className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.03] text-slate-400 transition hover:bg-white/[0.06]" aria-label="Soru fotoğrafı seç">
            {photo ? <img src={photo.url} alt="Seçilen soru" className="h-full w-full object-contain" /> : <span className="flex flex-col items-center gap-2 px-4 text-center text-xs"><Camera size={26} />Sorunun fotoğrafını çek ya da seç</span>}
          </button>
          <input ref={file} type="file" accept="image/*" className="sr-only" onChange={pick} aria-hidden="true" tabIndex={-1} />
          {photo && <p className="mt-1.5 text-center text-[11px] text-slate-500">{Math.round(photo.size / 1024)} KB · küçültüldü</p>}
        </div>
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <div><label htmlFor="w-s">Ders</label><select id="w-s" value={subj} onChange={e => { setSubject(e.target.value); setTopic(''); }}>{cfg.subjects.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
          <div><label htmlFor="w-t">Konu</label><input id="w-t" list="w-topics" value={topic} onChange={e => setTopic(e.target.value)} maxLength={80} placeholder="örn. Üslü sayılar" autoComplete="off" />
            <datalist id="w-topics">{topics.map(t => <option key={t.value} value={t.label} />)}</datalist></div>
          <div className="sm:col-span-2"><label htmlFor="w-r">Neden yanlış yaptım?</label>
            <select id="w-r" value={reason} onChange={e => setReason(e.target.value)}><option value="">Seçmeyeyim</option>{REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></div>
          <div className="sm:col-span-2"><label htmlFor="w-n">Not</label><textarea id="w-n" rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Doğru çözüm, hatırlanacak formül…" /></div>
          {err && <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300 sm:col-span-2">{err}</p>}
          <div className="sm:col-span-2"><button className="btn" disabled={busy || (!photo && !note.trim())}>{busy ? <Loader2 size={15} className="animate-spin" /> : <NotebookPen size={15} />}Deftere ekle</button></div>
        </div>
      </form>
    </Item>
  );
}

export default function Defter() {
  const { mode, subjectLabel, cfg } = useExamCfg();
  const { data, error, reload } = useLoad(`/defter?examType=${mode}`);
  const [show, setShow] = useState('open'), [sub, setSub] = useState(''), [big, setBig] = useState(null), [msg, setMsg] = useState('');
  const items = (data?.items ?? []).filter(i => (show === 'all' || (show === 'open') === !i.solved) && (!sub || i.subject === sub));
  const act = async (fn) => { setMsg(''); try { await fn(); reload(); } catch (e) { setMsg(e.message); } };
  return (
    <Page>
      <Title right={<span className="text-xs text-slate-500">{data ? `${data.items.filter(i => !i.solved).length} çözülmemiş soru` : ''}</span>}>Yanlış defteri</Title>
      <Add onDone={reload} />
      <Item className="flex flex-wrap items-center gap-2">
        {[['open', 'Çözülmemiş'], ['done', 'Çözüldü'], ['all', 'Tümü']].map(([k, l]) => <button key={k} onClick={() => setShow(k)} aria-pressed={show === k} className={clsx('rounded-full px-3.5 py-1.5 text-xs font-semibold transition', show === k ? 'bg-accent text-onaccent' : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]')}>{l}</button>)}
        <select aria-label="Derse göre süz" value={sub} onChange={e => setSub(e.target.value)} className="!w-auto !py-1.5 text-xs"><option value="">Tüm dersler</option>{cfg.subjects.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
      </Item>
      {(error || msg) && <p role="alert" className="rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{error || msg}</p>}
      {!data && !error ? <div className="flex justify-center py-10 text-slate-500" role="status"><Loader2 className="animate-spin" size={18} aria-label="Yükleniyor" /></div>
        : items.length === 0 ? <Item className="card text-center text-sm text-slate-400">{data.items.length ? 'Bu süzgeçte soru yok.' : 'Defterin boş. Yanlış yaptığın bir sorunun fotoğrafını ekle; sonra buradan tekrar çöz.'}</Item>
          : <Item className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(i => (
              <article key={i.id} className={clsx('card !p-3.5', i.solved && 'opacity-70')}>
                {i.hasPhoto && <button onClick={() => setBig(i)} className="mb-3 block w-full overflow-hidden rounded-xl bg-white/[0.04]" aria-label="Fotoğrafı büyüt"><img src={photoUrl(i.id)} alt={`${subjectLabel(i.subject)} sorusu`} loading="lazy" className="h-44 w-full object-contain" /></button>}
                <div className="flex flex-wrap items-center gap-1.5"><span className="badge bg-accent/15 text-accent">{subjectLabel(i.subject)}</span>{i.reason && <span className="badge bg-white/[0.07] text-slate-300">{REASON_LABEL[i.reason]}</span>}{i.solved && <span className="badge bg-emerald-500/15 text-emerald-300">Çözüldü</span>}</div>
                {i.topic && <p className="mt-2 text-sm font-medium text-slate-100">{i.topic}</p>}
                {i.note && <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{i.note}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <button className="btn-ghost !px-3 !py-1 text-xs" onClick={() => act(() => api('PATCH', '/defter/' + i.id, { solved: !i.solved }))}>{i.solved ? <><RotateCcw size={13} />Geri al</> : <><Check size={13} />Çözdüm</>}</button>
                  <button aria-label="Soruyu sil" className="text-slate-500 transition hover:text-red-300" onClick={() => confirm('Bu soru defterden silinsin mi?') && act(() => del('/defter/' + i.id))}><Trash2 size={15} /></button>
                </div>
              </article>))}
          </Item>}
      {big && (
        <div role="dialog" aria-modal="true" aria-label="Soru fotoğrafı" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setBig(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label="Kapat" onClick={() => setBig(null)}><X size={18} /></button>
          <img src={photoUrl(big.id)} alt="Soru" className="max-h-full max-w-full rounded-xl bg-white object-contain" onClick={e => e.stopPropagation()} />
        </div>)}
    </Page>
  );
}
