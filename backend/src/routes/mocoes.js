/**
 * Moções & Homenagens (módulo mocoes): moções, galeria de homenageados, arranjos/placas e bandeiras.
 */
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const M = require('../services/mocoes');
const A = require('../services/assinaturas');
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

const SO_ASSINADO = 'A retirada e a devolução são registradas com a assinatura de quem retira/devolve (botões "Registrar retirada" e "Registrar devolução").';
router.post('/bandeiras', ah(async (req, res) => {
  const b = checkBand(parse(bandSchema, req.body));
  if (b.retirado || b.conformidade) throw badRequest(SO_ASSINADO);
  const { rows } = await db.query('INSERT INTO bandeiras_emprestimos (solicitacao, entidade, documento, telefone, protocolo, itens, retirado, retirada, devolucao, conformidade, obs, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id', [...bandVals(b), req.user.id]);
  await audit.log(req, { action: 'Empréstimo de bandeiras registrado', module: 'mocoes', detail: bandDetail(b) });
  res.status(201).json({ id: rows[0].id });
}));

router.put('/bandeiras/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = checkBand(parse(bandSchema, req.body));
  // Retirada e devolução só mudam pelas rotas com assinatura; a edição mantém o que foi assinado
  const { rows: cur } = await db.query('SELECT * FROM bandeiras_emprestimos WHERE id = $1', [id]);
  if (!cur.length) throw notFound('Registro não encontrado.');
  const c = cur[0];
  if (b.retirado !== c.retirado || (!c.conformidade && b.conformidade)) throw badRequest(SO_ASSINADO);
  if (c.retirado) b.retirada = M.iso(c.retirada);
  if (c.conformidade) { b.conformidade = c.conformidade; b.obs = c.obs; b.devolucao = M.iso(c.devolucao); }
  if (c.retirado && b.devolucao && b.devolucao < b.retirada) throw badRequest('A devolução não pode ser antes da retirada.');
  const { rowCount } = await db.query('UPDATE bandeiras_emprestimos SET solicitacao=$2, entidade=$3, documento=$4, telefone=$5, protocolo=$6, itens=$7, retirado=$8, retirada=$9, devolucao=$10, conformidade=$11, obs=$12, updated_at=NOW() WHERE id=$1', [id, ...bandVals(b)]);
  if (!rowCount) throw notFound('Registro não encontrado.');
  await audit.log(req, { action: 'Empréstimo de bandeiras editado', module: 'mocoes', detail: bandDetail(b) });
  res.json({ ok: true });
}));

// ---------- Saída de bandeiras com assinatura eletrônica (mesmos tablets do Controle de Chaves) ----------
const TIPOS_ASS = ['bandeira_retirada', 'bandeira_devolucao'];
const nomeAss = (msg) => z.string().trim().min(3, msg).max(160);
const pedidoBand = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('bandeira_retirada'), emprestimoId: z.number().int().positive(), retiradoPor: nomeAss('Informe o nome de quem retira.'), retiradoDoc: z.string().trim().max(40).optional().default(''), imagem: z.string().optional(), tabletId: z.number().int().positive().optional() }),
  z.object({ tipo: z.literal('bandeira_devolucao'), emprestimoId: z.number().int().positive(), devolvidoPor: nomeAss('Informe o nome de quem devolve.'), conformidade: z.enum(['Sim', 'Não'], { message: 'Informe se os itens voltaram em conformidade.' }), obs: z.string().trim().max(400).optional().default(''), imagem: z.string().optional(), tabletId: z.number().int().positive().optional() })
], { message: 'Tipo de assinatura inválido.' });

const nomesItens = (keys) => M.ITENS.filter(([k]) => keys.includes(k)).map(([, label]) => label);

/** Conteúdo assinado — montado no servidor a partir do registro. */
async function resumoBand(b, user) {
  const { rows } = await db.query('SELECT * FROM bandeiras_emprestimos WHERE id = $1', [b.emprestimoId]);
  const r = rows[0];
  if (!r) throw notFound('Registro não encontrado.');
  const base = { tipo: b.tipo, emprestimoId: r.id, entidade: r.entidade, protocolo: r.protocolo, itens: nomesItens(r.itens), data: new Date().toISOString(), responsavel: user.name };
  if (b.tipo === 'bandeira_retirada') {
    if (r.retirado) throw conflict('A retirada já foi registrada.');
    return { ...base, retiradoPor: b.retiradoPor, retiradoDoc: b.retiradoDoc, devolucaoPrevista: M.iso(r.devolucao) || '' };
  }
  if (!r.retirado) throw conflict('Os itens ainda não foram retirados.');
  if (r.conformidade) throw conflict('A devolução já foi registrada.');
  if (b.conformidade === 'Não' && !b.obs) throw badRequest('Descreva o que não está em conformidade.');
  return { ...base, devolvidoPor: b.devolvidoPor, conformidade: b.conformidade, obs: b.conformidade === 'Não' ? b.obs : '' };
}

router.get('/bandeiras/tablets', ah(async (req, res) => res.json(await A.tabletsPareados())));

router.post('/bandeiras/assinaturas', ah(async (req, res) => {
  const b = parse(pedidoBand, req.body);
  res.status(201).json(await A.criar(req, b.tipo, await resumoBand(b, req.user), { imagem: b.imagem, tabletId: b.tabletId }));
}));
router.get('/bandeiras/assinaturas/:id', ah(async (req, res) => res.json(A.situacao(await A.minha(req, req.params.id, TIPOS_ASS)))));
router.delete('/bandeiras/assinaturas/:id', ah(async (req, res) => {
  await A.cancelar(await A.minha(req, req.params.id, TIPOS_ASS));
  res.json({ ok: true });
}));

/** Registra a retirada com a assinatura de quem retira (a data é a da assinatura). */
router.post('/bandeiras/:id/retirada', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(z.object({ retiradoPor: nomeAss('Informe o nome de quem retira.'), retiradoDoc: z.string().trim().max(40).optional().default(''), assinaturaId: z.string({ message: 'Colete a assinatura de quem retira.' }) }), req.body);
  const r = await db.tx(async (c) => {
    const { rows } = await c.query('SELECT * FROM bandeiras_emprestimos WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length) throw notFound('Registro não encontrado.');
    if (rows[0].retirado) throw conflict('Retirada já registrada.');
    const a = await A.consumir(c, b.assinaturaId, req.user.id, 'bandeira_retirada', (x) => x.emprestimoId === id && x.retiradoPor === b.retiradoPor && (x.retiradoDoc || '') === b.retiradoDoc);
    await c.query(
      `UPDATE bandeiras_emprestimos SET retirado = TRUE, retirada = $2::date, retirada_em = $3, retirado_por = $4, retirado_doc = $5, entregue_por = $6, assinatura_retirada = $7, updated_at = NOW() WHERE id = $1`,
      [id, today(), a.assinada_em, b.retiradoPor, b.retiradoDoc, req.user.id, a.id]);
    return rows[0];
  });
  await audit.log(req, { action: 'Retirada de bandeiras registrada', module: 'mocoes', detail: bandDetail(r) + ' · ' + b.retiradoPor + ' (assinatura eletrônica)' });
  res.json({ ok: true });
}));

/** Registra a devolução e a conferência com a assinatura de quem devolve. */
router.post('/bandeiras/:id/devolucao', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(z.object({ devolvidoPor: nomeAss('Informe o nome de quem devolve.'), conformidade: z.enum(['Sim', 'Não']), obs: z.string().trim().max(400).optional().default(''), assinaturaId: z.string({ message: 'Colete a assinatura de quem devolve.' }) }), req.body);
  const obs = b.conformidade === 'Não' ? b.obs : '';
  const r = await db.tx(async (c) => {
    const { rows } = await c.query('SELECT * FROM bandeiras_emprestimos WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length) throw notFound('Registro não encontrado.');
    if (!rows[0].retirado) throw conflict('Os itens ainda não foram retirados.');
    if (rows[0].conformidade) throw conflict('Devolução já registrada.');
    const a = await A.consumir(c, b.assinaturaId, req.user.id, 'bandeira_devolucao', (x) => x.emprestimoId === id && x.devolvidoPor === b.devolvidoPor && x.conformidade === b.conformidade && (x.obs || '') === obs);
    await c.query(
      `UPDATE bandeiras_emprestimos SET conformidade = $2, obs = $3, devolucao = $4::date, devolucao_em = $5, devolvido_por = $6, recebido_por = $7, assinatura_devolucao = $8, updated_at = NOW() WHERE id = $1`,
      [id, b.conformidade, obs, today(), a.assinada_em, b.devolvidoPor, req.user.id, a.id]);
    return rows[0];
  });
  await audit.log(req, { action: 'Devolução de bandeiras registrada', module: 'mocoes', detail: bandDetail(r) + ' · ' + b.devolvidoPor + (b.conformidade === 'Não' ? ' · com pendência' : '') + ' (assinatura eletrônica)', level: b.conformidade === 'Não' ? 'warning' : 'info' });
  res.json({ ok: true });
}));

/** Termo de retirada e devolução com as assinaturas — leitura de dado pessoal (auditada). */
router.get('/bandeiras/:id/termo', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await db.query(
    `SELECT b.*, ue.name AS entregue_nome, ur.name AS recebido_nome FROM bandeiras_emprestimos b
     LEFT JOIN users ue ON ue.id = b.entregue_por LEFT JOIN users ur ON ur.id = b.recebido_por WHERE b.id = $1`, [id]);
  if (!rows.length) throw notFound('Registro não encontrado.');
  const r = rows[0];
  const ids = [r.assinatura_retirada, r.assinatura_devolucao].filter(Boolean);
  const ass = ids.length ? (await db.query('SELECT * FROM chaves_assinaturas WHERE id = ANY($1)', [ids])).rows : [];
  const K = require('../services/chaves');
  const by = (aid) => (aid ? K.assinaturaOf(ass.find((a) => a.id === aid), true) : null);
  await audit.logPersonalRead(req, `Termo de bandeiras · ${r.entidade} (assinaturas)`);
  res.json({
    id: r.id, entidade: r.entidade, documento: r.documento, telefone: r.telefone, protocolo: r.protocolo, itens: nomesItens(r.itens),
    retirado: r.retirado, retirada: M.iso(r.retirada), retiradaEm: r.retirada_em, retiradoPor: r.retirado_por || '', retiradoDoc: r.retirado_doc || '', entreguePor: r.entregue_nome || '',
    devolucao: M.iso(r.devolucao), devolucaoEm: r.devolucao_em, devolvidoPor: r.devolvido_por || '', recebidoPor: r.recebido_nome || '', conformidade: r.conformidade, obs: r.obs,
    assinaturaRetirada: by(r.assinatura_retirada), assinaturaDevolucao: by(r.assinatura_devolucao)
  });
}));

router.delete('/bandeiras/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await db.query('DELETE FROM bandeiras_emprestimos WHERE id = $1 RETURNING entidade, protocolo', [id]);
  if (!rows.length) throw notFound('Registro não encontrado.');
  await audit.log(req, { action: 'Empréstimo de bandeiras excluído', module: 'mocoes', detail: bandDetail(rows[0]) });
  res.json({ ok: true });
}));

module.exports = router;
