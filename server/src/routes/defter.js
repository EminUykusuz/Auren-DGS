// Yanlış defteri: öğrencinin yanlış yaptığı soruların fotoğraflı kaydı. Her şey yalnız sahibine açıktır (UserId süzgeci).
// Fotoğraf istemcide küçültülmüş JPEG/WebP olarak base64 gelir; burada imza (magic bytes) ve boyut doğrulanır, DB'de saklanır.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, resolveExam, validate, wrap } from '../security.js';
import { sectionKeys, partOf, defaultPartOf, PART_SUBJECTS } from '../exams.js';

const r = Router();
r.use(requireAuth, resolveExam);
const idParam = z.object({ id: z.coerce.number().int().positive() });
const REASONS = ['dikkat', 'islem', 'konu', 'sure', 'formul', 'diger'];
export const MAX_PHOTO = 350 * 1024;   // küçültülmüş bir fotoğraf için bol; bunun üstü kötüye kullanım
export const MAX_QUESTIONS = 300;       // öğrenci başına

const MAGIC = { 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/webp': [0x52, 0x49, 0x46, 0x46] };
export function decodePhoto(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '');
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_PHOTO) return null;
  if (!MAGIC[m[1]].every((b, i) => buf[i] === b)) return null;
  if (m[1] === 'image/webp' && buf.subarray(8, 12).toString('ascii') !== 'WEBP') return null;
  return { mime: m[1], buf };
}

const base = {
  subject: z.string().max(20), topic: z.string().trim().max(80).optional(), reason: z.enum(REASONS).nullish(), note: z.string().trim().max(500).optional(),
};
const item = (x) => ({ id: x.Id, examType: x.ExamType, part: x.ExamPart, subject: x.Subject, topic: x.Topic ?? '', reason: x.Reason, note: x.Note ?? '', solved: !!x.IsSolved, hasPhoto: !!x.HasPhoto, createdAt: x.CreatedAt });

r.get('/', wrap(async (req, res) => {
  const rows = await query(`SELECT Id, ExamType, ExamPart, Subject, Topic, Reason, Note, IsSolved, CreatedAt, CASE WHEN Photo IS NULL THEN 0 ELSE 1 END AS HasPhoto
    FROM dbo.WrongQuestions WHERE UserId=@me AND ExamType=@x ORDER BY IsSolved, CreatedAt DESC, Id DESC`, { me: req.userId, x: req.examType });
  res.json({ examType: req.examType, items: rows.map(item) });
}));

r.get('/:id/photo', validate(idParam, 'params'), wrap(async (req, res) => {
  const [p] = await query(`SELECT Photo, PhotoMime FROM dbo.WrongQuestions WHERE Id=@id AND UserId=@me`, { id: req.params.id, me: req.userId });
  if (!p?.Photo) return res.status(404).json({ error: 'Bulunamadı' });
  res.set({ 'Content-Type': p.PhotoMime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=3600', 'Content-Disposition': 'inline' }).send(p.Photo);
}));

const createSchema = z.object({ ...base, examType: z.enum(['DGS', 'YKS', 'LGS']).optional(), part: z.string().max(3).optional(), photo: z.string().max(520_000).optional() }).strict();
r.post('/', validate(createSchema), wrap(async (req, res) => {
  const d = req.body, x = req.examType;
  const part = d.part ?? defaultPartOf(x);
  if (!partOf(x, part)) return res.status(400).json({ error: 'Geçersiz bölüm' });
  if (!sectionKeys(x).includes(d.subject) && !PART_SUBJECTS[x][part]?.some(s => s.key === d.subject)) return res.status(400).json({ error: 'Geçersiz ders' });
  let photo = null;
  if (d.photo) { photo = decodePhoto(d.photo); if (!photo) return res.status(400).json({ error: 'Fotoğraf geçersiz ya da çok büyük (en çok 350 KB; jpeg/png/webp)' }); }
  if (!photo && !d.note) return res.status(400).json({ error: 'Fotoğraf ya da not ekleyin' });
  const [{ N }] = await query(`SELECT COUNT(*) AS N FROM dbo.WrongQuestions WHERE UserId=@me`, { me: req.userId });
  if (N >= MAX_QUESTIONS) return res.status(409).json({ error: `Defterde en çok ${MAX_QUESTIONS} soru tutulur; çözdüklerini silin` });
  const [row] = await query(`INSERT INTO dbo.WrongQuestions (UserId, ExamType, ExamPart, Subject, Topic, Reason, Note, Photo, PhotoMime)
    OUTPUT INSERTED.Id VALUES (@me,@x,@p,@s,@t,@r,@n,@ph,@pm)`,
  { me: req.userId, x, p: part, s: d.subject, t: d.topic || null, r: d.reason ?? null, n: d.note || null, ph: photo?.buf ?? null, pm: photo?.mime ?? null });
  res.status(201).json({ id: row.Id });
}));

r.patch('/:id', validate(idParam, 'params'), validate(z.object({ solved: z.boolean().optional(), reason: z.enum(REASONS).nullish(), topic: z.string().trim().max(80).optional(), note: z.string().trim().max(500).optional() }).strict()), wrap(async (req, res) => {
  const d = req.body;
  const out = await query(`UPDATE dbo.WrongQuestions SET IsSolved=COALESCE(@sv,IsSolved), Reason=CASE WHEN @hr=1 THEN @r ELSE Reason END, Topic=COALESCE(@t,Topic), Note=COALESCE(@n,Note)
    OUTPUT INSERTED.Id WHERE Id=@id AND UserId=@me`,
  { id: req.params.id, me: req.userId, sv: d.solved === undefined ? null : (d.solved ? 1 : 0), hr: d.reason === undefined ? 0 : 1, r: d.reason ?? null, t: d.topic ?? null, n: d.note ?? null });
  if (!out.length) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ ok: true });
}));

r.delete('/:id', validate(idParam, 'params'), wrap(async (req, res) => {
  const out = await query(`DELETE FROM dbo.WrongQuestions OUTPUT DELETED.Id WHERE Id=@id AND UserId=@me`, { id: req.params.id, me: req.userId });
  if (!out.length) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ ok: true });
}));

export default r;
