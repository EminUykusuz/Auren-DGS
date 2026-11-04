import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, validate, wrap } from '../security.js';

const r = Router();
r.use(requireAuth);

// Kullanıcı adına göre arama (yalnızca id + username döner, e-posta asla)
r.get('/search', validate(z.object({ q: z.string().trim().min(2).max(30).regex(/^[\p{L}\p{N}_.-]+$/u) }), 'query'), wrap(async (req, res) => {
  const rows = await query(
    `SELECT TOP 10 u.Id, u.Username,
       (SELECT TOP 1 f.Status FROM dbo.Friendships f WHERE f.PairLow = CASE WHEN u.Id<@me THEN u.Id ELSE @me END
          AND f.PairHigh = CASE WHEN u.Id<@me THEN @me ELSE u.Id END) AS Relation
     FROM dbo.Users u WHERE u.Id<>@me AND u.Username LIKE @like ESCAPE '\\' ORDER BY u.Username`,
    { me: req.userId, like: req.query.q.replace(/[%_\\[]/g, '\\$&') + '%' });
  res.json({ users: rows.map(x => ({ id: x.Id, username: x.Username, relation: x.Relation ?? null })) });
}));

r.get('/', wrap(async (req, res) => {
  const rows = await query(
    `SELECT f.Id, f.Status, f.RequesterId, u.Id AS OtherId, u.Username
     FROM dbo.Friendships f
     JOIN dbo.Users u ON u.Id = CASE WHEN f.RequesterId=@me THEN f.AddresseeId ELSE f.RequesterId END
     WHERE f.RequesterId=@me OR f.AddresseeId=@me ORDER BY u.Username`, { me: req.userId });
  const map = x => ({ friendshipId: x.Id, userId: x.OtherId, username: x.Username });
  res.json({
    friends: rows.filter(x => x.Status === 'accepted').map(map),
    incoming: rows.filter(x => x.Status === 'pending' && x.RequesterId !== req.userId).map(map),
    outgoing: rows.filter(x => x.Status === 'pending' && x.RequesterId === req.userId).map(map),
  });
}));

r.post('/request', validate(z.object({ username: z.string().trim().regex(/^[\p{L}\p{N}_.-]{3,30}$/u) })), wrap(async (req, res) => {
  const [t] = await query(`SELECT Id FROM dbo.Users WHERE Username=@u`, { u: req.body.username });
  if (!t || t.Id === req.userId) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  const [ex] = await query(`SELECT Id, Status, RequesterId FROM dbo.Friendships WHERE PairLow=@lo AND PairHigh=@hi`,
    { lo: Math.min(req.userId, t.Id), hi: Math.max(req.userId, t.Id) });
  if (ex) {
    // Karşı taraf zaten istek göndermişse otomatik kabul
    if (ex.Status === 'pending' && ex.RequesterId === t.Id) {
      await query(`UPDATE dbo.Friendships SET Status='accepted' WHERE Id=@id`, { id: ex.Id });
      return res.json({ status: 'accepted' });
    }
    return res.status(409).json({ error: ex.Status === 'accepted' ? 'Zaten arkadaşsınız' : 'İstek zaten gönderilmiş' });
  }
  await query(`INSERT INTO dbo.Friendships (RequesterId, AddresseeId) VALUES (@a,@b)`, { a: req.userId, b: t.Id });
  res.status(201).json({ status: 'pending' });
}));

const idParam = z.object({ id: z.coerce.number().int().positive() });

// Sadece isteğin muhatabı kabul/red edebilir (Anti-IDOR: WHERE AddresseeId = oturum kullanıcısı)
r.post('/:id/accept', validate(idParam, 'params'), wrap(async (req, res) => {
  const out = await query(`UPDATE dbo.Friendships SET Status='accepted' OUTPUT INSERTED.Id WHERE Id=@id AND AddresseeId=@me AND Status='pending'`, { id: req.params.id, me: req.userId });
  if (!out.length) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ ok: true });
}));

r.post('/:id/reject', validate(idParam, 'params'), wrap(async (req, res) => {
  const out = await query(`DELETE FROM dbo.Friendships OUTPUT DELETED.Id WHERE Id=@id AND AddresseeId=@me AND Status='pending'`, { id: req.params.id, me: req.userId });
  if (!out.length) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ ok: true });
}));

// Arkadaşlıktan çıkarma / isteği geri çekme (taraflardan biri)
r.delete('/:id', validate(idParam, 'params'), wrap(async (req, res) => {
  const out = await query(`DELETE FROM dbo.Friendships OUTPUT DELETED.Id WHERE Id=@id AND (RequesterId=@me OR AddresseeId=@me)`, { id: req.params.id, me: req.userId });
  if (!out.length) return res.status(404).json({ error: 'Bulunamadı' });
  res.json({ ok: true });
}));

export default r;
