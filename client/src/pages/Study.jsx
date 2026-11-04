import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { get, post, del, net, fmt, today } from '../lib/api.js';
import { DGS_TOPIC_GROUPS } from '../lib/curriculum.js';
import { Page, Item, Title } from '../components/ui.jsx';
import SortTable from '../components/SortTable.jsx';

const topicLabel = k => Object.values(DGS_TOPIC_GROUPS).flat().flatMap(g => g.topics).find(t => t.value === k)?.label ?? k;

export default function Study() {
  const [list, setList] = useState([]); const [err, setErr] = useState('');
  const [f, setF] = useState({ subjectKey: 'matematik', topicKey: DGS_TOPIC_GROUPS.matematik[0].topics[0].value, durationMinutes: 60, questionsSolved: 0, correctCount: 0, wrongCount: 0, studyDate: today() });
  const load = () => get('/sessions').then(r => setList(r.sessions));
  useEffect(() => { load(); }, []);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const num = k => e => set(k, e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0));
  const invalid = f.correctCount + f.wrongCount > f.questionsSolved;

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await post('/sessions', f); setF(p => ({ ...p, questionsSolved: 0, correctCount: 0, wrongCount: 0 })); load(); } catch (x) { setErr(x.message); }
  };

  const cols = useMemo(() => [
    { key: 'StudyDate', label: 'Tarih', firstDir: -1, className: 'num whitespace-nowrap' },
    { key: 'TopicKey', label: 'Konu', sort: r => topicLabel(r.TopicKey), render: r => <span className="text-slate-100">{topicLabel(r.TopicKey)}</span> },
    { key: 'DurationMinutes', label: 'Süre', align: 'right', firstDir: -1, render: r => `${r.DurationMinutes} dk` },
    { key: 'QuestionsSolved', label: 'Soru', align: 'right', firstDir: -1 },
    { key: 'CorrectCount', label: 'D / Y', align: 'right', render: r => `${r.CorrectCount} / ${r.WrongCount}` },
    { key: 'Net', label: 'Net', align: 'right', firstDir: -1, render: r => <span className="font-semibold text-accent">{fmt(r.Net)}</span> },
    { key: 'del', label: '', sort: false, align: 'right', render: r => <button aria-label="Sil" className="text-slate-500 transition hover:text-red-300" onClick={() => del('/sessions/' + r.Id).then(load)}><Trash2 size={14} /></button> },
  ], []); // eslint-disable-line

  const totalMin = list.reduce((s, x) => s + x.DurationMinutes, 0);

  return (
    <Page>
      <Title>Çalışma kaydı</Title>
      <div className="grid gap-4 xl:grid-cols-[380px_1fr] xl:items-start">
        <Item className="xl:sticky xl:top-4">
          <form onSubmit={submit} className="card space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="s">Ders</label>
                <select id="s" value={f.subjectKey} onChange={e => setF(p => ({ ...p, subjectKey: e.target.value, topicKey: DGS_TOPIC_GROUPS[e.target.value][0].topics[0].value }))}>
                  <option value="matematik">Matematik</option><option value="turkce">Türkçe</option></select></div>
              <div><label htmlFor="d">Tarih</label><input id="d" type="date" max={today()} value={f.studyDate} onChange={e => set('studyDate', e.target.value)} /></div>
            </div>
            <div><label htmlFor="t">Konu</label>
              <select id="t" value={f.topicKey} onChange={e => set('topicKey', e.target.value)}>
                {DGS_TOPIC_GROUPS[f.subjectKey].map(g => <optgroup key={g.group} label={g.group}>{g.topics.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</optgroup>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="m">Süre (dk)</label><input id="m" type="number" min={1} max={1440} value={f.durationMinutes} onChange={e => set('durationMinutes', Math.max(1, parseInt(e.target.value, 10) || 1))} /></div>
              <div><label htmlFor="q">Çözülen soru</label><input id="q" type="number" min={0} value={f.questionsSolved} onChange={num('questionsSolved')} /></div>
              <div><label htmlFor="c">Doğru</label><input id="c" type="number" min={0} value={f.correctCount} onChange={num('correctCount')} /></div>
              <div><label htmlFor="w">Yanlış</label><input id="w" type="number" min={0} value={f.wrongCount} onChange={num('wrongCount')} /></div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="text-sm text-slate-400">Net <span className="num ml-1 text-xl font-semibold text-accent">{fmt(net(f.correctCount, f.wrongCount))}</span></div>
              <button className="btn" disabled={invalid}>Kaydet</button>
            </div>
            {invalid && <p className="text-xs text-red-300">Doğru + yanlış, çözülen sorudan fazla olamaz</p>}
            {err && <p role="alert" className="text-xs text-red-300">{err}</p>}
          </form>
        </Item>
        <Item className="card">
          <div className="mb-3 flex items-baseline justify-between"><div className="stat-label">Geçmiş</div><div className="num text-xs text-slate-500">{list.length} kayıt · {fmt(totalMin / 60)} saat</div></div>
          <SortTable columns={cols} rows={list} rowKey={r => r.Id} defaultSort={{ key: 'StudyDate', dir: -1 }} dense empty="Henüz kayıt yok." />
        </Item>
      </div>
    </Page>
  );
}
