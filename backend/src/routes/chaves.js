/**
 * Controle de Chaves (módulo chaves): cadastro de chaves, retirada e devolução com assinatura eletrônica
 * do solicitante. A assinatura é feita na tela do computador (mesa digitalizadora ou tablet de assinatura
 * ligado ao computador) ou numa estação tablet logada com o mesmo usuário, que recebe o pedido.
 */
const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const K = require('../services/chaves');
const { ah, parse, idParam, notFound, badRequest, conflict, forbidden } = require('../lib/http');

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const uuidParam = (v) => { if (!UUID.test(String(v))) throw badRequest('Identificador inválido.'); return String(v); };
const USO_APOS_ASSINAR_MIN = 30;

// ---------- Cadastro de chaves ----------
router.get('/', ah(async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.*, e.id AS emp_id, e.solicitante, e.retirada_em FROM chaves c
     LEFT JOIN chaves_emprestimos e ON e.chave_id = c.id AND e.devolucao_em IS NULL ORDER BY c.local, c.codigo`);
  res.json(rows.map((c) => ({ id: c.id, codigo: c.codigo, local: c.local, descricao: c.descricao, ativa: c.ativa, emprestimo: c.emp_id ? { id: c.emp_id, solicitante: c.solicitante, retiradaEm: c.retirada_em } : null })));
}));

const chaveSchema = z.object({
  codigo: z.string().trim().min(1, 'Informe o código e o local.').max(20).transform((s) => s.toUpperCase()),
  local: z.string().trim().min(1, 'Informe o código e o local.').max(160),
  descricao: z.string().trim().max(300).optional().default('')
});
router.post('/', ah(async (req, res) => {
  const b = parse(chaveSchema, req.body);
  if ((await db.query('SELECT 1 FROM chaves WHERE codigo = $1', [b.codigo])).rows.length) throw conflict('Já existe chave com este código.');
  const { rows } = await db.query('INSERT INTO chaves (codigo, local, descricao) VALUES ($1,$2,$3) RETURNING id', [b.codigo, b.local, b.descricao]);
  await audit.log(req, { action: 'Chave cadastrada', module: 'chaves', detail: b.codigo + ' · ' + b.local });
  res.status(201).json({ id: rows[0].id });
}));
router.put('/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(chaveSchema, req.body);
  if ((await db.query('SELECT 1 FROM chaves WHERE codigo = $1 AND id <> $2', [b.codigo, id])).rows.length) throw conflict('Já existe chave com este código.');
  const { rowCount } = await db.query('UPDATE chaves SET codigo=$2, local=$3, descricao=$4 WHERE id=$1', [id, b.codigo, b.local, b.descricao]);
  if (!rowCount) throw notFound('Chave não encontrada.');
  await audit.log(req, { action: 'Chave editada', module: 'chaves', detail: b.codigo + ' · ' + b.local });
  res.json({ ok: true });
}));
router.patch('/:id/ativa', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { ativa } = parse(z.object({ ativa: z.boolean() }), req.body);
  if (!ativa && (await db.query('SELECT 1 FROM chaves_emprestimos WHERE chave_id = $1 AND devolucao_em IS NULL', [id])).rows.length) throw conflict('A chave está emprestada. Registre a devolução antes de desativá-la.');
  const { rows } = await db.query('UPDATE chaves SET ativa = $2 WHERE id = $1 RETURNING codigo, local', [id, ativa]);
  if (!rows.length) throw notFound('Chave não encontrada.');
  await audit.log(req, { action: ativa ? 'Chave reativada' : 'Chave desativada', module: 'chaves', detail: rows[0].codigo + ' · ' + rows[0].local });
  res.json({ ok: true });
}));

// ---------- Assinaturas ----------
/** Onde o traço foi feito quando a imagem vem do computador: quadro da tela ou janela aberta na tela do tablet conectado. */
const DISP = z.enum(['tela', 'tablet'], { message: 'Dispositivo inválido.' }).optional().default('tela');
const pedidoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('retirada'), chaveId: z.number().int().positive(), solicitante: z.string().trim().min(3, 'Informe o nome do solicitante.').max(160), solicitanteDoc: z.string().trim().max(40).optional().default(''), imagem: z.string().optional(), dispositivo: DISP }),
  z.object({ tipo: z.literal('devolucao'), emprestimoId: z.number().int().positive(), devolvidoPor: z.string().trim().min(3, 'Informe quem está devolvendo a chave.').max(160), imagem: z.string().optional(), dispositivo: DISP })
], { message: 'Tipo de assinatura inválido.' });

/** Resumo do que será assinado — montado no servidor a partir do banco (o navegador não define o conteúdo). */
async function resumoDe(b, user) {
  const agora = new Date().toISOString();
  if (b.tipo === 'retirada') {
    const { rows } = await db.query('SELECT c.*, EXISTS (SELECT 1 FROM chaves_emprestimos e WHERE e.chave_id = c.id AND e.devolucao_em IS NULL) AS emprestada FROM chaves c WHERE c.id = $1', [b.chaveId]);
    const c = rows[0];
    if (!c || !c.ativa) throw badRequest('Chave não encontrada ou desativada.');
    if (c.emprestada) throw conflict('Esta chave já está emprestada.');
    return { tipo: 'retirada', chaveId: c.id, chave: c.codigo, local: c.local, solicitante: b.solicitante, solicitanteDoc: b.solicitanteDoc, data: agora, responsavel: user.name };
  }
  const { rows } = await db.query(`${K.SELECT_EMP} WHERE e.id = $1`, [b.emprestimoId]);
  const e = rows[0];
  if (!e) throw notFound('Empréstimo não encontrado.');
  if (e.devolucao_em) throw conflict('Esta chave já foi devolvida.');
  return { tipo: 'devolucao', emprestimoId: e.id, chave: e.chave_codigo, local: e.local, solicitante: e.solicitante, devolvidoPor: b.devolvidoPor, data: agora, responsavel: user.name };
}

function assinarAgora(resumo, imagem) {
  const quando = new Date().toISOString();
  return { quando, hash: K.hashOf(resumo, imagem, quando) };
}

/**
 * Cria o pedido de assinatura. Com `imagem`: assinatura feita no computador — no quadro da tela (`dispositivo: tela`)
 * ou na janela aberta automaticamente na tela do tablet conectado (`dispositivo: tablet`).
 * Sem `imagem`: fica pendente e aparece na estação tablet via rede logada com o mesmo usuário.
 */
router.post('/assinaturas', ah(async (req, res) => {
  const b = parse(pedidoSchema, req.body);
  const resumo = await resumoDe(b, req.user);
  const id = crypto.randomUUID();
  const ua = (req.get('User-Agent') || '').slice(0, 300);
  if (b.imagem !== undefined) {
    const err = K.imagemInvalida(b.imagem);
    if (err) throw badRequest(err);
    const { quando, hash } = assinarAgora(resumo, b.imagem);
    await db.query(
      `INSERT INTO chaves_assinaturas (id, criada_por, tipo, resumo, status, dispositivo, imagem, hash, assinada_em, ip, user_agent, expira_em)
       VALUES ($1,$2,$3,$4,'assinada',$11,$5,$6,$7,$8,$9, NOW() + make_interval(mins => $10))`,
      [id, req.user.id, b.tipo, JSON.stringify(resumo), b.imagem, hash, quando, req.ip, ua, USO_APOS_ASSINAR_MIN, b.dispositivo]);
  } else {
    await db.query(
      `INSERT INTO chaves_assinaturas (id, criada_por, tipo, resumo, expira_em) VALUES ($1,$2,$3,$4, NOW() + make_interval(mins => $5))`,
      [id, req.user.id, b.tipo, JSON.stringify(resumo), await config.get('chaves.assinaturaMin')]);
    // Só um pedido pendente por vez para o tablet deste usuário
    await db.query("UPDATE chaves_assinaturas SET status = 'cancelada' WHERE criada_por = $1 AND status = 'pendente' AND id <> $2", [req.user.id, id]);
  }
  const { rows } = await db.query('SELECT * FROM chaves_assinaturas WHERE id = $1', [id]);
  res.status(201).json(K.assinaturaOf(rows[0]));
}));

/** Estação tablet: pedido pendente do usuário logado (o mais recente, dentro da validade). */
router.get('/assinaturas/pendente', ah(async (req, res) => {
  const { rows } = await db.query("SELECT * FROM chaves_assinaturas WHERE criada_por = $1 AND status = 'pendente' AND expira_em > NOW() ORDER BY created_at DESC LIMIT 1", [req.user.id]);
  res.json({ pedido: rows[0] ? K.assinaturaOf(rows[0]) : null });
}));

async function minha(req) {
  const id = uuidParam(req.params.id);
  const { rows } = await db.query('SELECT * FROM chaves_assinaturas WHERE id = $1', [id]);
  if (!rows.length) throw notFound('Pedido de assinatura não encontrado.');
  if (rows[0].criada_por !== req.user.id) throw forbidden('Este pedido de assinatura é de outro usuário.');
  return rows[0];
}

/** Situação do pedido (o computador consulta até o tablet concluir). */
router.get('/assinaturas/:id', ah(async (req, res) => {
  const a = await minha(req);
  res.json(K.assinaturaOf(a.status === 'pendente' && new Date(a.expira_em) < new Date() ? { ...a, status: 'expirada' } : a, true));
}));

/** Assinatura feita na estação tablet. */
router.post('/assinaturas/:id/assinar', ah(async (req, res) => {
  const a = await minha(req);
  const { imagem } = parse(z.object({ imagem: z.string() }), req.body);
  if (a.status !== 'pendente') throw conflict('Este pedido não está mais aguardando assinatura.');
  if (new Date(a.expira_em) < new Date()) throw conflict('O pedido de assinatura expirou. Peça um novo no computador.');
  const err = K.imagemInvalida(imagem);
  if (err) throw badRequest(err);
  const { quando, hash } = assinarAgora(a.resumo, imagem);
  const { rowCount } = await db.query(
    `UPDATE chaves_assinaturas SET status='assinada', dispositivo='tablet', imagem=$2, hash=$3, assinada_em=$4, ip=$5, user_agent=$6, expira_em = NOW() + make_interval(mins => $7)
     WHERE id = $1 AND status = 'pendente'`, [a.id, imagem, hash, quando, req.ip, (req.get('User-Agent') || '').slice(0, 300), USO_APOS_ASSINAR_MIN]);
  if (!rowCount) throw conflict('Este pedido não está mais aguardando assinatura.');
  res.json({ ok: true });
}));

router.delete('/assinaturas/:id', ah(async (req, res) => {
  const a = await minha(req);
  if (a.status === 'pendente') await db.query("UPDATE chaves_assinaturas SET status = 'cancelada' WHERE id = $1", [a.id]);
  res.json({ ok: true });
}));

/** Reserva a assinatura para um registro: do próprio usuário, assinada, do tipo certo, não usada e dentro do prazo. */
async function consumir(c, assinaturaId, userId, tipo, confere) {
  const { rows } = await c.query('SELECT * FROM chaves_assinaturas WHERE id = $1 FOR UPDATE', [uuidParam(assinaturaId)]);
  const a = rows[0];
  if (!a || a.criada_por !== userId || a.tipo !== tipo) throw badRequest('Assinatura inválida para este registro.');
  if (a.status !== 'assinada') throw badRequest('O solicitante ainda não assinou.');
  if (a.usada) throw conflict('Esta assinatura já foi usada.');
  if (new Date(a.expira_em) < new Date()) throw badRequest('A assinatura expirou. Colete a assinatura novamente.');
  if (!confere(a.resumo)) throw badRequest('A assinatura não corresponde aos dados informados. Colete a assinatura novamente.');
  await c.query('UPDATE chaves_assinaturas SET usada = TRUE WHERE id = $1', [a.id]);
  return a;
}

// ---------- Empréstimos ----------
router.get('/emprestimos', ah(async (req, res) => {
  const sit = String(req.query.situacao || 'abertos');
  const where = sit === 'devolvidas' ? 'WHERE e.devolucao_em IS NOT NULL' : sit === 'todas' ? '' : 'WHERE e.devolucao_em IS NULL';
  let items = await K.emprestimos(where);
  if (sit === 'atrasadas') items = items.filter((e) => e.atrasado);
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q) items = items.filter((e) => [e.local, e.chaveCodigo, e.solicitante, e.devolvidoPor].join(' ').toLowerCase().includes(q));
  const { rows: tot } = await db.query("SELECT COUNT(*) FILTER (WHERE devolucao_em IS NULL)::int abertos, COUNT(*) FILTER (WHERE devolucao_em >= date_trunc('month', NOW()))::int devolvidas_mes FROM chaves_emprestimos");
  const atrasadas = (await K.emprestimos('WHERE e.devolucao_em IS NULL')).filter((e) => e.atrasado).length;
  res.json({ items, kpis: { ...tot[0], atrasadas }, prazoHoras: await config.get('chaves.prazoHoras') });
}));

/** Termo de entrega e recebimento (com as assinaturas) — leitura de dado pessoal, registrada na auditoria. */
router.get('/emprestimos/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await db.query(`${K.SELECT_EMP} WHERE e.id = $1`, [id]);
  if (!rows.length) throw notFound('Empréstimo não encontrado.');
  const e = rows[0];
  const ass = (await db.query('SELECT * FROM chaves_assinaturas WHERE id = ANY($1)', [[e.assinatura_retirada, e.assinatura_devolucao].filter(Boolean)])).rows;
  const by = (aid) => K.assinaturaOf(ass.find((a) => a.id === aid), true);
  await audit.logPersonalRead(req, `Termo de chave ${e.chave_codigo} · ${e.solicitante} (assinaturas)`);
  res.json({ ...K.emprestimoOf(e, await K.situacao(e)), assinaturaRetirada: by(e.assinatura_retirada), assinaturaDevolucao: e.assinatura_devolucao ? by(e.assinatura_devolucao) : null });
}));

const retiradaSchema = z.object({
  chaveId: z.number().int().positive(),
  solicitante: z.string().trim().min(3, 'Informe o nome do solicitante.').max(160),
  solicitanteDoc: z.string().trim().max(40).optional().default(''),
  assinaturaId: z.string({ message: 'Colete a assinatura do solicitante.' }),
  observacao: z.string().trim().max(400).optional().default('')
});
router.post('/emprestimos', ah(async (req, res) => {
  const b = parse(retiradaSchema, req.body);
  const id = await db.tx(async (c) => {
    const { rows: ch } = await c.query('SELECT * FROM chaves WHERE id = $1 FOR UPDATE', [b.chaveId]);
    if (!ch.length || !ch[0].ativa) throw badRequest('Chave não encontrada ou desativada.');
    if ((await c.query('SELECT 1 FROM chaves_emprestimos WHERE chave_id = $1 AND devolucao_em IS NULL', [b.chaveId])).rows.length) throw conflict('Esta chave já está emprestada.');
    const a = await consumir(c, b.assinaturaId, req.user.id, 'retirada', (r) => r.chaveId === b.chaveId && r.solicitante === b.solicitante && (r.solicitanteDoc || '') === b.solicitanteDoc);
    const { rows: u } = await c.query("SELECT id FROM users WHERE lower(name) = lower($1) LIMIT 1", [b.solicitante]);
    const r = await c.query(
      `INSERT INTO chaves_emprestimos (chave_id, local, solicitante, solicitante_doc, solicitante_user_id, retirada_em, entregue_por, assinatura_retirada, observacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [b.chaveId, ch[0].local, b.solicitante, b.solicitanteDoc, u[0] ? u[0].id : null, a.assinada_em, req.user.id, a.id, b.observacao]);
    return r.rows[0].id;
  });
  await audit.log(req, { action: 'Chave entregue', module: 'chaves', detail: `${b.solicitante} · empréstimo nº ${id} (assinatura eletrônica)` });
  res.status(201).json({ id });
}));

router.post('/emprestimos/:id/devolucao', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(z.object({
    devolvidoPor: z.string().trim().min(3, 'Informe quem está devolvendo a chave.').max(160),
    assinaturaId: z.string({ message: 'Colete a assinatura de quem devolve.' }),
    observacao: z.string().trim().max(400).optional()
  }), req.body);
  await db.tx(async (c) => {
    const { rows } = await c.query('SELECT * FROM chaves_emprestimos WHERE id = $1 FOR UPDATE', [id]);
    if (!rows.length) throw notFound('Empréstimo não encontrado.');
    if (rows[0].devolucao_em) throw conflict('Esta chave já foi devolvida.');
    const a = await consumir(c, b.assinaturaId, req.user.id, 'devolucao', (r) => r.emprestimoId === id && r.devolvidoPor === b.devolvidoPor);
    await c.query(
      `UPDATE chaves_emprestimos SET devolucao_em = $2, devolvido_por = $3, recebido_por = $4, assinatura_devolucao = $5,
         observacao = CASE WHEN $6::text IS NULL THEN observacao ELSE $6 END WHERE id = $1`,
      [id, a.assinada_em, b.devolvidoPor, req.user.id, a.id, b.observacao === undefined ? null : b.observacao]);
  });
  await audit.log(req, { action: 'Chave recebida', module: 'chaves', detail: `${b.devolvidoPor} · empréstimo nº ${id} (assinatura eletrônica)` });
  res.json({ ok: true });
}));

module.exports = router;
