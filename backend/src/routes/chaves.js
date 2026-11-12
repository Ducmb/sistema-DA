/**
 * Controle de Chaves (módulo chaves): cadastro de chaves, retirada e devolução com assinatura eletrônica
 * do solicitante. A assinatura é feita na tela do computador ou num tablet pareado (Android/iPad), que recebe o
 * pedido automaticamente — o tablet não faz login; usa um token de dispositivo (ver routes/tablet.js).
 */
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const K = require('../services/chaves');
const A = require('../services/assinaturas');
const { ah, parse, idParam, notFound, badRequest, conflict } = require('../lib/http');

const router = express.Router();

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
/** Onde o traço foi feito quando a imagem vem do computador (quadro da tela/mesa digitalizadora). */
const DISP = z.enum(['tela'], { message: 'Dispositivo inválido.' }).optional().default('tela');
const pedidoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('retirada'), chaveId: z.number().int().positive(), solicitante: z.string().trim().min(3, 'Informe o nome do solicitante.').max(160), solicitanteDoc: z.string().trim().max(40).optional().default(''), imagem: z.string().optional(), dispositivo: DISP, tabletId: z.number().int().positive().optional() }),
  z.object({ tipo: z.literal('devolucao'), emprestimoId: z.number().int().positive(), devolvidoPor: z.string().trim().min(3, 'Informe quem está devolvendo a chave.').max(160), imagem: z.string().optional(), dispositivo: DISP, tabletId: z.number().int().positive().optional() })
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

/**
 * Cria o pedido de assinatura. Com `imagem`: assinatura feita no quadro da tela do computador.
 * Com `tabletId` (sem imagem): fica pendente e aparece automaticamente no tablet pareado escolhido.
 */
router.post('/assinaturas', ah(async (req, res) => {
  const b = parse(pedidoSchema, req.body);
  const resumo = await resumoDe(b, req.user);
  res.status(201).json(await A.criar(req, b.tipo, resumo, { imagem: b.imagem, tabletId: b.tabletId }));
}));

const TIPOS = ['retirada', 'devolucao'];
/** Situação do pedido (o computador consulta até o tablet concluir). */
router.get('/assinaturas/:id', ah(async (req, res) => res.json(A.situacao(await A.minha(req, req.params.id, TIPOS)))));

router.delete('/assinaturas/:id', ah(async (req, res) => {
  await A.cancelar(await A.minha(req, req.params.id, TIPOS));
  res.json({ ok: true });
}));
const consumir = A.consumir;

// ---------- Tablets pareados ----------
const T = require('../services/tablets');

router.get('/tablets', ah(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM chaves_tablets WHERE ativo ORDER BY nome, id');
  res.json(rows.map(T.tabletOf));
}));

router.post('/tablets', ah(async (req, res) => {
  const { nome } = parse(z.object({ nome: z.string().trim().min(2, 'Dê um nome ao tablet (ex.: Tablet da Portaria).').max(80) }), req.body);
  const codigo = T.novoCodigo();
  const { rows } = await db.query(
    "INSERT INTO chaves_tablets (nome, codigo_hash, codigo_expira, criado_por) VALUES ($1,$2, NOW() + make_interval(mins => $3), $4) RETURNING *",
    [nome, T.sha(T.normCodigo(codigo)), T.CODIGO_MIN, req.user.id]);
  await audit.log(req, { action: 'Tablet de assinatura cadastrado', module: 'chaves', detail: nome + ' (código de pareamento gerado)' });
  res.status(201).json({ ...T.tabletOf(rows[0]), codigo });
}));

/** Novo código de pareamento: desconecta o aparelho atual (o token antigo deixa de valer). */
router.post('/tablets/:id/codigo', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const codigo = T.novoCodigo();
  const { rows } = await db.query(
    `UPDATE chaves_tablets SET token_hash = NULL, pareado_em = NULL, codigo_hash = $2, codigo_expira = NOW() + make_interval(mins => $3)
     WHERE id = $1 AND ativo RETURNING *`, [id, T.sha(T.normCodigo(codigo)), T.CODIGO_MIN]);
  if (!rows.length) throw notFound('Tablet não encontrado.');
  await db.query("UPDATE chaves_assinaturas SET status = 'cancelada' WHERE tablet_id = $1 AND status = 'pendente'", [id]);
  await audit.log(req, { action: 'Tablet de assinatura: novo pareamento', module: 'chaves', detail: rows[0].nome });
  res.json({ ...T.tabletOf(rows[0]), codigo });
}));

router.delete('/tablets/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await db.query('UPDATE chaves_tablets SET ativo = FALSE, token_hash = NULL, codigo_hash = NULL WHERE id = $1 AND ativo RETURNING nome', [id]);
  if (!rows.length) throw notFound('Tablet não encontrado.');
  await db.query("UPDATE chaves_assinaturas SET status = 'cancelada' WHERE tablet_id = $1 AND status = 'pendente'", [id]);
  await audit.log(req, { action: 'Tablet de assinatura removido', module: 'chaves', detail: rows[0].nome, level: 'warning' });
  res.json({ ok: true });
}));

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
