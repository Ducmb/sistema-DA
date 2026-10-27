/**
 * Envio de e-mail. Em produção exige SMTP_HOST (SMTP institucional).
 * Sem SMTP fora de produção, a mensagem vai para o console (e para outbox em testes).
 * Nunca registrar links de redefinição em log de produção.
 */
const nodemailer = require('nodemailer');
const config = require('./config');

const outbox = []; // usado pelos testes
let transport = null;

function getTransport() {
  if (transport) return transport;
  if (!process.env.SMTP_HOST) return null;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return transport;
}

async function send({ to, subject, text }) {
  const t = getTransport();
  if (!t) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP não configurado');
    outbox.push({ to, subject, text });
    if (process.env.NODE_ENV !== 'test') console.info(`[mailer:dev] Para: ${to}\nAssunto: ${subject}\n${text}\n`);
    return;
  }
  const from = (await config.get('geral.emailRemetente')) || process.env.SMTP_FROM;
  await t.sendMail({ from, to, subject, text });
}

async function sendResetEmail(to, link, minutes) {
  const orgao = await config.get('geral.orgao');
  await send({
    to,
    subject: 'Sistema DA — redefinição de senha',
    text: `Recebemos um pedido para redefinir sua senha no Sistema DA (${orgao}).\n\nAbra o link abaixo em até ${minutes} minutos. Ele só pode ser usado uma vez:\n${link}\n\nSe você não fez o pedido, ignore esta mensagem.`
  });
}

async function sendInviteEmail(to, name, link, hours) {
  const orgao = await config.get('geral.orgao');
  await send({
    to,
    subject: 'Sistema DA — defina sua senha de acesso',
    text: `Olá, ${name}.\n\nSeu acesso ao Sistema DA (${orgao}) foi cadastrado. Defina sua senha pelo link abaixo, válido por ${hours} horas e de uso único:\n${link}`
  });
}

module.exports = { send, sendResetEmail, sendInviteEmail, outbox };
