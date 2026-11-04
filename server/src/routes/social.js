import { Router } from 'express';
import { query } from '../db.js';
import { DGS_SUBJECTS } from '../curriculum.js';
import { requireAuth, requireFriend, wrap } from '../security.js';
import { masteryOf } from '../mastery.js';

const r = Router();
r.use(requireAuth);

const TOTAL_TOPICS = DGS_SUBJECTS.matematik.length + DGS_SUBJECTS.turkce.length;

// Haftanın başı (Pazartesi) — sunucu yerel tarihine göre, 'YYYY-MM-DD'
function weekStart() {
  const d = new Date();
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Tek bir kullanıcının özet istatistikleri. Yalnızca erişim kontrolünden geçmiş id'lerle çağrılır.
async function stats(userId, ws) {
  const [[w], exams, [best], prog] = await Promise.all([query(`SELECT COALESCE(SUM(DurationMinutes),0) AS Minutes, COALESCE(SUM(QuestionsSolved),0) AS Questions
    FROM dbo.StudySessions WHERE UserId=@u AND StudyDate >= CAST(@ws AS date)`, { u: userId, ws }),
  query(`SELECT TOP 5 CAST(MathNet AS float) AS M, CAST(TurkceNet AS float) AS T, CONVERT(char(10),ExamDate,23) AS D, ExamName
    FROM dbo.TrialExams WHERE UserId=@u ORDER BY ExamDate DESC, Id DESC`, { u: userId }),
  query(`SELECT MAX(CAST(MathNet + TurkceNet AS float)) AS B, COUNT(*) AS C FROM dbo.TrialExams WHERE UserId=@u`, { u: userId }),
  query(`SELECT SubjectKey, SUM(CASE WHEN Status='completed' THEN 1 ELSE 0 END) AS Done, SUM(CompletedQuestions) AS Solved
    FROM dbo.SubjectProgress WHERE UserId=@u GROUP BY SubjectKey`, { u: userId })]);
  const sub = k => { const p = prog.find(x => x.SubjectKey === k); const tot = DGS_SUBJECTS[k].length; return { done: p?.Done ?? 0, total: tot, solved: p?.Solved ?? 0, percent: Math.round(((p?.Done ?? 0) / tot) * 100) }; };
  const avg = a => a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 100) / 100 : 0;
  const totals = exams.map(e => e.M + e.T);
  const done = sub('matematik').done + sub('turkce').done;
  return {
    weeklyHours: Math.round((w.Minutes / 60) * 10) / 10,
    weeklyQuestions: w.Questions,
    examCount: best.C,
    avgNet: avg(totals), mathAvg: avg(exams.map(e => e.M)), turkceAvg: avg(exams.map(e => e.T)),
    bestNet: best.B ?? 0,
    trend: exams.map(e => ({ date: e.D, name: e.ExamName, net: e.M + e.T })).reverse(),
    subjects: { matematik: sub('matematik'), turkce: sub('turkce') },
    overallPercent: Math.round((done / TOTAL_TOPICS) * 100),
  };
}

// Konu güç analizi: yalnızca oturum sahibinin kendi verisi
r.get('/mastery', wrap(async (req, res) => {
  const agg = await query(`SELECT SubjectKey, TopicKey, COUNT(*) AS Sessions, COUNT(DISTINCT StudyDate) AS Days,
      SUM(QuestionsSolved) AS Solved, SUM(CorrectCount) AS Correct, SUM(WrongCount) AS Wrong, SUM(DurationMinutes) AS Minutes,
      CONVERT(char(10), MAX(StudyDate), 23) AS LastDate, DATEDIFF(day, MAX(StudyDate), CAST(GETDATE() AS date)) AS DaysSince
    FROM dbo.StudySessions WHERE UserId=@u GROUP BY SubjectKey, TopicKey`, { u: req.userId });
  const prog = await query(`SELECT SubjectKey, TopicKey, Status, TargetQuestions FROM dbo.SubjectProgress WHERE UserId=@u`, { u: req.userId });
  const keys = new Map();
  for (const a of agg) keys.set(a.SubjectKey + ':' + a.TopicKey, { a });
  for (const p of prog) keys.set(p.SubjectKey + ':' + p.TopicKey, { ...keys.get(p.SubjectKey + ':' + p.TopicKey), p });
  const topics = [...keys.values()].map(({ a, p }) => {
    const subjectKey = a?.SubjectKey ?? p.SubjectKey, topicKey = a?.TopicKey ?? p.TopicKey;
    const m = masteryOf({ correct: a?.Correct, wrong: a?.Wrong, solved: a?.Solved, days: a?.Days, daysSince: a?.DaysSince, target: p?.TargetQuestions ?? 100 });
    return { subjectKey, topicKey, status: p?.Status ?? 'in_progress', sessions: a?.Sessions ?? 0, days: a?.Days ?? 0, solved: a?.Solved ?? 0,
      correct: a?.Correct ?? 0, wrong: a?.Wrong ?? 0, minutes: a?.Minutes ?? 0, lastDate: a?.LastDate ?? null, daysSince: a?.DaysSince ?? null, ...m };
  });
  res.json({ topics });
}));

r.get('/stats/me', wrap(async (req, res) => res.json(await stats(req.userId, weekStart()))));

// Liderlik tablosu: yalnızca ben + kabul edilmiş arkadaşlarım
r.get('/leaderboard', wrap(async (req, res) => {
  const ws = weekStart();
  const people = await query(`SELECT u.Id, u.Username FROM dbo.Users u WHERE u.Id=@me OR EXISTS (
      SELECT 1 FROM dbo.Friendships f WHERE f.Status='accepted'
      AND ((f.RequesterId=@me AND f.AddresseeId=u.Id) OR (f.AddresseeId=@me AND f.RequesterId=u.Id)))`, { me: req.userId });
  const rows = await Promise.all(people.map(async p => {
    const s = await stats(p.Id, ws);
    return { userId: p.Id, username: p.Username, isMe: p.Id === req.userId, weeklyHours: s.weeklyHours, weeklyQuestions: s.weeklyQuestions, avgNet: s.avgNet, bestNet: s.bestNet, overallPercent: s.overallPercent };
  }));
  rows.sort((a, b) => b.weeklyHours - a.weeklyHours || b.avgNet - a.avgNet);
  res.json({ weekStart: ws, rows: rows.map((x, i) => ({ rank: i + 1, ...x })) });
}));

// Yüz yüze karşılaştırma — arkadaşlık doğrulanmadan hiçbir veri dönmez (Anti-IDOR)
r.get('/compare/:friendId', requireFriend('friendId'), wrap(async (req, res) => {
  const ws = weekStart();
  const [other] = await query(`SELECT Id, Username FROM dbo.Users WHERE Id=@id`, { id: req.otherId });
  const [me] = await query(`SELECT Id, Username FROM dbo.Users WHERE Id=@id`, { id: req.userId });
  const [a, b] = await Promise.all([stats(req.userId, ws), stats(req.otherId, ws)]);
  res.json({ weekStart: ws, me: { id: me.Id, username: me.Username, ...a }, friend: { id: other.Id, username: other.Username, ...b } });
}));

export default r;
