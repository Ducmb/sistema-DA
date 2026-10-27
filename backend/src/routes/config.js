/**
 * Configurações do Sistema (somente Administrativo): parâmetros por módulo e matriz perfis × módulos.
 */
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const { SCHEMA, FIELDS, coerce, show } = require('../services/configSchema');
const { roleMatrix, ROLES, MODULES, MODULE_KEYS, ADMIN_ONLY } = require('../services/access');
const { ah, parse, badRequest } = require('../lib/http');

const router = express.Router();

async function payload() {
  const values = await config.all();
  const { rows } = await db.query('SELECT key FROM system_config');
  return { schema: SCHEMA, values, changed: rows.map((r) => r.key).filter((k) => FIELDS[k]) };
}

router.get('/', ah(async (req, res) => res.json(await payload())));

// PUT /api/config/values/:key  { value }
router.put('/values/:key', ah(async (req, res) => {
  const f = FIELDS[req.params.key];
  if (!f) throw badRequest('Configuração desconhecida.');
  const c = coerce(f, req.body ? req.body.value : undefined);
  if (!c.ok) throw badRequest(c.msg);
  const old = await config.get(f.key);
  if (JSON.stringify(old) !== JSON.stringify(c.value)) {
    await db.query(
      `INSERT INTO system_config (key, value, updated_by) VALUES ($1,$2,$3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`, [f.key, JSON.stringify(c.value), req.user.id]);
    config.invalidate();
    await audit.log(req, { action: 'Configuração alterada', module: 'configuracoes', detail: `${f.tabLabel} · ${f.label}: ${show(f, old)} → ${show(f, c.value)}`, changes: { key: f.key, de: old, para: c.value } });
  }
  res.json(await payload());
}));

// POST /api/config/reset/:tab — restaura padrão de uma aba
router.post('/reset/:tab', ah(async (req, res) => {
  const t = SCHEMA.find((x) => x.key === req.params.tab);
  if (!t) throw badRequest('Aba inválida.');
  const keys = t.groups.flatMap((g) => g.fields.map((f) => f.key));
  await db.query('DELETE FROM system_config WHERE key = ANY($1)', [keys]);
  config.invalidate();
  await audit.log(req, { action: 'Configurações restauradas', module: 'configuracoes', detail: t.label, level: 'warning' });
  res.json(await payload());
}));

// Matriz perfis × módulos
async function accessPayload() {
  return { roles: ROLES, modules: MODULES.map(([key, label]) => ({ key, label })), matrix: await roleMatrix() };
}

router.get('/access', ah(async (req, res) => res.json(await accessPayload())));

router.put('/access', ah(async (req, res) => {
  const b = parse(z.object({ role: z.enum(ROLES), module: z.enum(MODULE_KEYS), on: z.boolean() }), req.body);
  if (b.role === 'Administrativo') throw badRequest('O perfil Administrativo vê tudo e não pode ser alterado.');
  if (ADMIN_ONLY.includes(b.module) && b.on) throw badRequest('Log e Auditoria e Configurações são exclusivos do Administrativo.');
  const matrix = await roleMatrix();
  const cur = new Set(matrix[b.role]);
  if (b.on) cur.add(b.module); else cur.delete(b.module);
  await db.tx(async (c) => {
    await c.query('INSERT INTO role_modules_custom (role) VALUES ($1) ON CONFLICT DO NOTHING', [b.role]);
    await c.query('DELETE FROM role_modules WHERE role = $1', [b.role]);
    for (const m of cur) await c.query('INSERT INTO role_modules (role, module) VALUES ($1,$2)', [b.role, m]);
  });
  const label = MODULES.find((m) => m[0] === b.module)[1];
  await audit.log(req, { action: b.on ? 'Acesso Concedido' : 'Acesso Revogado', module: 'configuracoes', detail: 'Perfil ' + b.role + ' · ' + label, level: b.on ? 'info' : 'warning' });
  res.json(await accessPayload());
}));

router.post('/access/reset', ah(async (req, res) => {
  await db.query('DELETE FROM role_modules; DELETE FROM role_modules_custom;');
  await audit.log(req, { action: 'Acessos restaurados', module: 'configuracoes', detail: 'Matriz de perfis voltou ao padrão', level: 'warning' });
  res.json(await accessPayload());
}));

module.exports = router;
