import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, SkipForward, RotateCcw, Maximize2, X, Volume2, Settings2, Coffee, Brain } from 'lucide-react';
import clsx from 'clsx';
import { post, today } from '../lib/api.js';
import { DGS_TOPIC_GROUPS } from '../lib/curriculum.js';
import { SOUNDS, playSound, stopSound, setVolume, chime } from '../lib/ambient.js';
import { Item } from './ui.jsx';

const SK = 'dgs_pomo_settings_v1', RK = 'dgs_pomo_run_v1';
const DEF = { work: 25, short: 5, long: 15, every: 4, auto: true, sound: 'off', volume: 0.3, subjectKey: 'matematik', topicKey: DGS_TOPIC_GROUPS.matematik[0].topics[0].value };
const PHASES = { work: ['Odak', Brain], short: ['Kısa mola', Coffee], long: ['Uzun mola', Coffee] };
const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return d; } };
const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, parseInt(v, 10) || lo));

// Süre duvar saatine göre tutulur (endsAt): sekme arka planda olsa da, sayfa yenilense de doğru kalır.
export default function Pomodoro() {
  const [cfg, setCfg] = useState(() => load(SK, DEF));
  const [run, setRun] = useState(() => { const r = load(RK, { phase: 'work', endsAt: null, remaining: null, cycle: 0 }); return { ...r, remaining: r.remaining ?? load(SK, DEF).work * 60000 }; });
  const [now, setNow] = useState(Date.now());
  const [focus, setFocus] = useState(false); const [showCfg, setShowCfg] = useState(false); const [msg, setMsg] = useState('');
  const handled = useRef(null);

  useEffect(() => { localStorage.setItem(SK, JSON.stringify(cfg)); }, [cfg]);
  useEffect(() => { localStorage.setItem(RK, JSON.stringify(run)); }, [run]);

  const running = run.endsAt != null;
  const left = running ? Math.max(0, run.endsAt - now) : run.remaining;
  const dur = ph => (ph === 'work' ? cfg.work : ph === 'short' ? cfg.short : cfg.long) * 60000;

  useEffect(() => { if (!running) return; setNow(Date.now()); const end = run.endsAt; const t = setInterval(() => setNow(n => { const d = Date.now(); return Math.ceil((end - d) / 1000) === Math.ceil((end - n) / 1000) ? n : d; }), 250); return () => clearInterval(t); }, [running, run.endsAt]);

  const record = useCallback(async (minutes) => {
    if (minutes < 1) return;
    try {
      await post('/sessions', { subjectKey: cfg.subjectKey, topicKey: cfg.topicKey, durationMinutes: Math.min(minutes, 1440), questionsSolved: 0, correctCount: 0, wrongCount: 0, studyDate: today() });
      setMsg(`${minutes} dk odak oturumu kaydedildi ✓`);
    } catch (e) { setMsg('Oturum kaydedilemedi: ' + e.message); }
  }, [cfg.subjectKey, cfg.topicKey]);

  // fazı bitir: kayıt + sonraki faza geç. minutes: kaydedilecek odak dakikası (erken atlamada kısmi)
  const advance = useCallback((minutes, startNext) => {
    setRun(r => {
      const wasWork = r.phase === 'work';
      const cycle = wasWork ? r.cycle + 1 : r.cycle;
      const next = wasWork ? (cycle % cfg.every === 0 ? 'long' : 'short') : 'work';
      const ms = (next === 'work' ? cfg.work : next === 'short' ? cfg.short : cfg.long) * 60000;
      return { phase: next, cycle, endsAt: startNext ? Date.now() + ms : null, remaining: ms };
    });
    if (minutes != null) record(minutes);
  }, [cfg, record]);

  useEffect(() => {
    if (!running || left > 0 || handled.current === run.endsAt) return;
    handled.current = run.endsAt;                       // aynı bitişi iki kez işleme
    chime(cfg.volume);
    advance(run.phase === 'work' ? cfg.work : null, cfg.auto);
  }, [running, left, run.endsAt, run.phase, cfg, advance]);

  // Ortam sesi yalnızca çalışan odak fazında
  useEffect(() => { if (running && run.phase === 'work' && cfg.sound !== 'off') playSound(cfg.sound, cfg.volume); else stopSound(); return stopSound; }, [running, run.phase, cfg.sound]); // eslint-disable-line
  useEffect(() => { setVolume(cfg.volume); }, [cfg.volume]);

  // Sekme başlığında geri sayım
  useEffect(() => {
    if (!running) return;
    const prev = document.title; document.title = `${clock(left)} · ${PHASES[run.phase][0]}`;
    return () => { document.title = prev; };
  }, [running, left, run.phase]);

  useEffect(() => { if (!focus) return; const k = e => e.key === 'Escape' && setFocus(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [focus]);

  const start = () => { setMsg(''); setRun(r => ({ ...r, endsAt: Date.now() + (r.remaining ?? dur(r.phase)), remaining: null })); };
  const pause = () => setRun(r => ({ ...r, remaining: Math.max(0, r.endsAt - Date.now()), endsAt: null }));
  const skip = () => {
    const elapsed = run.phase === 'work' ? Math.floor((dur('work') - left) / 60000) : 0;
    advance(run.phase === 'work' ? elapsed : null, false);
  };
  const reset = () => { setMsg(''); setRun({ phase: 'work', cycle: 0, endsAt: null, remaining: cfg.work * 60000 }); };
  const setNum = (k, lo, hi) => e => { const v = clampInt(e.target.value, lo, hi); setCfg(c => ({ ...c, [k]: v })); if (!running && run.phase === k) setRun(r => ({ ...r, remaining: v * 60000 })); };

  const [label, PhaseIcon] = PHASES[run.phase];
  const pct = 1 - left / dur(run.phase);
  const topics = DGS_TOPIC_GROUPS[cfg.subjectKey];
  const R = 110, C = 2 * Math.PI * R;

  const Ring = ({ size = 280 }) => (
    <div className="relative" style={{ width: size, height: size }} role="timer" aria-label={`${label}, kalan ${clock(left)}`}>
      <svg viewBox="0 0 260 260" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="130" cy="130" r={R} fill="none" stroke="rgb(var(--fg) / .08)" strokeWidth="10" />
        <circle cx="130" cy="130" r={R} fill="none" stroke={run.phase === 'work' ? 'rgb(var(--accent))' : 'rgb(var(--cyan2))'} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, Math.max(0, pct)))} style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400"><PhaseIcon size={13} />{label}</div>
        <div aria-hidden="true" className="num text-6xl font-light tracking-tight text-slate-50">{clock(left)}</div>
        <div className="num mt-1 text-xs text-slate-500">{run.cycle} tamamlanan odak</div>
      </div>
    </div>
  );
  const Controls = () => (
    <div className="flex items-center gap-3">
      <button className="btn-ghost !p-3" onClick={reset} aria-label="Sıfırla"><RotateCcw size={16} /></button>
      {running ? <button className="btn !px-7" onClick={pause}><Pause size={16} /> Duraklat</button> : <button className="btn !px-7" onClick={start}><Play size={16} /> {left < dur(run.phase) ? 'Devam' : 'Başlat'}</button>}
      <button className="btn-ghost !p-3" onClick={skip} aria-label={run.phase === 'work' ? 'Odak fazını bitir ve kaydet' : 'Molayı atla'}><SkipForward size={16} /></button>
    </div>
  );
  const Sound = ({ compact }) => (
    <div className={clsx('flex flex-wrap items-center gap-3', compact && 'justify-center')}>
      <Volume2 size={16} className="text-slate-400" aria-hidden="true" />
      <select aria-label="Ortam sesi" className="!w-48" value={cfg.sound} onChange={e => setCfg(c => ({ ...c, sound: e.target.value }))}>{SOUNDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input type="range" aria-label="Ses düzeyi" min={0} max={1} step={0.05} value={cfg.volume} onChange={e => setCfg(c => ({ ...c, volume: Number(e.target.value) }))} className="!w-32" />
    </div>
  );

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px] xl:items-start">
        <Item className="card flex flex-col items-center gap-6 py-8">
          {Ring({})}{Controls()}
          <div className="flex w-full flex-col items-center gap-4 border-t border-white/[0.06] pt-5">
            {Sound({})}
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setFocus(true)}><Maximize2 size={14} /> Odak modu</button>
              <button className="btn-ghost" onClick={() => setShowCfg(s => !s)} aria-expanded={showCfg}><Settings2 size={14} /> Ayarlar</button>
            </div>
          </div>
          <p role="status" className="min-h-5 text-sm text-slate-300">{msg}</p>
        </Item>

        <Item className="card space-y-4">
          <div className="stat-label">Kayıt edilecek konu</div>
          <div><label htmlFor="ps">Ders</label>
            <select id="ps" value={cfg.subjectKey} onChange={e => setCfg(c => ({ ...c, subjectKey: e.target.value, topicKey: DGS_TOPIC_GROUPS[e.target.value][0].topics[0].value }))}>
              <option value="matematik">Matematik</option><option value="turkce">Türkçe</option></select></div>
          <div><label htmlFor="pt">Konu</label>
            <select id="pt" value={cfg.topicKey} onChange={e => setCfg(c => ({ ...c, topicKey: e.target.value }))}>
              {topics.map(g => <optgroup key={g.group} label={g.group}>{g.topics.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</optgroup>)}</select></div>
          <p className="text-xs text-slate-500">Her tamamlanan odak fazı otomatik olarak çalışma oturumu olarak kaydedilir; erken bitirirsen geçen tam dakikalar kaydedilir.</p>
          {showCfg && (
            <div className="space-y-3 border-t border-white/[0.06] pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label htmlFor="cw">Odak (dk)</label><input id="cw" type="number" min={1} max={120} value={cfg.work} onChange={setNum('work', 1, 120)} /></div>
                <div><label htmlFor="cs">Kısa mola (dk)</label><input id="cs" type="number" min={1} max={60} value={cfg.short} onChange={setNum('short', 1, 60)} /></div>
                <div><label htmlFor="cl">Uzun mola (dk)</label><input id="cl" type="number" min={1} max={90} value={cfg.long} onChange={setNum('long', 1, 90)} /></div>
                <div><label htmlFor="ce">Uzun mola her</label><input id="ce" type="number" min={2} max={10} value={cfg.every} onChange={setNum('every', 2, 10)} /></div>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm text-slate-300"><span id="auto-l">Sonraki fazı otomatik başlat</span>
                <button role="switch" aria-checked={cfg.auto} aria-labelledby="auto-l" onClick={() => setCfg(c => ({ ...c, auto: !c.auto }))} className={clsx('relative h-7 w-12 shrink-0 rounded-full border border-white/10 transition', cfg.auto ? 'bg-accent' : 'bg-white/10')}>
                  <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', cfg.auto ? 'left-6' : 'left-0.5')} /></button></div>
            </div>)}
        </Item>
      </div>

      {focus && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Odak modu" className="gpu fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-obsidian/95 backdrop-blur-2xl">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="focus-breath h-[60vmin] w-[60vmin] rounded-full" style={{ background: 'radial-gradient(closest-side, rgb(var(--glow-a) / .18), transparent)' }} /></div>
          <button onClick={() => setFocus(false)} aria-label="Odak modundan çık" className="btn-ghost absolute right-5 top-5 !p-3"><X size={18} /></button>
          <div className="relative flex flex-col items-center gap-8">{Ring({ size: Math.min(380, window.innerWidth - 48) })}{Controls()}{Sound({ compact: true })}
            <p className="text-xs text-slate-500">Çıkmak için Esc</p></div>
        </div>, document.body)}
    </>
  );
}
