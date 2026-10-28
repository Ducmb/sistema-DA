/**
 * Gestão de Pessoal (módulo rh): servidores, férias/licenças e indicadores.
 * Perfis e permissões de acesso ficam em routes/users.js (somente Administrativo).
 */
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const pw = require('../services/passwords');
const { ah, parse, idParam, notFound, badRequest, conflict, forbidden } = require('../lib/http');
const { today, daysTo, bizDays, fmtBR } = require('../lib/dates');

const router = express.Router();
const SITUACOES = ['Ativo', 'Afastado', 'Desligado'];
const TIPOS = ['Férias', 'Licença Médica', 'Licença Maternidade', 'Licença Paternidade', 'Licença Capacitação', 'Licença para Tratar de Interesses Particulares'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const servidorOf = (u) => ({
  id: u.id, name: u.name, registration: u.registration || '', position: u.position || '', department: u.department || '',
  situacao: u.situacao, email: u.email || '', hierarchy: u.hierarchy, hasAccess: u.has_access
});

// ---------- Servidores ----------
router.get('/servidores', ah(async (req, res) => {
  const p = [], where = [];
  if (SITUACOES.includes(req.query.situacao)) { p.push(req.query.situacao); where.push('situacao = $' + p.length); }
  if (req.query.setor) { p.push(String(req.query.setor)); where.push('department = $' + p.length); }
  const { rows } = await db.query(
    `SELECT u.*, EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id) AS has_access FROM users u
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.name`, p);
  await audit.logPersonalRead(req, 'Lista de servidores (LGPD)');
  res.json(rows.map(servidorOf));
}));

const servidorSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome completo.').max(160),
  registration: z.string().trim().min(1, 'Informe a matrícula.').max(40),
  position: z.string().trim().max(120).optional().default(''),
  department: z.string().trim().max(160).optional().default(''),
  situacao: z.enum(SITUACOES).default('Ativo'),
  email: z.string().trim().toLowerCase().max(160).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'E-mail institucional inválido.').optional().or(z.literal(''))
});

async function checkDup(b, id) {
  const r = await db.query('SELECT 1 FROM users WHERE registration = $1 AND ($2::int IS NULL OR id <> $2)', [b.registration, id || null]);
  if (r.rows.length) throw conflict('Matrícula já cadastrada.');
  if (b.email) {
    const e = await db.query('SELECT 1 FROM users WHERE lower(email) = $1 AND ($2::int IS NULL OR id <> $2)', [b.email, id || null]);
    if (e.rows.length) throw conflict('Já existe um servidor com este e-mail.');
  }
}

router.post('/servidores', ah(async (req, res) => {
  const b = parse(servidorSchema, req.body);
  await checkDup(b);
  const username = 'mat-' + b.registration.toLowerCase().replace(/[^a-z0-9]/g, '');
  const { rows } = await db.query(
    `INSERT INTO users (username, email, name, registration, position, department, situacao, status, password_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'inactive',$8) RETURNING *, FALSE AS has_access`,
    [username, b.email || null, b.name, b.registration, b.position || null, b.department || null, b.situacao, pw.UNUSABLE]);
  await audit.log(req, { action: 'Servidor cadastrado', module: 'rh', detail: b.name + ' · MAT ' + b.registration, targetUserId: rows[0].id });
  res.status(201).json(servidorOf(rows[0]));
}));

router.put('/servidores/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(servidorSchema, req.body);
  const { rows: old } = await db.query('SELECT u.*, EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id) AS has_access FROM users u WHERE id = $1', [id]);
  if (!old.length) throw notFound('Servidor não encontrado.');
  const o = old[0];
  // RNF04: o próprio servidor não altera nome, matrícula, cargo nem e-mail institucional
  const proprio = ['name', 'registration', 'position', 'email'].filter((k) => String(b[k] || '') !== String(o[k] || ''));
  if (id === req.user.id && !req.user.isAdmin && proprio.length) {
    await audit.log(req, { action: 'Alteração bloqueada', module: 'rh', detail: 'Tentativa de alterar os próprios dados funcionais: ' + proprio.join(', '), level: 'warning', targetUserId: id });
    throw forbidden('Nome, matrícula, cargo e e-mail institucional não podem ser alterados pelo próprio servidor.');
  }
  // Cadastro de quem tem acesso ao sistema: e-mail (credencial), desligamento e dados de administradores só pelo Administrativo
  if (o.has_access && !req.user.isAdmin) {
    if ((b.email || '') !== (o.email || '')) throw forbidden('Somente o Administrativo altera o e-mail de quem tem acesso ao sistema.');
    if (b.situacao !== o.situacao && (b.situacao === 'Desligado' || o.situacao === 'Desligado')) throw forbidden('Somente o Administrativo desliga ou reativa quem tem acesso ao sistema.');
    const adm = await db.query("SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'Administrativo'", [id]);
    if (adm.rows.length) throw forbidden('Somente o Administrativo altera o cadastro de um administrador.');
  }
  if (id === req.user.id && b.situacao === 'Desligado') throw badRequest('Você não pode desligar o próprio cadastro.');
  await checkDup(b, id);
  const desligar = b.situacao === 'Desligado' && o.situacao !== 'Desligado';
  const { rows } = await db.query(
    `UPDATE users SET name=$1, registration=$2, position=$3, department=$4, situacao=$5::varchar, email=$6,
            status = CASE WHEN $5::varchar = 'Desligado' THEN 'inactive' WHEN status = 'inactive' AND $7::boolean THEN 'active' ELSE status END,
            token_version = token_version + CASE WHEN $8::boolean THEN 1 ELSE 0 END, updated_at = NOW()
      WHERE id = $9 RETURNING *, $7::boolean AS has_access`,
    [b.name, b.registration, b.position || null, b.department || null, b.situacao, b.email || null, o.has_access && o.password_hash !== pw.UNUSABLE, desligar, id]);
  if (desligar) await db.query("UPDATE sessions SET revoked_at = NOW(), revoked_reason = 'desligado' WHERE user_id = $1 AND revoked_at IS NULL", [id]);
  const changed = ['name', 'registration', 'position', 'department', 'situacao', 'email'].filter((k) => String(o[k] || '') !== String(rows[0][k] || ''));
  if (changed.length) await audit.log(req, { action: 'Servidor editado', module: 'rh', detail: rows[0].name + ' · MAT ' + rows[0].registration + ' · ' + changed.join(', '), targetUserId: id, level: desligar ? 'warning' : 'info', changes: Object.fromEntries(changed.map((k) => [k, { de: o[k], para: rows[0][k] }])) });
  res.json(servidorOf(rows[0]));
}));

// ---------- Férias e licenças ----------
const ausOf = (a) => ({ id: a.id, userId: a.user_id, employee: a.name, type: a.tipo, start: a.inicio, end: a.fim, days: daysTo(a.fim, a.inicio) + 1, status: a.status, notes: a.observacoes || '', requestedAt: a.solicitado_em, decidedBy: a.decidido_nome || '', decidedAt: a.decidido_em });

async function listAusencias(where = '', p = []) {
  const { rows } = await db.query(
    `SELECT a.*, u.name, d.name AS decidido_nome FROM rh_ausencias a JOIN users u ON u.id = a.user_id LEFT JOIN users d ON d.id = a.decidido_por
     ${where} ORDER BY a.inicio DESC, a.id DESC`, p);
  return rows.map(ausOf);
}

router.get('/ausencias', ah(async (req, res) => {
  res.json({ items: await listAusencias(), tipos: TIPOS, antecedencia: await config.get('rh.antecedencia') });
}));

router.post('/ausencias', ah(async (req, res) => {
  const b = parse(z.object({
    userId: z.number().int().positive('Selecione o servidor.'),
    type: z.enum(TIPOS),
    start: z.string().regex(ISO, 'Informe as datas de início e término.'),
    end: z.string().regex(ISO, 'Informe as datas de início e término.'),
    notes: z.string().trim().max(1000).optional().default('')
  }), req.body);
  if (b.end < b.start) throw badRequest('A data de término deve ser posterior ao início.');
  const days = daysTo(b.end, b.start) + 1;
  if (b.type === 'Férias' && days > 30) throw badRequest('Férias não podem exceder 30 dias por período.');
  if (b.type === 'Férias') {
    const ant = await config.get('rh.antecedencia');
    if (daysTo(b.start) < ant) throw badRequest(`Férias devem ser solicitadas com ao menos ${ant} dias de antecedência.`);
  }
  const { rows: u } = await db.query("SELECT name, situacao FROM users WHERE id = $1", [b.userId]);
  if (!u.length) throw notFound('Servidor não encontrado.');
  if (u[0].situacao === 'Desligado') throw badRequest('Servidor desligado não pode ter solicitações.');
  const { rows: overlap } = await db.query("SELECT 1 FROM rh_ausencias WHERE user_id = $1 AND status <> 'Recusado' AND inicio <= $3 AND fim >= $2", [b.userId, b.start, b.end]);
  if (overlap.length) throw conflict('Já existe solicitação para este servidor no período.');
  const { rows } = await db.query(
    'INSERT INTO rh_ausencias (user_id, tipo, inicio, fim, observacoes, solicitado_por) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [b.userId, b.type, b.start, b.end, b.notes || null, req.user.id]);
  await audit.log(req, { action: 'Solicitação de ' + b.type.toLowerCase(), module: 'rh', detail: u[0].name + ' · ' + fmtBR(b.start) + ' a ' + fmtBR(b.end), targetUserId: b.userId });
  res.status(201).json((await listAusencias('WHERE a.id = $1', [rows[0].id]))[0]);
}));

router.patch('/ausencias/:id/status', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { status } = parse(z.object({ status: z.enum(['Aprovado', 'Recusado']) }), req.body);
  const [a] = await listAusencias('WHERE a.id = $1', [id]);
  if (!a) throw notFound('Solicitação não encontrada.');
  if (a.status !== 'Pendente') throw badRequest('Solicitação já decidida.');
  if (a.userId === req.user.id) throw forbidden('Você não pode decidir a própria solicitação.');
  if ((await config.get('rh.aprovaChefia')) && !req.user.isAdmin && !['Chefia', 'Diretoria'].includes(req.user.hierarchy)) throw forbidden('A aprovação exige chefia ou diretoria.');
  await db.query('UPDATE rh_ausencias SET status = $1, decidido_por = $2, decidido_em = NOW() WHERE id = $3', [status, req.user.id, id]);
  await audit.log(req, { action: 'Solicitação ' + status.toLowerCase(), module: 'rh', detail: a.type + ' — ' + a.employee + ' · ' + fmtBR(a.start) + ' a ' + fmtBR(a.end), targetUserId: a.userId, level: status === 'Recusado' ? 'warning' : 'info' });
  res.json((await listAusencias('WHERE a.id = $1', [id]))[0]);
}));

// ---------- Indicadores ----------
router.get('/indicadores', ah(async (req, res) => {
  const hoje = today(), ano = hoje.slice(0, 4);
  const [{ rows: k }, { rows: setores }, { rows: aus }] = await Promise.all([
    db.query(`SELECT COUNT(*) FILTER (WHERE situacao <> 'Desligado')::int total,
                     COUNT(*) FILTER (WHERE situacao = 'Ativo')::int ativos,
                     COUNT(*) FILTER (WHERE situacao = 'Afastado')::int afastados,
                     COUNT(*) FILTER (WHERE situacao <> 'Desligado' AND created_at >= date_trunc('year', NOW()))::int novos
                FROM users`),
    db.query(`SELECT c.nome AS label, COUNT(u.id)::int n FROM cost_centers c LEFT JOIN users u ON u.department = c.nome AND u.situacao <> 'Desligado'
               WHERE c.ativo AND c.tipo = 'padrao' GROUP BY c.nome ORDER BY c.nome`),
    db.query(`SELECT COUNT(DISTINCT user_id) FILTER (WHERE tipo = 'Férias' AND status = 'Aprovado' AND to_char(inicio, 'YYYY') = $1)::int ferias_ano,
                     COUNT(DISTINCT user_id) FILTER (WHERE status = 'Aprovado' AND inicio <= $2 AND fim >= $2)::int ausentes_hoje,
                     COUNT(*) FILTER (WHERE status = 'Pendente')::int pendentes
                FROM rh_ausencias`, [ano, hoje])
  ]);
  const t = k[0].total || 1;
  const presentes = Math.max(0, k[0].ativos - aus[0].ausentes_hoje);
  const mx = Math.max(1, ...setores.map((s) => s.n));
  res.json({
    kpis: [
      { label: 'Total de Servidores', value: String(k[0].total), detail: 'Cadastrados (exceto desligados)', trend: k[0].novos ? `↑ ${k[0].novos} novo(s) este ano` : '→ Sem novos cadastros este ano', up: k[0].novos > 0 },
      { label: 'Servidores Ativos', value: String(k[0].ativos), detail: 'Em operação', trend: k[0].afastados ? `↓ ${k[0].afastados} afastado(s)` : '→ Nenhum afastamento', up: !k[0].afastados },
      { label: 'Taxa de Férias', value: Math.round((aus[0].ferias_ano / t) * 100) + '%', detail: 'Servidores com férias aprovadas em ' + ano, trend: aus[0].pendentes ? `→ ${aus[0].pendentes} solicitação(ões) pendente(s)` : '→ Sem pendências', up: !aus[0].pendentes },
      { label: 'Taxa de Presença', value: Math.round((presentes / t) * 100) + '%', detail: 'Hoje', trend: aus[0].ausentes_hoje ? `↓ ${aus[0].ausentes_hoje} em férias/licença hoje` : '→ Estável', up: !aus[0].ausentes_hoje }
    ],
    sectorHeadcount: setores.map((s) => ({ label: s.label, value: s.n + ' servidor(es)', bar: Math.round((s.n / mx) * 100) + '%' }))
  });
}));

/** Eventos do calendário integrado e alertas (usados por calendar/dashboard). */
async function feed() {
  const items = await listAusencias("WHERE a.status <> 'Recusado'");
  const n = await config.get('rh.alertaParada');
  const alerts = [];
  const { rows } = await db.query("SELECT a.id, a.tipo, a.solicitado_em, u.name FROM rh_ausencias a JOIN users u ON u.id = a.user_id WHERE a.status = 'Pendente'");
  rows.forEach((r) => {
    const d = bizDays(new Date(r.solicitado_em).toISOString().slice(0, 10));
    if (d > n) alerts.push({ id: 'rh-parada-' + r.id, category: 'PESSOAL', level: 'warning', title: 'Solicitação parada há ' + d + ' dias úteis — ' + r.name, description: r.tipo + ' aguardando aprovação', href: '/pessoal?tab=vacation', module: 'rh' });
  });
  return {
    events: items.map((v) => ({ title: v.type + ' — ' + v.employee + (v.status === 'Pendente' ? ' (pendente)' : ''), start: v.start, end: v.end, level: v.status === 'Pendente' ? 'warning' : 'info', deadline: v.status === 'Pendente', href: '/pessoal?tab=vacation' })),
    alerts
  };
}

module.exports = router;
module.exports.feed = feed;
module.exports.TIPOS = TIPOS;
