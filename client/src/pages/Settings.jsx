import { useEffect, useId, useRef, useState } from 'react';
import { Check, Send, GraduationCap, Palette, ImagePlus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { get, put, post } from '../lib/api.js';
import { useTheme, THEMES, BACKGROUNDS, fileToBg } from '../theme.js';
import { Page, Item, Title } from '../components/ui.jsx';

function Switch({ checked, onChange, label, hint }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div><div id={id} className="text-sm text-slate-100">{label}</div><div className="text-xs text-slate-500">{hint}</div></div>
      <button role="switch" aria-checked={checked} aria-labelledby={id} onClick={() => onChange(!checked)}
        className={clsx('relative h-7 w-12 shrink-0 rounded-full border border-white/10 transition', checked ? 'bg-accent' : 'bg-white/10')}>
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-0.5')} />
      </button>
    </div>
  );
}

function Appearance() {
  const { theme, setTheme, glow, setGlow, perf, setPerf, bg, bgImage, setBg, setCustomBg, clearBg: clearCustom } = useTheme();
  const file = useRef(null); const [err, setErr] = useState('');
  const upload = async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setErr(''); setCustomBg(await fileToBg(f)); } catch (x) { setErr(x.message); } };
  return (
    <Item className="card">
      <div className="stat-label mb-4 flex items-center gap-2"><Palette size={13} /> Görünüm</div>
      <div role="radiogroup" aria-label="Arka plan teması" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {THEMES.map(t => (
          <button key={t.id} role="radio" aria-checked={theme === t.id} onClick={() => setTheme(t.id)}
            className={clsx('rounded-3xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', theme === t.id ? 'border-accent bg-accent/10' : 'border-white/10 hover:bg-white/5')}>
            <div className="relative mb-3 h-16 overflow-hidden rounded-2xl border border-black/10" style={{ background: t.swatch[0] }} aria-hidden="true">
              <span className="absolute -left-4 -top-4 h-14 w-14 rounded-full opacity-70 blur-xl" style={{ background: t.swatch[1] }} />
              <span className="absolute -bottom-5 right-0 h-14 w-14 rounded-full opacity-60 blur-xl" style={{ background: t.swatch[2] }} />
              <span className="absolute inset-x-3 bottom-3 h-3 rounded-full bg-white/20 ring-1 ring-white/20" />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm text-slate-100">{t.label}{theme === t.id && <Check size={14} className="text-accent" />}</div>
            <div className="text-xs text-slate-500">{t.dark ? 'Koyu' : 'Açık'}</div>
          </button>))}
      </div>
      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <div className="stat-label mb-3 flex items-center gap-2"><ImagePlus size={13} /> Arka plan görseli</div>
        <div role="radiogroup" aria-label="Arka plan görseli" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {BACKGROUNDS.map(b => (
            <button key={b.id} role="radio" aria-checked={bg === b.id} onClick={() => setBg(b.id)} title={b.label}
              className={clsx('overflow-hidden rounded-2xl border text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', bg === b.id ? 'border-accent' : 'border-white/10 hover:border-white/30')}>
              <div className="h-12" style={{ background: b.css ?? 'rgb(var(--s800))' }} aria-hidden="true" />
              <div className="px-2 py-1 text-[11px] text-slate-300">{b.label}</div>
            </button>))}
          {bgImage && (
            <button role="radio" aria-checked={bg === 'custom'} onClick={() => setBg('custom')} title="Kendi görselin"
              className={clsx('overflow-hidden rounded-2xl border text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent', bg === 'custom' ? 'border-accent' : 'border-white/10 hover:border-white/30')}>
              <div className="h-12 bg-cover bg-center" style={{ backgroundImage: `url(${bgImage})` }} aria-hidden="true" />
              <div className="px-2 py-1 text-[11px] text-slate-300">Görselim</div>
            </button>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input ref={file} type="file" accept="image/*" onChange={upload} className="sr-only" aria-label="Arka plan görseli yükle" />
          <button type="button" className="btn-ghost" onClick={() => file.current?.click()}><ImagePlus size={14} /> Görsel yükle</button>
          {bgImage && <button type="button" className="btn-ghost" onClick={clearCustom}><Trash2 size={14} /> Görselimi sil</button>}
          <span className="text-xs text-slate-500">Görsel yalnızca bu tarayıcıda saklanır, sunucuya gönderilmez.</span>
        </div>
        {err && <p role="alert" className="mt-2 text-xs text-red-300">{err}</p>}
      </div>
      <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-4">
        <Switch checked={glow} onChange={setGlow} label="Ortam ışıkları" hint="Cam yüzeylerin arkasındaki renkli parıltılar" />
        <Switch checked={perf} onChange={setPerf} label="Performans modu (efektleri azalt)" hint="Bulanıklık, parıltı ve animasyonları kapatır; eski cihazlarda kaydırma akıcı olur" />
      </div>
      <p className="mt-3 text-xs text-slate-500">Tercihlerin bu tarayıcıda saklanır.</p>
    </Item>
  );
}

function Target() {
  const [f, setF] = useState({ targetUniversity: '', targetDepartment: '', examDate: '' }); const [state, setState] = useState('idle'); const [err, setErr] = useState('');
  useEffect(() => { get('/profile').then(p => setF({ targetUniversity: p.targetUniversity, targetDepartment: p.targetDepartment, examDate: p.examDate ?? '' })).catch(() => {}); }, []);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setState('saving');
    try { await put('/profile', { ...f, examDate: f.examDate || null }); setState('saved'); setTimeout(() => setState('idle'), 2500); } catch (x) { setErr(x.message); setState('idle'); }
  };
  return (
    <Item className="card">
      <div className="stat-label mb-4 flex items-center gap-2"><GraduationCap size={13} /> Hedef ve sınav tarihi</div>
      <form onSubmit={submit} className="space-y-3">
        <div><label htmlFor="tu">Hedef üniversite</label><input id="tu" maxLength={120} value={f.targetUniversity} onChange={e => setF(p => ({ ...p, targetUniversity: e.target.value }))} placeholder="Örn. Boğaziçi Üniversitesi" autoComplete="off" /></div>
        <div><label htmlFor="td">Hedef bölüm</label><input id="td" maxLength={120} value={f.targetDepartment} onChange={e => setF(p => ({ ...p, targetDepartment: e.target.value }))} placeholder="Örn. Bilgisayar Mühendisliği" autoComplete="off" /></div>
        <div><label htmlFor="ed">DGS sınav tarihi</label><input id="ed" type="date" min={new Date().toISOString().slice(0, 10)} value={f.examDate} onChange={e => setF(p => ({ ...p, examDate: e.target.value }))} />
          <p className="mt-1 text-xs text-slate-500">Boş bırakırsan geri sayım bir sonraki 19 Temmuz'u tahmini olarak gösterir. ÖSYM kesin tarihi açıklayınca buraya gir.</p></div>
        <div className="flex items-center gap-3"><button className="btn" disabled={state === 'saving'}>Kaydet</button>
          <span role="status" className="text-xs text-emerald-300">{state === 'saved' && 'Kaydedildi ✓'}</span></div>
        {err && <p role="alert" className="text-xs text-red-300">{err}</p>}
      </form>
    </Item>
  );
}

const CATS = [['oneri', 'Öneri'], ['hata', 'Hata bildirimi'], ['soru', 'Soru'], ['diger', 'Diğer']];
function Feedback() {
  const [f, setF] = useState({ category: 'oneri', subject: '', message: '' }); const [busy, setBusy] = useState(false); const [res, setRes] = useState(null); const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setRes(null); setBusy(true);
    try { setRes(await post('/feedback', f)); setF(p => ({ ...p, subject: '', message: '' })); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Item className="card">
      <div className="stat-label mb-4 flex items-center gap-2"><Send size={13} /> Bize ulaş / geri bildirim</div>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <div><label htmlFor="fc">Tür</label><select id="fc" value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label htmlFor="fs">Konu</label><input id="fs" required minLength={3} maxLength={100} value={f.subject} onChange={e => setF(p => ({ ...p, subject: e.target.value }))} /></div>
        </div>
        <div><label htmlFor="fm">Mesaj</label>
          <textarea id="fm" required minLength={10} maxLength={2000} rows={5} value={f.message} onChange={e => setF(p => ({ ...p, message: e.target.value }))}
            className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20" />
          <div className="num mt-1 text-right text-xs text-slate-500">{f.message.length}/2000</div></div>
        <div className="flex items-center gap-3"><button className="btn" disabled={busy}><Send size={14} /> Gönder</button></div>
        <div role="status">
          {res && <p className="rounded-2xl bg-accent/10 px-3 py-2 text-xs text-emerald-300">Mesajın alındı{res.mail === 'sent' ? ' ve e-posta ile iletildi.' : res.mail === 'failed' ? '; e-posta gönderilemedi ama kaydın yönetime ulaştı.' : ' ve yönetim paneline kaydedildi.'}</p>}
        </div>
        {err && <p role="alert" className="text-xs text-red-300">{err}</p>}
      </form>
    </Item>
  );
}

export default function Settings() {
  return (
    <Page>
      <Title>Ayarlar</Title>
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <div className="space-y-4"><Appearance /><Target /></div>
        <Feedback />
      </div>
    </Page>
  );
}
