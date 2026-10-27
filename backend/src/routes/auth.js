const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const db = require('../db');
const config = require('../services/config');
const audit = require('../services/audit');
const pw = require('../services/passwords');
const mailer = require('../services/mailer');
const { userAccess, primaryRole } = require('../services/access');
const { authenticate } = require('../middleware/auth');
const { ah, parse, badRequest, HttpError } = require('../lib/http');

const router = express.Router();
const limiter = (max) => rateLimit({ windowMs: 15 * 60000, limit: max, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test', message: { error: 'Muitas requisições. Aguarde alguns minutos.' } });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createSession(req, user) {
  const sid = crypto.randomUUID();
  await db.query('INSERT INTO sessions (id, user_id, ip, user_agent) VALUES ($1,$2,$3,$4)', [sid, user.id, req.ip, (req.get('User-Agent') || '').slice(0, 500)]);
  const token = jwt.sign({ sub: user.id, sid, tv: user.token_version }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRY || '8h' });
  return token;
}

/** Dados da sessão enviados ao front-end (não inclui dados pessoais além do necessário ao menu). */
async function sessionPayload(userId) {
  const { rows } = await db.query('SELECT id, username, name, email, registration, position, hierarchy, department, preferences FROM users WHERE id = $1', [userId]);
  const u = rows[0];
  const acc = await userAccess(userId);
  const cfg = await config.all();
  return {
    id: u.id, username: u.username, name: u.name, email: u.email, registration: u.registration, position: u.position,
    hierarchy: u.hierarchy, department: u.department, roles: acc.roles, role: primaryRole(acc.roles), modules: acc.modules, isAdmin: acc.isAdmin,
    preferences: { theme: 'light', exercicio: +cfg['geral.exercicio'], ...(u.preferences || {}) },
    settings: {
      sessaoMin: cfg['geral.sessaoMin'], autoDismiss: cfg['painel.autoDismiss'], opacidade: cfg['painel.opacidade'], agrupar: cfg['painel.agrupar'],
      refresh: cfg['painel.refresh'], orgao: cfg['geral.orgao']
    }
  };
}

// POST /api/auth/login (RF01) — bloqueio após N falhas, mensagem genérica
router.post('/login', limiter(50), ah(async (req, res) => {
  const body = parse(z.object({ username: z.string().trim().min(1, 'Preencha todos os campos').max(160), password: z.string().min(1, 'Preencha todos os campos').max(128) }), req.body);
  const key = body.username.toLowerCase();
  const max = await config.get('geral.loginTentativas');
  const lockMin = await config.get('geral.loginBloqueioMin');

  const { rows: la } = await db.query('SELECT failures, locked_until FROM login_attempts WHERE username_key = $1', [key]);
  const att = la[0];
  if (att && att.locked_until && new Date(att.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(att.locked_until) - Date.now()) / 60000);
    throw new HttpError(423, `Conta bloqueada temporariamente. Tente novamente em ${mins} min.`);
  }

  const { rows } = await db.query('SELECT id, name, password_hash, status, token_version FROM users WHERE lower(username) = $1 OR lower(email) = $1', [key]);
  const user = rows[0];
  const ok = user ? await pw.compare(body.password, user.password_hash) : (await pw.compare(body.password, pw.DUMMY_HASH), false);

  if (!ok || user.status !== 'active') {
    const prev = att && (!att.locked_until || new Date(att.locked_until) <= new Date()) ? att.failures : 0;
    const n = prev + 1;
    const locked = n >= max;
    await db.query(
      `INSERT INTO login_attempts (username_key, failures, locked_until, updated_at) VALUES ($1,$2,$3,NOW())
       ON CONFLICT (username_key) DO UPDATE SET failures = $2, locked_until = $3, updated_at = NOW()`,
      [key, locked ? 0 : n, locked ? new Date(Date.now() + lockMin * 60000) : null]);
    await audit.log(req, { kind: 'login', action: locked ? 'Conta bloqueada' : 'Falha de login', module: 'auth', detail: 'Usuário: ' + body.username.slice(0, 80), level: locked ? 'critical' : 'warning', userName: 'desconhecido' });
    throw new HttpError(401, locked ? `Muitas tentativas. Conta bloqueada por ${lockMin} min.` : `Usuário ou senha inválidos (${max - n} tentativa(s) restante(s))`);
  }

  await db.query('DELETE FROM login_attempts WHERE username_key = $1', [key]);
  await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
  const token = await createSession(req, user);
  const acc = await userAccess(user.id);
  await audit.log(req, { kind: 'login', action: 'Login', module: 'auth', detail: 'Acesso ao sistema', actor: { id: user.id, name: user.name, roles: acc.roles } });
  res.json({ token, user: await sessionPayload(user.id) });
}));

// GET /api/auth/me — dados da sessão atual
router.get('/me', authenticate, ah(async (req, res) => {
  res.json(await sessionPayload(req.user.id));
}));

// POST /api/auth/logout
router.post('/logout', authenticate, ah(async (req, res) => {
  await db.query("UPDATE sessions SET revoked_at = NOW(), revoked_reason = 'logout' WHERE id = $1", [req.user.sid]);
  await audit.log(req, { action: 'Logout', module: 'auth', detail: 'Saída manual' });
  res.json({ success: true });
}));

// GET /api/auth/password-rules — regras exibidas nas telas de senha
router.get('/password-rules', ah(async (req, res) => {
  res.json({ min: Math.max(8, await config.get('geral.senhaMin')), complex: (await config.get('geral.senhaComplexa')) !== false });
}));

// POST /api/auth/forgot-password (RF03) — resposta sempre igual
router.post('/forgot-password', limiter(10), ah(async (req, res) => {
  const generic = { success: true, message: 'Se o e-mail constar na base, um link de redefinição foi enviado.' };
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 160) throw badRequest('E-mail inválido');
  const { rows } = await db.query("SELECT id, name FROM users WHERE lower(email) = $1 AND status = 'active'", [email]);
  if (rows.length) {
    const u = rows[0];
    const minutes = await config.get('geral.tokenSenhaMin');
    const raw = pw.randomToken();
    await db.query("UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL AND purpose = 'reset'", [u.id]);
    await db.query("INSERT INTO password_resets (user_id, token_hash, purpose, expires_at) VALUES ($1,$2,'reset', NOW() + make_interval(mins => $3))", [u.id, pw.sha256(raw), minutes]);
    try {
      await mailer.sendResetEmail(email, (process.env.APP_URL || '') + '/redefinir-senha?token=' + raw, minutes);
    } catch (e) {
      console.error('[auth] falha ao enviar e-mail de redefinição:', e.message);
    }
    await audit.log(req, { action: 'Redefinição de senha solicitada', module: 'auth', detail: 'Link enviado ao e-mail institucional', actor: { id: u.id, name: u.name, roles: [] }, targetUserId: u.id });
  }
  res.json(generic);
}));

// POST /api/auth/reset-password — token de uso único; encerra todas as sessões
router.post('/reset-password', limiter(20), ah(async (req, res) => {
  const body = parse(z.object({ token: z.string().regex(/^[0-9a-f]{64}$/, 'Link inválido ou expirado'), password: z.string() }), req.body);
  const err = await pw.validate(body.password);
  if (err) throw badRequest(err);
  const hash = await pw.hash(body.password);
  const userId = await db.tx(async (c) => {
    const r = await c.query('SELECT id, user_id FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW() FOR UPDATE', [pw.sha256(body.token)]);
    if (!r.rows.length) throw badRequest('Link inválido ou expirado. Solicite um novo.');
    await c.query('UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW() WHERE id = $2', [hash, r.rows[0].user_id]);
    await c.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [r.rows[0].user_id]);
    await c.query("UPDATE sessions SET revoked_at = NOW(), revoked_reason = 'senha_redefinida' WHERE user_id = $1 AND revoked_at IS NULL", [r.rows[0].user_id]);
    return r.rows[0].user_id;
  });
  const { rows } = await db.query('SELECT name, username FROM users WHERE id = $1', [userId]);
  await db.query('DELETE FROM login_attempts WHERE username_key = $1', [rows[0].username.toLowerCase()]);
  await audit.log(req, { action: 'Senha redefinida', module: 'auth', detail: 'Por link de redefinição; sessões encerradas', actor: { id: userId, name: rows[0].name, roles: [] }, targetUserId: userId });
  res.json({ success: true });
}));

// PUT /api/auth/password — troca pelo próprio usuário (Meus Dados)
router.put('/password', authenticate, ah(async (req, res) => {
  const body = parse(z.object({ currentPassword: z.string().min(1, 'Informe a senha atual.').max(128), newPassword: z.string().max(128) }), req.body);
  const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await pw.compare(body.currentPassword, rows[0].password_hash))) {
    await audit.log(req, { action: 'Falha na troca de senha', module: 'perfil', detail: 'Senha atual incorreta', level: 'warning' });
    throw badRequest('Senha atual incorreta.');
  }
  const err = await pw.validate(body.newPassword);
  if (err) throw badRequest(err);
  if (body.newPassword === body.currentPassword) throw badRequest('A nova senha deve ser diferente da atual.');
  const hash = await pw.hash(body.newPassword);
  const u = await db.tx(async (c) => {
    const r = await c.query('UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW() WHERE id = $2 RETURNING id, token_version', [hash, req.user.id]);
    await c.query("UPDATE sessions SET revoked_at = NOW(), revoked_reason = 'senha_alterada' WHERE user_id = $1 AND revoked_at IS NULL", [req.user.id]);
    return r.rows[0];
  });
  const token = await createSession(req, u);
  await audit.log(req, { action: 'Senha alterada', module: 'perfil', detail: 'Outras sessões encerradas' });
  res.json({ success: true, token });
}));

// PUT /api/auth/preferences — tema e exercício fiscal (por usuário)
router.put('/preferences', authenticate, ah(async (req, res) => {
  const body = parse(z.object({ theme: z.enum(['light', 'dark']).optional(), exercicio: z.number().int().min(2000).max(2100).optional() }), req.body);
  const prefs = { ...req.user.preferences, ...body };
  await db.query('UPDATE users SET preferences = $1 WHERE id = $2', [JSON.stringify(prefs), req.user.id]);
  if (body.theme && body.theme !== req.user.preferences.theme) await audit.log(req, { action: 'Tema alterado', module: 'perfil', detail: body.theme === 'dark' ? 'Modo escuro' : 'Modo padrão' });
  res.json({ preferences: prefs });
}));

module.exports = router;
module.exports.createSession = createSession;
