/**
 * Moções & Homenagens (módulo mocoes): moções, galeria de homenageados, arranjos/placas e bandeiras.
 */
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const M = require('../services/mocoes');
const { ah, parse, idParam, notFound, badRequest, conflict } = require('../lib/http');
const { today } = require('../lib/dates');

const router = express.Router();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const optDate = z.string().regex(ISO, 'Data inválida.').optional().or(z.literal('')).or(z.null()).transform((v) => v || null);

async function vereador(id) {
  const { rows } = await db.query('SELECT id, nome FROM vereadores WHERE id = $1 AND ativo', [id]);
  if (!rows.length) throw badRequest('Selecione o vereador autor.');
  return rows[0];
}
const vereadorId = z.coerce.number({ message: 'Selecione o vereador autor.' }).int().positive('Selecione o vereador autor.');

router.get('/meta', ah(async (req, res) => {
  res.json({ tipos: M.TIPOS, status: M.STATUS, entregaStatus: M.ENTREGA_STATUS, itens: M.ITENS.map(([key, label, short]) => ({ key, label, short })),
    legislaturaAtual: M.legislatura(), legislaturas: M.legislaturas(), cota: await config.get('mocoes.cotaVereador'), portaria: await config.get('mocoes.portaria') });
}));

// ---------- Moções ----------
const mocaoOf = (m) => ({ id: m.id, numero: String(m.numero).padStart(3, '0') + '/' + m.ano, tipo: m.tipo, assunto: m.assunto, vereadorId: m.vereador_id, autor: m.autor, data: m.data, sessao: m.sessao || '', status: m.status });

router.get('/mocoes', ah(async (req, res) => {
  const { rows } = await db.query('SELECT m.*, v.nome AS autor FROM mocoes m JOIN vereadores v ON v.id = m.vereador_id ORDER BY m.ano DESC, m.numero DESC');
  const q = String(req.query.q || '').trim().toLowerCase();
  res.json(rows.map(mocaoOf).filter((m) => !q || (m.numero + ' ' + m.assunto + ' ' + m.autor).toLowerCase().includes(q)));
}));

const mocaoSchema = z.object({
  tipo: z.enum(M.TIPOS),
  vereadorId,
  assunto: z.string().trim().min(1, 'Preencha assunto e data.').max(300),
  data: z.string({ message: 'Preencha assunto e data.' }).regex(ISO, 'Preencha assunto e data.'),
  sessao: optDate,
  status: z.enum(M.STATUS).default('Em Análise')
});
/** Assunto padronizado: "Moção de <Tipo> - <texto>". */
const assuntoOf = (b) => (/^Moção de /i.test(b.assunto) ? b.assunto : 'Moção de ' + b.tipo + ' - ' + b.assunto);

router.post('/mocoes', ah(async (req, res) => {
  const b = parse(mocaoSchema, req.body);
  await vereador(b.vereadorId);
  const ano = +b.data.slice(0, 4);
  const m = await db.tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext('mocoes'))");
    const { rows } = await c.query('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM mocoes WHERE ano = $1', [ano]);
    return (await c.query('INSERT INTO mocoes (numero, ano, tipo, assunto, vereador_id, data, sessao, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [rows[0].n, ano, b.tipo, assuntoOf(b), b.vereadorId, b.data, b.sessao, b.status, req.user.id])).rows[0];
  });
  const out = mocaoOf(m);
  await audit.log(req, { action: 'Moção registrada', module: 'mocoes', detail: out.numero + ' · ' + out.assunto });
  res.status(201).json(out);
}));

router.put('/mocoes/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(mocaoSchema, req.body);
  await vereador(b.vereadorId);
  const { rows } = await db.query('UPDATE mocoes SET tipo=$2, assunto=$3, vereador_id=$4, data=$5, sessao=$6, status=$7, updated_at=NOW() WHERE id=$1 RETURNING *', [id, b.tipo, assuntoOf(b), b.vereadorId, b.data, b.sessao, b.status]);
  if (!rows.length) throw notFound('Moção não encontrada.');
  const out = mocaoOf(rows[0]);
  await audit.log(req, { action: 'Moção editada', module: 'mocoes', detail: out.numero + ' · ' + out.status });
  res.json(out);
}));

// ---------- Galeria de homenageados (cota por vereador/legislatura) ----------
async function cotaUsada(vereadorIdV, leg, exceptId) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM homenageados WHERE vereador_id = $1 AND legislatura = $2 AND ($3::int IS NULL OR id <> $3)', [vereadorIdV, leg, exceptId || null]);
  return rows[0].n;
}

router.get('/galeria', ah(async (req, res) => {
  const leg = M.legislatura(), cota = await config.get('mocoes.cotaVereador');
  const [{ rows }, { rows: vs }] = await Promise.all([
    db.query('SELECT h.*, v.nome AS vereador FROM homenageados h JOIN vereadores v ON v.id = h.vereador_id ORDER BY h.quadro'),
    db.query('SELECT v.id, v.nome, COUNT(h.id)::int AS usadas FROM vereadores v LEFT JOIN homenageados h ON h.vereador_id = v.id AND h.legislatura = $1 WHERE v.ativo GROUP BY v.id', [leg])
  ]);
  vs.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  res.json({ legislatura: leg, cota,
    items: rows.map((h) => ({ id: h.id, homenageado: h.homenageado, vereadorId: h.vereador_id, vereador: h.vereador, legislatura: h.legislatura, quadro: h.quadro })),
    vereadores: vs.map((v) => ({ id: v.id, nome: v.nome, usadas: v.usadas, cotaAtingida: v.usadas >= cota })) });
}));

const cotaMsg = (cota) => `Este vereador já atingiu a cota de ${cota} quadro(s) na legislatura (Portaria DA 03/2023).`;

router.post('/galeria', ah(async (req, res) => {
  const b = parse(z.object({ vereadorId, homenageado: z.string().trim().min(1, 'Informe o nome do homenageado.').max(200) }), req.body);
  const v = await vereador(b.vereadorId);
  const leg = M.legislatura(), cota = await config.get('mocoes.cotaVereador');
  const h = await db.tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext('homenageados'))");
    if ((await cotaUsada(b.vereadorId, leg)) >= cota) throw conflict(cotaMsg(cota));
    const { rows } = await c.query("SELECT COALESCE(MAX(NULLIF(regexp_replace(quadro, '\\D', '', 'g'), '')::int), 0) + 1 AS n FROM homenageados");
    const quadro = 'Q-' + String(rows[0].n).padStart(3, '0');
    return (await c.query('INSERT INTO homenageados (homenageado, vereador_id, legislatura, quadro, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *', [b.homenageado, b.vereadorId, leg, quadro, req.user.id])).rows[0];
  });
  await audit.log(req, { action: 'Homenageado registrado', module: 'mocoes', detail: h.quadro + ' · ' + h.homenageado + ' · Ver. ' + v.nome });
  res.status(201).json({ id: h.id, quadro: h.quadro });
}));

router.put('/galeria/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(z.object({
    vereadorId,
    homenageado: z.string().trim().min(1, 'Preencha homenageado e nº do quadro.').max(200),
    legislatura: z.string().regex(/^\d{4}-\d{4}$/, 'Legislatura inválida.'),
    quadro: z.string().trim().min(1, 'Preencha homenageado e nº do quadro.').max(20).transform((s) => s.toUpperCase())
  }), req.body);
  await vereador(b.vereadorId);
  const cota = await config.get('mocoes.cotaVereador');
  if ((await cotaUsada(b.vereadorId, b.legislatura, id)) >= cota) throw conflict(cotaMsg(cota));
  const dup = await db.query('SELECT 1 FROM homenageados WHERE upper(quadro) = $1 AND id <> $2', [b.quadro, id]);
  if (dup.rows.length) throw conflict('Nº do quadro já utilizado.');
  const { rowCount } = await db.query('UPDATE homenageados SET homenageado=$2, vereador_id=$3, legislatura=$4, quadro=$5 WHERE id=$1', [id, b.homenageado, b.vereadorId, b.legislatura, b.quadro]);
  if (!rowCount) throw notFound('Homenageado não encontrado.');
  await audit.log(req, { action: 'Homenageado editado', module: 'mocoes', detail: b.quadro + ' · ' + b.homenageado });
  res.json({ ok: true });
}));

// ---------- Arranjos e placas ----------
router.get('/entregas', ah(async (req, res) => res.json(await M.entregas())));

const entregaSchema = z.object({
  homenageado: z.string().trim().min(1, 'Informe o homenageado.').max(200),
  honraria: z.string().trim().max(160).optional().default(''),
  vereadorId,
  material: z.string().trim().max(80).optional().default('Placa'),
  processo: z.string().trim().max(40).optional().default(''),
  decreto: z.string().trim().max(40).optional().default(''),
  data: optDate,
  horario: z.string().trim().max(20).optional().default(''),
  status: z.enum(M.ENTREGA_STATUS),
  obs: z.string().trim().max(400).optional().default('')
});
const entregaVals = (b) => [b.homenageado, b.honraria, b.vereadorId, b.material || 'Placa', b.processo, b.decreto, b.data, b.data ? b.horario : '', b.status, b.obs];

router.post('/entregas', ah(async (req, res) => {
  const b = parse(entregaSchema, req.body);
  await vereador(b.vereadorId);
  const { rows } = await db.query('INSERT INTO homenagens_entregas (homenageado, honraria, vereador_id, material, processo, decreto, data, horario, status, obs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id', entregaVals(b));
  await audit.log(req, { action: 'Entrega de homenagem cadastrada', module: 'mocoes', detail: b.homenageado + ' · ' + b.material });
  res.status(201).json({ id: rows[0].id });
}));

router.put('/entregas/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(entregaSchema, req.body);
  await vereador(b.vereadorId);
  const { rowCount } = await db.query('UPDATE homenagens_entregas SET homenageado=$2, honraria=$3, vereador_id=$4, material=$5, processo=$6, decreto=$7, data=$8, horario=$9, status=$10, obs=$11, updated_at=NOW() WHERE id=$1', [id, ...entregaVals(b)]);
  if (!rowCount) throw notFound('Entrega não encontrada.');
  await audit.log(req, { action: 'Entrega de homenagem editada', module: 'mocoes', detail: b.homenageado + ' · ' + b.status });
  res.json({ ok: true });
}));

// ---------- Bandeiras (contém CPF/telefone: leitura registrada na auditoria) ----------
router.get('/bandeiras', ah(async (req, res) => {
  const list = await M.bandeiras();
  await audit.logPersonalRead(req, 'Empréstimos de bandeiras (CPF/CNPJ e telefone)');
  res.json(list);
}));

const itemKeys = M.ITENS.map(([k]) => k);
const bandSchema = z.object({
  entidade: z.string().trim().min(1, 'Informe a empresa ou entidade.').max(200),
  documento: z.string().optional().default('').transform((s) => s.replace(/\D/g, '')).refine((d) => !d || d.length === 11 || d.length === 14, 'CPF deve ter 11 dígitos e CNPJ 14.'),
  telefone: z.string().trim().max(20).optional().default(''),
  solicitacao: z.string({ message: 'Informe a data da solicitação.' }).regex(ISO, 'Informe a data da solicitação.'),
  protocolo: z.string().trim().max(40).optional().default(''),
  itens: z.array(z.enum(itemKeys)).min(1, 'Selecione ao menos um item emprestado.'),
  retirado: z.boolean(),
  retirada: optDate,
  devolucao: optDate,
  conformidade: z.enum(['', 'Sim', 'Não']).optional().default(''),
  obs: z.string().trim().max(400).optional().default('')
});
function checkBand(b) {
  if (b.retirado && !b.retirada) throw badRequest('Informe a data da retirada.');
  if (b.retirado && b.retirada > today()) throw badRequest('Retirada marcada como feita não pode ter data futura. Use "Não" para agendar.');
  if (b.retirada && b.devolucao && b.devolucao < b.retirada) throw badRequest('A devolução não pode ser antes da retirada.');
  if (!b.retirado) b.conformidade = '';
  if (b.conformidade !== 'Não') b.obs = b.conformidade ? '' : b.obs;
  return b;
}
const bandVals = (b) => [b.solicitacao, b.entidade, b.documento, b.telefone, b.protocolo, [...new Set(b.itens)], b.retirado, b.retirada, b.devolucao, b.conformidade, b.obs];
const bandDetail = (b) => b.entidade + ' · ' + (b.protocolo || 's/ protocolo');

router.post('/bandeiras', ah(async (req, res) => {
  const b = checkBand(parse(bandSchema, req.body));
  const { rows } = await db.query('INSERT INTO bandeiras_emprestimos (solicitacao, entidade, documento, telefone, protocolo, itens, retirado, retirada, devolucao, conformidade, obs, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id', [...bandVals(b), req.user.id]);
  await audit.log(req, { action: 'Empréstimo de bandeiras registrado', module: 'mocoes', detail: bandDetail(b) });
  res.status(201).json({ id: rows[0].id });
}));

router.put('/bandeiras/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = checkBand(parse(bandSchema, req.body));
  const { rowCount } = await db.query('UPDATE bandeiras_emprestimos SET solicitacao=$2, entidade=$3, documento=$4, telefone=$5, protocolo=$6, itens=$7, retirado=$8, retirada=$9, devolucao=$10, conformidade=$11, obs=$12, updated_at=NOW() WHERE id=$1', [id, ...bandVals(b)]);
  if (!rowCount) throw notFound('Registro não encontrado.');
  await audit.log(req, { action: 'Empréstimo de bandeiras editado', module: 'mocoes', detail: bandDetail(b) });
  res.json({ ok: true });
}));

/** Atalho "Registrar retirada": marca como retirado hoje (ou na data agendada, se já passou). */
router.post('/bandeiras/:id/retirada', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await db.query(
    `UPDATE bandeiras_emprestimos SET retirado = TRUE, retirada = CASE WHEN retirada IS NOT NULL AND retirada <= $2::date THEN retirada ELSE $2::date END, updated_at = NOW()
     WHERE id = $1 AND NOT retirado RETURNING entidade, protocolo`, [id, today()]);
  if (!rows.length) throw conflict('Retirada já registrada ou registro inexistente.');
  await audit.log(req, { action: 'Retirada registrada', module: 'mocoes', detail: bandDetail(rows[0]) });
  res.json({ ok: true });
}));

router.delete('/bandeiras/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await db.query('DELETE FROM bandeiras_emprestimos WHERE id = $1 RETURNING entidade, protocolo', [id]);
  if (!rows.length) throw notFound('Registro não encontrado.');
  await audit.log(req, { action: 'Empréstimo de bandeiras excluído', module: 'mocoes', detail: bandDetail(rows[0]) });
  res.json({ ok: true });
}));

module.exports = router;
