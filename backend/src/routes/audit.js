/**
 * Log e Auditoria (somente Administrativo).
 */
const express = require('express');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const { ah } = require('../lib/http');
const { csv } = require('../lib/csv');
const { MODULE_LABEL } = require('../services/access');

const router = express.Router();
const MODS = { ...MODULE_LABEL, auth: 'Autenticação', usuarios: 'Usuários & Permissões', inventario: 'Inventário', auditoria: 'Auditoria', perfil: 'Perfil' };

function filters(q) {
  const where = [], p = [];
  if (q.module && q.module !== 'todos') { p.push(q.module); where.push('module = $' + p.length); }
  if (['info', 'warning', 'critical'].includes(q.level)) { p.push(q.level); where.push('level = $' + p.length); }
  const period = q.period === undefined ? '30' : q.period;
  if (period !== 'todos' && /^\d{1,4}$/.test(period)) { p.push(+period); where.push(`ts >= NOW() - make_interval(days => $${p.length})`); }
  if (q.q && String(q.q).trim()) { p.push('%' + String(q.q).trim().toLowerCase().slice(0, 100) + '%'); where.push(`lower(user_name || ' ' || action || ' ' || detail) LIKE $${p.length}`); }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', p };
}

const row = (a) => ({ id: a.id, ts: a.ts, user: a.user_name, role: a.user_role, action: a.action, module: a.module, moduleLabel: MODS[a.module] || a.module, detail: a.detail, level: a.level, device: a.device, ip: a.ip });

router.get('/', ah(async (req, res) => {
  const { sql, p } = filters(req.query);
  const max = await config.get('audit.maxRegistros');
  const [list, kpi, mods] = await Promise.all([
    db.query(`SELECT * FROM audit_logs ${sql} ORDER BY ts DESC, id DESC LIMIT ${+max}`, p),
    db.query(`SELECT COUNT(*)::int total,
                     COUNT(*) FILTER (WHERE action = 'Falha de login')::int falhas,
                     COUNT(*) FILTER (WHERE action = 'Acesso negado')::int negados,
                     COUNT(*) FILTER (WHERE level = 'critical')::int criticos
                FROM audit_logs ${sql}`, p),
    db.query('SELECT DISTINCT module FROM audit_logs ORDER BY module')
  ]);
  res.json({ rows: list.rows.map(row), kpis: kpi.rows[0], modules: mods.rows.map((m) => ({ value: m.module, label: MODS[m.module] || m.module })), limit: max });
}));

router.get('/export.csv', ah(async (req, res) => {
  const { sql, p } = filters(req.query);
  const { rows } = await db.query(`SELECT * FROM audit_logs ${sql} ORDER BY ts DESC, id DESC LIMIT 50000`, p);
  const fmt = (d) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(',', '');
  const LV = { info: 'Informativo', warning: 'Atenção', critical: 'Crítico' };
  const lines = [['Data/hora', 'Usuário', 'Perfil', 'Ação', 'Módulo', 'Detalhe', 'Gravidade', 'Dispositivo', 'IP']]
    .concat(rows.map((a) => [fmt(a.ts), a.user_name, a.user_role, a.action, MODS[a.module] || a.module, a.detail, LV[a.level], a.device, a.ip]));
  await audit.log(req, { kind: 'exportacao', action: 'Exportação do log', module: 'auditoria', detail: rows.length + ' registro(s)' });
  csv(res, `auditoria_${new Date().toISOString().slice(0, 10)}.csv`, lines);
}));

module.exports = router;
