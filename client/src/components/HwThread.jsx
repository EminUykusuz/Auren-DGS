import clsx from 'clsx';

export const fmtDate = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : '');
export const fmtDay = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' }) : '');

const LABEL = { request: 'Yeni tarih istedi', accept: 'Tarihi onayladı', reject: 'Talebi reddetti', set: 'Yeni tarih belirledi' };

// Öğrenci ile öğretmen arasındaki teslim tarihi yazışması (iki panelde de aynı görünür). Sağdaki balon: "ben".
export function ThreadList({ thread, me }) {
  if (!thread?.length) return <p className="text-xs text-slate-500">Henüz yazışma yok.</p>;
  return (
    <ul className="space-y-2" aria-label="Teslim tarihi yazışması">
      {thread.map(t => {
        const mine = t.role === me;
        return (
          <li key={t.id} className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
            <div className={clsx('max-w-[88%] rounded-2xl px-3.5 py-2 text-sm', mine ? 'bg-accent/15 text-slate-100' : 'bg-white/8 text-slate-200')}>
              <p className="text-[11px] text-slate-500">{t.author || (t.role === 'staff' ? 'Öğretmen' : 'Öğrenci')} · {new Date(t.at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              {LABEL[t.kind] && <p className="font-medium">{LABEL[t.kind]}{t.proposedDue ? ': ' + fmtDay(t.proposedDue) : ''}</p>}
              {t.body && <p className="whitespace-pre-wrap break-words">{t.body}</p>}
            </div>
          </li>);
      })}
    </ul>
  );
}

export const Pill = ({ tone = 'slate', children }) => (
  <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
    tone === 'red' && 'bg-red-500/15 text-red-300', tone === 'green' && 'bg-emerald-500/15 text-emerald-300',
    tone === 'amber' && 'bg-amber-500/15 text-amber-300', tone === 'accent' && 'bg-accent/15 text-accent', tone === 'slate' && 'bg-white/10 text-slate-300')}>{children}</span>
);
