import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { PARTS, PART_SUBJECTS, TOTAL_TOPICS, topicCount, partOf } from '../exams.js';
import { weeklyPoints } from '../calc.js';
import { requireAuth, requireFriend, resolveExam, validate, wrap } from '../security.js';
import { masteryOf } from '../mastery.js';

const r = Router();
r.use(requireAuth, resolveExam);

// Haftanın başı (Pazartesi) — sunucu yerel tarihine göre, 'YYYY-MM-DD'
function weekStart() {
  const d = new Date();
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Net karşılaştırması aynı bölümler arasında anlamlıdır: DGS → DGS, YKS → TYT (varsayılan) | AYT
const defaultPart = x => Object.keys(PARTS[x])[0];
const partQuery = validate(z.object({ examType: z.string().optional(), part: z.string().max(3).optional() }).passthrough(), 'query');
const resolvePart = (req, res, next) => {
  const part = req.query.part ?? defaultPart(req.examType);
  if (!partOf(req.examType, part)) return res.status(400).json({ error: 'Geçersiz bölüm' });
  req.part = part; next();
};

// Tek bir kullanıcının, seçili sınav türü ve bölümündeki özet istatistikleri.
// Yalnızca erişim kontrolünden geçmiş id'lerle çağrılır.
async function stats(userId, ws, x, part) {
  const [[w], exams, [best], prog, secs] = await Promise.all([
    query(`SELECT COALESCE(SUM(DurationMinutes),0) AS Minutes, COALESCE(SUM(QuestionsSolved),0) AS Questions
      FROM dbo.StudySessions WHERE UserId=@u AND ExamType=@x AND StudyDate >= CAST(@ws AS date)`, { u: userId, x, ws }),
    query(`SELECT TOP 5 CAST(TotalNet AS float) AS N, CONVERT(char(10),ExamDate,23) AS D, ExamName
      FROM dbo.TrialExams WHERE UserId=@u AND ExamType=@x AND ExamPart=@p ORDER BY ExamDate DESC, Id DESC`, { u: userId, x, p: part }),
    query(`SELECT MAX(CAST(TotalNet AS float)) AS B, COUNT(*) AS C FROM dbo.TrialExams WHERE UserId=@u AND ExamType=@x AND ExamPart=@p`, { u: userId, x, p: part }),
    query(`SELECT SubjectKey, SUM(CASE WHEN Status='completed' THEN 1 ELSE 0 END) AS Done, SUM(CompletedQuestions) AS Solved
      FROM dbo.SubjectProgress WHERE UserId=@u AND ExamType=@x AND ExamPart=@p GROUP BY SubjectKey`, { u: userId, x, p: part }),
    query(`SELECT s.SectionKey, AVG(CAST(s.Net AS float)) AS Avg FROM dbo.TrialExamSections s JOIN dbo.TrialExams t ON t.Id=s.ExamId
      WHERE t.UserId=@u AND t.ExamType=@x AND t.ExamPart=@p GROUP BY s.SectionKey`, { u: userId, x, p: part }),
  ]);
  const round2 = n => Math.round(n * 100) / 100;
  const subjects = Object.fromEntries(PART_SUBJECTS[x][part].map(({ key }) => {
    const p = prog.find(q => q.SubjectKey === key), total = topicCount(x, part, key);
    return [key, { done: p?.Done ?? 0, total, solved: p?.Solved ?? 0, percent: Math.round(((p?.Done ?? 0) / total) * 100) }];
  }));
  const done = Object.values(subjects).reduce((s, v) => s + v.done, 0);
  const avgNet = exams.length ? round2(exams.reduce((s, e) => s + e.N, 0) / exams.length) : 0;
  const weeklyHours = Math.round((w.Minutes / 60) * 10) / 10;
  return {
    examType: x, part,
    weeklyHours, weeklyQuestions: w.Questions,
    weeklyPoints: weeklyPoints({ weeklyHours, weeklyQuestions: w.Questions, avgNet }),
    examCount: best.C, avgNet, bestNet: best.B ?? 0,
    sections: partOf(x, part).sections.map(s => ({ key: s.key, label: s.label, max: s.max, avg: round2(secs.find(q => q.SectionKey === s.key)?.Avg ?? 0) })),
    trend: exams.map(e => ({ date: e.D, name: e.ExamName, net: e.N })).reverse(),
    subjects,
    overallPercent: Math.round((done / TOTAL_TOPICS[x][part]) * 100),
  };
}

// Konu güç analizi: yalnızca oturum sahibinin kendi verisi, seçili sınav türü
r.get('/mastery', partQuery, resolvePart, wrap(async (req, res) => {
  const x = req.examType, part = req.part;
  const agg = await query(`SELECT SubjectKey, TopicKey, COUNT(*) AS Sessions, COUNT(DISTINCT StudyDate) AS Days,
      SUM(QuestionsSolved) AS Solved, SUM(CorrectCount) AS Correct, SUM(WrongCount) AS Wrong, SUM(DurationMinutes) AS Minutes,
      CONVERT(char(10), MAX(StudyDate), 23) AS LastDate, DATEDIFF(day, MAX(StudyDate), CAST(GETDATE() AS date)) AS DaysSince
    FROM dbo.StudySessions WHERE UserId=@u AND ExamType=@x AND ExamPart=@p GROUP BY SubjectKey, TopicKey`, { u: req.userId, x, p: part });
  const prog = await query(`SELECT SubjectKey, TopicKey, Status, TargetQuestions FROM dbo.SubjectProgress WHERE UserId=@u AND ExamType=@x AND ExamPart=@p`, { u: req.userId, x, p: part });
  const keys = new Map();
  for (const a of agg) keys.set(a.SubjectKey + ':' + a.TopicKey, { a });
  for (const p of prog) keys.set(p.SubjectKey + ':' + p.TopicKey, { ...keys.get(p.SubjectKey + ':' + p.TopicKey), p });
  const topics = [...keys.values()].map(({ a, p }) => {
    const subjectKey = a?.SubjectKey ?? p.SubjectKey, topicKey = a?.TopicKey ?? p.TopicKey;
    const m = masteryOf({ correct: a?.Correct, wrong: a?.Wrong, solved: a?.Solved, days: a?.Days, daysSince: a?.DaysSince, target: p?.TargetQuestions ?? 100 });
    return { subjectKey, topicKey, status: p?.Status ?? 'in_progress', sessions: a?.Sessions ?? 0, days: a?.Days ?? 0, solved: a?.Solved ?? 0,
      correct: a?.Correct ?? 0, wrong: a?.Wrong ?? 0, minutes: a?.Minutes ?? 0, lastDate: a?.LastDate ?? null, daysSince: a?.DaysSince ?? null, ...m };
  });
  res.json({ examType: x, part, topics });
}));

r.get('/stats/me', partQuery, resolvePart, wrap(async (req, res) => res.json(await stats(req.userId, weekStart(), req.examType, req.part))));

// Liderlik tablosu: yalnızca ben + kabul edilmiş arkadaşlarım; sıralama seçili sınav türüne göre
r.get('/leaderboard', partQuery, resolvePart, wrap(async (req, res) => {
  const ws = weekStart(), x = req.examType;
  const people = await query(`SELECT u.Id, u.Username, u.ExamMode, u.AvatarUrl FROM dbo.Users u WHERE u.Id=@me OR EXISTS (
      SELECT 1 FROM dbo.Friendships f WHERE f.Status='accepted'
      AND ((f.RequesterId=@me AND f.AddresseeId=u.Id) OR (f.AddresseeId=@me AND f.RequesterId=u.Id)))`, { me: req.userId });
  const rows = await Promise.all(people.map(async p => {
    const s = await stats(p.Id, ws, x, req.part);
    return { userId: p.Id, username: p.Username, avatarUrl: p.AvatarUrl, isMe: p.Id === req.userId, mode: p.ExamMode, weeklyHours: s.weeklyHours, weeklyQuestions: s.weeklyQuestions,
      weeklyPoints: s.weeklyPoints, avgNet: s.avgNet, bestNet: s.bestNet, examCount: s.examCount, overallPercent: s.overallPercent,
      hasData: s.examCount > 0 || s.weeklyQuestions > 0 || s.weeklyHours > 0 };
  }));
  rows.sort((a, b) => b.weeklyPoints - a.weeklyPoints || b.avgNet - a.avgNet);
  res.json({ examType: x, part: req.part, weekStart: ws, rows: rows.map((v, i) => ({ rank: i + 1, ...v })) });
}));

// Yüz yüze karşılaştırma — arkadaşlık doğrulanmadan hiçbir veri dönmez (Anti-IDOR)
r.get('/compare/:friendId', requireFriend('friendId'), partQuery, resolvePart, wrap(async (req, res) => {
  const ws = weekStart(), x = req.examType;
  const [other] = await query(`SELECT Id, Username FROM dbo.Users WHERE Id=@id`, { id: req.otherId });
  const [me] = await query(`SELECT Id, Username FROM dbo.Users WHERE Id=@id`, { id: req.userId });
  const [a, b] = await Promise.all([stats(req.userId, ws, x, req.part), stats(req.otherId, ws, x, req.part)]);
  res.json({ examType: x, part: req.part, weekStart: ws, me: { id: me.Id, username: me.Username, ...a }, friend: { id: other.Id, username: other.Username, ...b } });
}));

export default r;
