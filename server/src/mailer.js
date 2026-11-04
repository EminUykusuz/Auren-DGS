import nodemailer from 'nodemailer';
import { config } from './config.js';

const { host, port, secure, user, pass, from, to } = config.mail;
export const mailConfigured = !!(host && from && to);

let transport;
const getTransport = () => transport ??= nodemailer.createTransport({ host, port, secure, auth: user ? { user, pass } : undefined, connectionTimeout: 8000, socketTimeout: 10000 });

const clean = s => String(s).replace(/[\r\n]+/g, ' ').trim(); // başlık enjeksiyonuna karşı

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
