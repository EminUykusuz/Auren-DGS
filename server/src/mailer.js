import nodemailer from 'nodemailer';
import { config } from './config.js';
import { query } from './db.js';

const { host, port, secure, user, pass, from, to } = config.mail;
export const mailConfigured = !!(host && from && to);
export const mailReady = !!(host && from);   // şifre sıfırlama gibi kullanıcıya giden postalar için alıcı ayarı gerekmez

let transport;
const getTransport = () => transport ??= nodemailer.createTransport({ host, port, secure, auth: user ? { user, pass } : undefined, connectionTimeout: 8000, socketTimeout: 10000 });

const clean = s => String(s).replace(/[\r\n]+/g, ' ').trim(); // başlık enjeksiyonuna karşı

const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// E-posta istemcileri CSS dosyası/sınıf desteklemez: tablo düzeni ve satır içi stil kullanılır.
export function resetMailHtml(link, minutes) {
  const l = esc(link);
  return `<!doctype html><html lang="tr"><body style="margin:0;padding:0;background:#f3f4f6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Şifreni yenilemek için bağlantı ${minutes} dakika geçerli.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937">
<tr><td style="background:#0f172a;border-top:4px solid #10b981;padding:20px 28px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:30px;height:30px;background:#10b981;border-radius:8px;text-align:center;color:#0f172a;font-size:17px;font-weight:800;line-height:30px">A</td><td style="padding-left:12px;color:#ffffff;font-size:19px;font-weight:700;letter-spacing:.2px">Auren Study</td></tr></table></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:20px;color:#111827">Şifreni yenile</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151">Hesabın için şifre sıfırlama isteği aldık. Aşağıdaki düğmeyle yeni şifreni belirleyebilirsin. Bağlantı <b>${minutes} dakika</b> geçerli.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#10b981;border-radius:10px"><a href="${l}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Şifremi yenile</a></td></tr></table>
<p style="margin:22px 0 6px;font-size:13px;color:#6b7280">Düğme çalışmazsa bu adresi tarayıcına yapıştır:</p>
<p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;color:#6b7280"><a href="${l}" style="color:#059669">${l}</a></p>
<hr style="border:0;border-top:1px solid #e5e7eb;margin:26px 0 16px">
<p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af">Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez. Bağlantıyı kimseyle paylaşma.</p>
</td></tr></table>
<p style="margin:14px 0 0;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif">© Auren Study · aurenstudy.com.tr</p>
</td></tr></table></body></html>`;
}

// Şifre sıfırlama e-postası. Başarısızlık sessizce günlüğe yazılır (bağlantı/token günlüğe girmez); çağıran yanıtı değiştirmez.
export async function sendResetMail(toAddr, link, minutes) {
  if (!mailReady) return { status: 'queued' };
  try {
    await getTransport().sendMail({
      from, to: toAddr, subject: 'Auren Study · Şifre sıfırlama',
      text: `Merhaba,

Auren Study hesabın için şifre sıfırlama isteği aldık. Şifreni yenilemek için ${minutes} dakika içinde şu bağlantıyı aç:

${link}

Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.

Auren Study`,
      html: resetMailHtml(link, minutes),
    });
    return { status: 'sent' };
  } catch (e) { console.error('[mail] şifre sıfırlama gönderilemedi:', String(e.message).slice(0, 200)); return { status: 'failed' }; }
}

// Kurum öğrencisinin e-postası yoksa sistem ona `kullanici@ogrenci.invalid` yer tutucusu yazar; bu adrese posta gitmez.
export const isRealEmail = (e) => typeof e === 'string' && e.includes('@') && !e.endsWith('@ogrenci.invalid');
const trDate = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }) : null);

export function homeworkMailHtml({ name, teacher, inst, title, due, items, personal, link }) {
  const rows = items.slice(0, 8).map(i => `<tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#1f2937">${esc(i.topic)}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;white-space:nowrap">${i.target ? esc(i.target) + ' soru' : ''}</td></tr>`).join('');
  const more = items.length > 8 ? `<p style="margin:8px 0 0;font-size:12px;color:#9ca3af">… ve ${items.length - 8} madde daha</p>` : '';
  const dueTxt = trDate(due);
  return `<!doctype html><html lang="tr"><body style="margin:0;padding:0;background:#f3f4f6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(teacher)} sana yeni bir ödev verdi: ${esc(title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937">
<tr><td style="background:#0f172a;border-top:4px solid #10b981;padding:20px 28px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:30px;height:30px;background:#10b981;border-radius:8px;text-align:center;color:#0f172a;font-size:17px;font-weight:800;line-height:30px">A</td><td style="padding-left:12px;color:#ffffff;font-size:19px;font-weight:700">Auren Study</td></tr></table></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:13px;color:#6b7280">${esc(inst)}</p>
<h1 style="margin:0 0 12px;font-size:20px;color:#111827">Yeni ödevin var</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#374151">Merhaba ${esc(name)}, <b>${esc(teacher)}</b> ${personal ? 'sana özel' : 'sınıfına'} bir ödev verdi.</p>
<div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:18px">
<p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#111827">${esc(title)}</p>
${dueTxt ? `<p style="margin:0 0 10px;font-size:13px;color:#b45309">Teslim: <b>${esc(dueTxt)}</b></p>` : '<p style="margin:0 0 10px"></p>'}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>${more}</div>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#10b981;border-radius:10px"><a href="${esc(link)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Ödevimi aç</a></td></tr></table>
<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#9ca3af">Ödevi bitirince panelden “Ödevi bitirdim” de. Süre yetmezse teslim tarihini öğretmeninle panelden konuşabilirsin.</p>
</td></tr></table>
<p style="margin:14px 0 0;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif">© Auren Study · Bu bildirimi almak istemezsen yöneticinden e-posta adresini kaldırmasını iste.</p>
</td></tr></table></body></html>`;
}

// Ödev verildiğinde öğrencilere bildirim. Beklenmez (yanıtı geciktirmez); tek tek, aralıklı gönderilir (Gmail/SMTP hız sınırı).
// targets: [{ id, due }]. E-postası olmayan ya da pasif öğrenci atlanır. Hatalar yalnızca günlüğe yazılır.
const MAIL_CAP = 300, MAIL_GAP_MS = 400;
export async function notifyHomework(targets, { title, items, teacher, inst, personal }) {
  if (!mailReady || !targets.length) return { sent: 0 };
  try {
    const ids = targets.slice(0, MAIL_CAP).map(t => Number(t.id)).filter(Number.isInteger);   // sayıya zorlandı: SQL'e güvenle gömülür
    if (!ids.length) return { sent: 0 };
    const users = await query(`SELECT Id, Email, COALESCE(FullName, Username) AS Name FROM dbo.Users WHERE Id IN (${ids.join(',')}) AND IsDisabled=0`);
    const dueBy = new Map(targets.map(t => [Number(t.id), t.due]));
    let sent = 0;
    for (const u of users) {
      if (!isRealEmail(u.Email)) continue;
      try {
        await getTransport().sendMail({ from, to: u.Email, subject: `Yeni ödev: ${clean(title)}`,
          text: `Merhaba ${u.Name},

${teacher} ${personal ? 'sana özel' : 'sınıfına'} yeni bir ödev verdi: ${title}
${dueBy.get(u.Id) ? 'Teslim: ' + dueBy.get(u.Id) : ''}

Ödevini açmak için: ${config.appUrl}/odev

Auren Study`,
          html: homeworkMailHtml({ name: u.Name, teacher, inst, title, due: dueBy.get(u.Id), items, personal, link: `${config.appUrl}/odev` }) });
        sent++;
      } catch (e) { console.error('[mail] ödev bildirimi gönderilemedi:', String(e.message).slice(0, 160)); }
      await new Promise(r => setTimeout(r, MAIL_GAP_MS));
    }
    return { sent };
  } catch (e) { console.error('[mail] ödev bildirimi hatası:', String(e.message).slice(0, 160)); return { sent: 0 }; }
}

// Döner: { status: 'sent' | 'queued' | 'failed', error? }
export async function sendFeedbackMail({ id, username, email, category, subject, message }) {
  if (!mailConfigured) return { status: 'queued' };
  try {
    await getTransport().sendMail({
      from, to, replyTo: email,
      subject: `[Auren DGS · ${clean(category)}] ${clean(subject)}`,
      text: `Gönderen: @${clean(username)} <${clean(email)}>\nKayıt no: ${id}\n\n${message}`,
    });
    return { status: 'sent' };
  } catch (e) { return { status: 'failed', error: String(e.message).slice(0, 300) }; }
}
