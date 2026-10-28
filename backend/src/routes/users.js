/**
 * Gestão de Pessoal › Usuários & Permissões (RF06–RF08, RNF03).
 * Leitura: módulo rh. Alterações de cadastro, perfis e permissões: somente Administrativo.
 */
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const pw = require('../services/passwords');
const mailer = require('../services/mailer');
const { roleMatrix, computeModules, sortRoles, primaryRole, ROLES, MODULE_LABEL, OVERRIDABLE } = require('../services/access');
const { requireModule, requireAdmin } = require('../middleware/auth');
const { ah, parse, idParam, notFound, badRequest, conflict } = require('../lib/http');

const router = express.Router();
const INVITE_HOURS = 72;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadUsers(where = '', params = []) {
  const { rows } = await db.query(
    `SELECT u.id, u.username, u.name, u.email, u.registration, u.position, u.hierarchy, u.department, u.status, u.situacao, u.last_login,
            COALESCE((SELECT array_agg(role) FROM user_roles r WHERE r.user_id = u.id), '{}') AS roles,
            COALESCE((SELECT jsonb_object_agg(module, allowed) FROM user_module_overrides o WHERE o.user_id = u.id), '{}'::jsonb) AS overrides,
            EXISTS (SELECT 1 FROM password_resets p WHERE p.user_id = u.id AND p.purpose = 'convite' AND p.used_at IS NULL AND p.expires_at > NOW()) AS convite_pendente
       FROM users u ${where} ORDER BY u.name`, params);
  const matrix = await roleMatrix();
  return rows.map((u) => {
    const roles = sortRoles(u.roles);
    return { ...u, roles, role: primaryRole(roles), modules: computeModules(roles, u.overrides, matrix) };
  });
}

async function getUser(id) {
  const list = await loadUsers('WHERE u.id = $1', [id]);
  if (!list.length) throw notFound('Servidor não encontrado.');
  return list[0];
}

async function issueInvite(user) {
  const raw = pw.randomToken();
  await db.query("UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [user.id]);
  await db.query("INSERT INTO password_resets (user_id, token_hash, purpose, expires_at) VALUES ($1,$2,'convite', NOW() + make_interval(hours => $3))", [user.id, pw.sha256(raw), INVITE_HOURS]);
  try {
    await mailer.sendInviteEmail(user.email, user.name, (process.env.APP_URL || '') + '/redefinir-senha?token=' + raw + '&convite=1', INVITE_HOURS);
  } catch (e) {
    console.error('[users] falha ao enviar convite:', e.message);
  }
}

// GET /api/users — lista de servidores com perfis e acessos
router.get('/', requireModule('rh'), ah(async (req, res) => {
  const users = await loadUsers();
  await audit.logPersonalRead(req, 'Lista de servidores (LGPD)');
  res.json({ users, roles: ROLES, modules: OVERRIDABLE.map((k) => ({ key: k, label: MODULE_LABEL[k] })) });
}));

// GET /api/users/history — auditoria de alterações de permissões e cadastro
router.get('/history', requireModule('rh'), ah(async (req, res) => {
  const { rows } = await db.query(
    `SELECT a.id, a.ts, a.user_name AS admin, a.action, a.detail, t.name AS target_user
       FROM audit_logs a LEFT JOIN users t ON t.id = a.target_user_id
      WHERE a.module = 'usuarios' ORDER BY a.ts DESC LIMIT 100`);
  res.json(rows);
}));

const userSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome completo.').max(160),
  email: z.string().trim().toLowerCase().max(160).regex(EMAIL, 'E-mail institucional inválido.'),
  department: z.string().trim().min(1, 'Informe o setor.').max(160),
  hierarchy: z.enum(['Diretoria', 'Chefia', 'Funcionário']).default('Funcionário'),
  registration: z.string().trim().max(40).optional().or(z.literal('')),
  position: z.string().trim().max(120).optional().or(z.literal('')),
  roles: z.array(z.enum(ROLES)).min(1, 'Selecione ao menos um perfil.').optional()
});

// POST /api/users — novo servidor (convite por e-mail para definir senha)
router.post('/', requireAdmin, ah(async (req, res) => {
  const b = parse(userSchema, req.body);
  const roles = sortRoles(b.roles && b.roles.length ? b.roles : [await config.get('rh.perfilPadrao')]);
  const dup = await db.query('SELECT 1 FROM users WHERE lower(email) = $1', [b.email]);
  if (dup.rows.length) throw conflict('Já existe um servidor com este e-mail.');
  if (b.registration) {
    const d2 = await db.query('SELECT 1 FROM users WHERE registration = $1', [b.registration]);
    if (d2.rows.length) throw conflict('Matrícula já cadastrada.');
  }
  let base = b.email.split('@')[0].replace(/[^a-z0-9._-]/g, '').slice(0, 60) || 'usuario', username = base, k = 1;
  while ((await db.query('SELECT 1 FROM users WHERE lower(username) = $1', [username])).rows.length) username = base + (++k);
  const id = await db.tx(async (c) => {
    const r = await c.query(
      `INSERT INTO users (username, email, name, registration, position, hierarchy, department, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [username, b.email, b.name, b.registration || null, b.position || null, b.hierarchy, b.department, pw.UNUSABLE]);
    for (const role of roles) await c.query('INSERT INTO user_roles (user_id, role) VALUES ($1,$2)', [r.rows[0].id, role]);
    return r.rows[0].id;
  });
  const user = await getUser(id);
  await issueInvite(user);
  await audit.log(req, { action: 'Usuário Criado', module: 'usuarios', detail: user.name + ' · Perfis: ' + roles.join(', '), targetUserId: id });
  res.status(201).json(await getUser(id));
}));

// PUT /api/users/:id — dados funcionais (somente administrador)
router.put('/:id', requireAdmin, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const before = await getUser(id);
  const b = parse(userSchema.omit({ roles: true }).extend({ status: z.enum(['active', 'inactive']).optional() }), req.body);
  if (b.status === 'inactive' && id === req.user.id) throw badRequest('Você não pode desativar o próprio acesso.');
  const dup = await db.query('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [b.email, id]);
  if (dup.rows.length) throw conflict('Já existe um servidor com este e-mail.');
  await db.query(
    `UPDATE users SET name=$1, email=$2, department=$3, hierarchy=$4, registration=$5, position=$6, status=COALESCE($7, status),
            token_version = token_version + CASE WHEN $7 = 'inactive' THEN 1 ELSE 0 END, updated_at = NOW() WHERE id = $8`,
    [b.name, b.email, b.department, b.hierarchy, b.registration || null, b.position || null, b.status || null, id]);
  const after = await getUser(id);
  const changed = ['name', 'email', 'department', 'hierarchy', 'registration', 'position', 'status'].filter((k) => String(before[k] || '') !== String(after[k] || ''));
  if (changed.length) await audit.log(req, { action: 'Cadastro alterado', module: 'usuarios', detail: after.name + ' · ' + changed.join(', '), targetUserId: id, changes: Object.fromEntries(changed.map((k) => [k, { de: before[k], para: after[k] }])) });
  res.json(after);
}));

// PUT /api/users/:id/roles — define os perfis (vários por usuário)
router.put('/:id/roles', requireAdmin, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(z.object({ roles: z.array(z.enum(ROLES)).min(1, 'O servidor precisa de ao menos um perfil.') }), req.body);
  const before = await getUser(id);
  const roles = sortRoles([...new Set(b.roles)]);
  if (!before.roles.length) {
    if (!before.email) throw badRequest('Cadastre o e-mail institucional do servidor (Gestão de Pessoal › Servidores) antes de conceder acesso.');
    if (['Desligado', 'Aposentado'].includes(before.situacao)) throw badRequest('Servidor com vínculo encerrado (desligado ou aposentado) não pode receber acesso.');
  }
  if (before.roles.includes('Administrativo') && !roles.includes('Administrativo')) {
    const { rows } = await db.query("SELECT COUNT(*)::int n FROM user_roles r JOIN users u ON u.id = r.user_id WHERE r.role = 'Administrativo' AND u.status = 'active'");
    if (rows[0].n <= 1) throw badRequest('Não é possível remover o último administrador do sistema.');
  }
  await db.tx(async (c) => {
    await c.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
    for (const r of roles) await c.query('INSERT INTO user_roles (user_id, role) VALUES ($1,$2)', [id, r]);
  });
  if (!before.roles.length) {
    const { rows: pwr } = await db.query("UPDATE users SET status = 'active' WHERE id = $1 RETURNING password_hash", [id]);
    if (pwr[0].password_hash === pw.UNUSABLE) await issueInvite(before);
  }
  const added = roles.filter((r) => !before.roles.includes(r)), removed = before.roles.filter((r) => !roles.includes(r));
  for (const r of added) await audit.log(req, { action: 'Perfil adicionado', module: 'usuarios', detail: before.name + ' · ' + r, targetUserId: id });
  for (const r of removed) await audit.log(req, { action: 'Perfil removido', module: 'usuarios', detail: before.name + ' · ' + r, level: 'warning', targetUserId: id });
  res.json(await getUser(id));
}));

// PUT /api/users/:id/access/:module — permissão individual (salvamento imediato, RF07)
router.put('/:id/access/:module', requireAdmin, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const mod = req.params.module;
  if (!OVERRIDABLE.includes(mod)) throw badRequest('Módulo inválido para permissão individual.');
  const { allowed } = parse(z.object({ allowed: z.boolean() }), req.body);
  const u = await getUser(id);
  if (u.roles.includes('Administrativo')) throw badRequest('O perfil Administrativo já tem acesso a todos os módulos.');
  await db.query(
    `INSERT INTO user_module_overrides (user_id, module, allowed) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, module) DO UPDATE SET allowed = $3, updated_at = NOW()`, [id, mod, allowed]);
  await audit.log(req, { action: allowed ? 'Acesso Concedido' : 'Acesso Revogado', module: 'usuarios', detail: u.name + ' · Módulo de ' + MODULE_LABEL[mod], level: allowed ? 'info' : 'warning', targetUserId: id });
  res.json(await getUser(id));
}));

// DELETE /api/users/:id/access/:module — volta a seguir o perfil
router.delete('/:id/access/:module', requireAdmin, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const u = await getUser(id);
  await db.query('DELETE FROM user_module_overrides WHERE user_id = $1 AND module = $2', [id, req.params.module]);
  await audit.log(req, { action: 'Permissão individual removida', module: 'usuarios', detail: u.name + ' · ' + (MODULE_LABEL[req.params.module] || req.params.module) + ' volta a seguir o perfil', targetUserId: id });
  res.json(await getUser(id));
}));

// POST /api/users/:id/invite — reenviar link para definir senha
router.post('/:id/invite', requireAdmin, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const u = await getUser(id);
  await issueInvite(u);
  await audit.log(req, { action: 'Convite reenviado', module: 'usuarios', detail: u.name, targetUserId: id });
  res.json({ success: true });
}));

module.exports = router;
