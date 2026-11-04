import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { post, today } from '../lib/api.js';
import { DGS_TOPIC_GROUPS } from '../lib/curriculum.js';
import clsx from 'clsx';
import { Page, Item, Title } from '../components/ui.jsx';
import Pomodoro from '../components/Pomodoro.jsx';

const KEY = 'dgs_timer_v1';
const pad = n => String(n).padStart(2, '0');
const clock = ms => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };

// Zaman duvar saatine göre hesaplanır (sekme arka planda olsa da, sayfa yenilense de doğru kalır)
function Stopwatch() {
  const saved = useRef(JSON.parse(localStorage.getItem(KEY) || 'null'));
  const [acc, setAcc] = useState(saved.current?.acc ?? 0);            // birikmiş ms
  const [since, setSince] = useState(saved.current?.since ?? null);   // çalışıyorsa başlangıç zamanı
  const [now, setNow] = useState(Date.now());
  const [subjectKey, setSubject] = useState(saved.current?.subjectKey ?? 'matematik');
  const [topicKey, setTopic] = useState(saved.current?.topicKey ?? DGS_TOPIC_GROUPS.matematik[0].topics[0].value);
  const [q, setQ] = useState({ questionsSolved: 0, correctCount: 0, wrongCount: 0 });
  const [msg, setMsg] = useState('');

  const elapsed = acc + (since ? now - since : 0);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify({ acc, since, subjectKey, topicKey })); }, [acc, since, subjectKey, topicKey]);
  useEffect(() => { if (!since) return; const t = setInterval(() => setNow(n => { const d = Date.now(); return Math.floor((d - since) / 1000) === Math.floor((n - since) / 1000) ? n : d; }), 250); return () => clearInterval(t); }, [since]);

  const start = () => { setNow(Date.now()); setSince(Date.now()); };
  const pause = () => { setAcc(elapsed); setSince(null); };
  const minutes = Math.floor(elapsed / 60000);
  const bad = q.correctCount + q.wrongCount > q.questionsSolved;

  const finish = async () => {
    setMsg('');
    if (minutes < 1) return setMsg('Kaydetmek için en az 1 dakika çalışmalısın.');
    try {
      await post('/sessions', { subjectKey, topicKey, durationMinutes: Math.min(minutes, 1440), ...q, studyDate: today() });
      setAcc(0); setSince(null); setQ({ questionsSolved: 0, correctCount: 0, wrongCount: 0 }); setMsg(`${minutes} dk kaydedildi ✓`);
    } catch (e) { setMsg(e.message); }
  };
  const num = k => e => setQ(p => ({ ...p, [k]: Math.max(0, parseInt(e.target.value, 10) || 0) }));

  return (
    <>
      <Item className="card flex flex-col items-center gap-6 py-10">
        <div className="num text-6xl font-light tracking-tight text-slate-50 sm:text-7xl" role="timer" aria-live="off">{clock(elapsed)}</div>
        <div className="flex gap-3">
          {since ? <button className="btn" onClick={pause}><Pause size={16} /> Duraklat</button> : <button className="btn" onClick={start}><Play size={16} /> {elapsed ? 'Devam' : 'Başlat'}</button>}
          <button className="btn-ghost" disabled={!elapsed} onClick={finish}><Square size={14} /> Bitir ve kaydet</button>
        </div>
        {msg && <p role="status" className="text-sm text-slate-300">{msg}</p>}
      </Item>
      <Item className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label htmlFor="s">Ders</label>
          <select id="s" value={subjectKey} onChange={e => { setSubject(e.target.value); setTopic(DGS_TOPIC_GROUPS[e.target.value][0].topics[0].value); }}>
            <option value="matematik">Matematik</option><option value="turkce">Türkçe</option></select></div>
        <div className="lg:col-span-2"><label htmlFor="t">Konu</label>
          <select id="t" value={topicKey} onChange={e => setTopic(e.target.value)}>
            {DGS_TOPIC_GROUPS[subjectKey].map(g => <optgroup key={g.group} label={g.group}>{g.topics.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</optgroup>)}</select></div>
        <div><label htmlFor="qs">Çözülen soru</label><input id="qs" type="number" min={0} value={q.questionsSolved} onChange={num('questionsSolved')} /></div>
        <div><label htmlFor="qc">Doğru</label><input id="qc" type="number" min={0} value={q.correctCount} onChange={num('correctCount')} /></div>
        <div><label htmlFor="qw">Yanlış</label><input id="qw" type="number" min={0} value={q.wrongCount} onChange={num('wrongCount')} /></div>
        {bad && <p className="text-xs text-red-300 sm:col-span-3">Doğru + yanlış, çözülen sorudan fazla olamaz</p>}
      </Item>
    </>
  );
}

export default function Timer() {
  const [mode, setMode] = useState(() => localStorage.getItem('dgs_timer_mode') === 'kronometre' ? 'kronometre' : 'pomodoro');
  const pick = m => { setMode(m); localStorage.setItem('dgs_timer_mode', m); };
  return (
    <Page>
      <Title right={<div role="tablist" aria-label="Zamanlayıcı türü" className="glass-pill flex p-1">{[['pomodoro', 'Pomodoro & Odak'], ['kronometre', 'Kronometre']].map(([k, l]) => (
        <button key={k} role="tab" aria-selected={mode === k} onClick={() => pick(k)} className={clsx('rounded-full px-4 py-1.5 text-sm transition', mode === k ? 'bg-white/15 text-white' : 'text-slate-400')}>{l}</button>))}</div>}>Zamanlayıcı</Title>
      {mode === 'pomodoro' ? <Pomodoro /> : <Stopwatch />}
    </Page>
  );
}
