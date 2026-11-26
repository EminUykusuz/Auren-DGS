import nodemailer from 'nodemailer';
import { config } from './config.js';

const { host, port, secure, user, pass, from, to } = config.mail;
export const mailConfigured = !!(host && from && to);
export const mailReady = !!(host && from);   // şifre sıfırlama gibi kullanıcıya giden postalar için alıcı ayarı gerekmez

let transport;
const getTransport = () => transport ??= nodemailer.createTransport({ host, port, secure, auth: user ? { user, pass } : undefined, connectionTimeout: 8000, socketTimeout: 10000 });

const clean = s => String(s).replace(/[\r\n]+/g, ' ').trim(); // başlık enjeksiyonuna karşı

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
    });
    return { status: 'sent' };
  } catch (e) { console.error('[mail] şifre sıfırlama gönderilemedi:', String(e.message).slice(0, 200)); return { status: 'failed' }; }
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
