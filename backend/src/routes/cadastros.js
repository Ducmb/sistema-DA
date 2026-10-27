/**
 * Cadastros base compartilhados: centros de custo, vereadores e exercício fiscal.
 * Leitura para qualquer usuário autenticado (alimentam formulários); escrita restrita.
 */
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const { requireAdmin, requireModule } = require('../middleware/auth');
const { ah, parse, idParam, notFound, conflict } = require('../lib/http');
const { year, today } = require('../lib/dates');

const router = express.Router();

// ---------- Centros de custo ----------
async function nextCode(tipo, c = db) {
  const pre = tipo === 'patrimonio' ? 'PAT-' : 'CC-';
  const { rows } = await c.query("SELECT codigo FROM cost_centers WHERE codigo LIKE $1", [pre + '%']);
  const n = rows.reduce((m, r) => { const k = parseInt(r.codigo.replace(/\D/g, ''), 10); return isFinite(k) && k > m ? k : m; }, 0) + 1;
  return pre + String(n).padStart(3, '0');
}

router.get('/cost-centers', ah(async (req, res) => {
  const where = [], p = [];
  if (req.query.tipo === 'padrao' || req.query.tipo === 'patrimonio') { p.push(req.query.tipo); where.push('tipo = $' + p.length); }
  if (req.query.situacao === 'ativos' || !req.query.situacao) where.push('ativo');
  else if (req.query.situacao === 'arquivados') where.push('NOT ativo');
  const { rows } = await db.query(`SELECT id, codigo, nome, tipo, ativo FROM cost_centers ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY nome`, p);
  res.json({ items: rows, nextCode: { padrao: await nextCode('padrao'), patrimonio: await nextCode('patrimonio') } });
}));

const ccSchema = z.object({
  codigo: z.string().trim().toUpperCase().max(20).optional().or(z.literal('')),
  nome: z.string().trim().min(1, 'Informe o nome do centro de custo.').max(160),
  tipo: z.enum(['padrao', 'patrimonio']).default('padrao')
});

async function ccDup(b, id) {
  const { rows } = await db.query('SELECT codigo, nome, tipo FROM cost_centers WHERE ($1::int IS NULL OR id <> $1) AND (codigo = $2 OR (lower(nome) = lower($3) AND tipo = $4))', [id || null, b.codigo, b.nome, b.tipo]);
  if (!rows.length) return;
  if (rows.some((r) => r.codigo === b.codigo)) throw conflict('Código já utilizado.');
  throw conflict('Já existe um centro de custo com esse nome nesse tipo.');
}

router.post('/cost-centers', requireAdmin, ah(async (req, res) => {
  const b = parse(ccSchema, req.body);
  b.codigo = b.codigo || (await nextCode(b.tipo));
  await ccDup(b);
  const { rows } = await db.query('INSERT INTO cost_centers (codigo, nome, tipo) VALUES ($1,$2,$3) RETURNING *', [b.codigo, b.nome, b.tipo]);
  await audit.log(req, { action: 'Centro de custo criado', module: 'configuracoes', detail: b.codigo + ' ' + b.nome });
  res.status(201).json(rows[0]);
}));

router.put('/cost-centers/:id', requireAdmin, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(ccSchema.extend({ codigo: z.string().trim().toUpperCase().min(1, 'Informe código e nome.').max(20) }), req.body);
  await ccDup(b, id);
  const { rows: old } = await db.query('SELECT nome FROM cost_centers WHERE id = $1', [id]);
  if (!old.length) throw notFound();
  const { rows } = await db.tx(async (c) => {
    const r = await c.query('UPDATE cost_centers SET codigo=$1, nome=$2, tipo=$3, updated_at=NOW() WHERE id=$4 RETURNING *', [b.codigo, b.nome, b.tipo, id]);
    // Lotação dos servidores acompanha a renomeação do centro de custo
    if (old[0].nome !== b.nome) await c.query('UPDATE users SET department = $1 WHERE department = $2', [b.nome, old[0].nome]);
    return r;
  });
  await audit.log(req, { action: 'Centro de custo editado', module: 'configuracoes', detail: b.codigo + ' ' + b.nome });
  res.json(rows[0]);
}));

router.patch('/cost-centers/:id/active', requireAdmin, ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { ativo } = parse(z.object({ ativo: z.boolean() }), req.body);
  const { rows } = await db.query('UPDATE cost_centers SET ativo = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [ativo, id]);
  if (!rows.length) throw notFound();
  await audit.log(req, { action: ativo ? 'Centro de custo desarquivado' : 'Centro de custo arquivado', module: 'configuracoes', detail: rows[0].codigo + ' · ' + rows[0].nome, level: ativo ? 'info' : 'warning' });
  res.json(rows[0]);
}));

// ---------- Vereadores ----------
router.get('/vereadores', ah(async (req, res) => {
  const { rows } = await db.query('SELECT id, nome, ativo FROM vereadores WHERE ativo');
  rows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  res.json(rows);
}));

router.post('/vereadores', requireModule('mocoes', 'configuracoes'), ah(async (req, res) => {
  const { nome } = parse(z.object({ nome: z.string().trim().min(2, 'Informe o nome do vereador.').max(160) }), req.body);
  const { rows } = await db.query('INSERT INTO vereadores (nome) VALUES ($1) ON CONFLICT (lower(nome)) DO UPDATE SET ativo = TRUE RETURNING *', [nome]);
  await audit.log(req, { action: 'Vereador cadastrado', module: 'mocoes', detail: nome });
  res.status(201).json(rows[0]);
}));

// ---------- Exercício fiscal ----------
router.get('/exercicio', ah(async (req, res) => {
  const y = year(today());
  const anos = [y, y - 1, y - 2];
  const pref = +(req.user.preferences && req.user.preferences.exercicio) || +(await config.get('geral.exercicio'));
  res.json({ anos, atual: anos.includes(pref) ? pref : anos[0] });
}));

module.exports = router;
module.exports.nextCode = nextCode;
