/**
 * Protocolo (módulo protocolo): documentos, processos, prazos e calendário integrado.
 */
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const P = require('../services/protocolo');
const feed = require('../services/feed');
const { ah, parse, idParam, notFound, badRequest } = require('../lib/http');
const { today, fmtBR } = require('../lib/dates');

const router = express.Router();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const prazoFields = {
  prazo: z.string().regex(ISO, 'Data do prazo inválida.').optional().or(z.literal('')).default(''),
  prazoDesc: z.string().trim().max(200).optional().default('')
};

router.get('/meta', ah(async (req, res) => {
  const { rows } = await db.query("SELECT nome FROM cost_centers WHERE ativo AND tipo = 'padrao' ORDER BY nome");
  res.json({ fluxo: P.DOC_FLOW, prioridades: P.PRIORIDADES, setores: rows.map((r) => r.nome), prazoPadrao: await config.get('prot.prazoPadrao'), alertaAntes: await config.get('prot.alertaAntes') });
}));

/** Mantém o prazo principal (o mais antigo em aberto) do documento/processo editado no formulário. */
async function upsertPrazo(c, col, refId, b, def, userId) {
  const { rows } = await c.query(`SELECT id FROM protocolo_prazos WHERE ${col} = $1 AND concluido_em IS NULL ORDER BY vencimento, id LIMIT 1`, [refId]);
  const desc = b.prazoDesc || def;
  if (b.prazo && rows.length) await c.query('UPDATE protocolo_prazos SET descricao = $2, vencimento = $3 WHERE id = $1', [rows[0].id, desc, b.prazo]);
  else if (b.prazo) await c.query(`INSERT INTO protocolo_prazos (${col}, descricao, vencimento, created_by) VALUES ($1,$2,$3,$4)`, [refId, desc, b.prazo, userId]);
  else if (rows.length) await c.query('DELETE FROM protocolo_prazos WHERE id = $1', [rows[0].id]);
}
const prazoPrincipal = async (col, ids) => {
  if (!ids.length) return new Map();
  const { rows } = await db.query(`SELECT DISTINCT ON (${col}) ${col} AS ref, descricao, vencimento FROM protocolo_prazos WHERE ${col} = ANY($1) AND concluido_em IS NULL ORDER BY ${col}, vencimento, id`, [ids]);
  return new Map(rows.map((r) => [r.ref, { prazo: r.vencimento, prazoDesc: r.descricao }]));
};

// ---------- Documentos ----------
const docOf = (d, z) => {
  const i = P.DOC_FLOW.indexOf(d.status);
  return { id: d.id, protocolo: d.protocolo, assunto: d.assunto, interessado: d.interessado, setor: d.setor, data: d.data, status: d.status,
    prev: i > 0 ? P.DOC_FLOW[i - 1] : null, next: i < P.DOC_FLOW.length - 1 ? P.DOC_FLOW[i + 1] : null, prazo: z ? z.prazo : '', prazoDesc: z ? z.prazoDesc : '' };
};

router.get('/documentos', ah(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM protocolo_documentos ORDER BY data DESC, id DESC');
  const q = String(req.query.q || '').trim().toLowerCase(), st = P.DOC_FLOW.includes(req.query.status) ? req.query.status : null;
  const shown = rows.filter((d) => (!q || [d.assunto, d.protocolo, d.interessado].some((x) => x.toLowerCase().includes(q))) && (!st || d.status === st));
  const zs = await prazoPrincipal('documento_id', shown.map((d) => d.id));
  res.json({ total: rows.length, items: shown.map((d) => docOf(d, zs.get(d.id))) });
}));

const docSchema = z.object({
  assunto: z.string().trim().min(1, 'Informe o assunto.').max(300),
  interessado: z.string().trim().min(1, 'Informe o interessado.').max(160),
  setor: z.string().trim().max(160).optional().default(''),
  ...prazoFields
});

router.post('/documentos', ah(async (req, res) => {
  const b = parse(docSchema, req.body);
  const ano = today().slice(0, 4);
  const doc = await db.tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext('protocolo_documentos'))");
    const { rows } = await c.query("SELECT COALESCE(MAX(split_part(protocolo, '-', 3)::int), 0) + 1 AS n FROM protocolo_documentos WHERE protocolo LIKE $1", ['PRT-' + ano + '-%']);
    const protocolo = `PRT-${ano}-${String(rows[0].n).padStart(3, '0')}`;
    const r = await c.query('INSERT INTO protocolo_documentos (protocolo, assunto, interessado, setor, data, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [protocolo, b.assunto, b.interessado, b.setor, today(), req.user.id]);
    await upsertPrazo(c, 'documento_id', r.rows[0].id, b, 'Prazo de resposta', req.user.id);
    return r.rows[0];
  });
  await audit.log(req, { action: 'Documento protocolado', module: 'protocolo', detail: doc.protocolo + ' · ' + doc.assunto });
  res.status(201).json(docOf(doc));
}));

router.put('/documentos/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(docSchema, req.body);
  const doc = await db.tx(async (c) => {
    const r = await c.query('UPDATE protocolo_documentos SET assunto=$2, interessado=$3, setor=$4, updated_at=NOW() WHERE id=$1 RETURNING *', [id, b.assunto, b.interessado, b.setor]);
    if (!r.rows.length) throw notFound('Documento não encontrado.');
    await upsertPrazo(c, 'documento_id', id, b, 'Prazo de resposta', req.user.id);
    return r.rows[0];
  });
  await audit.log(req, { action: 'Documento editado', module: 'protocolo', detail: doc.protocolo });
  res.json(docOf(doc));
}));

router.post('/documentos/:id/etapa', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { dir } = parse(z.object({ dir: z.union([z.literal(1), z.literal(-1)]) }), req.body);
  const { rows } = await db.query('SELECT * FROM protocolo_documentos WHERE id = $1', [id]);
  if (!rows.length) throw notFound('Documento não encontrado.');
  const d = docOf(rows[0]), st = dir > 0 ? d.next : d.prev;
  if (!st) throw badRequest('Não há etapa ' + (dir > 0 ? 'seguinte.' : 'anterior.'));
  await db.query('UPDATE protocolo_documentos SET status = $2, updated_at = NOW() WHERE id = $1', [id, st]);
  await audit.log(req, { action: 'Documento: etapa alterada', module: 'protocolo', detail: `${d.protocolo} · ${d.status} → ${st}` });
  res.json({ ...d, status: st });
}));

// ---------- Processos ----------
const procOf = (p, z) => ({ id: p.id, codigo: p.codigo, titulo: p.titulo, descricao: p.descricao, prioridade: p.prioridade, progresso: p.progresso, responsavel: p.responsavel, prazo: z ? z.prazo : '', prazoDesc: z ? z.prazoDesc : '' });

router.get('/processos', ah(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM protocolo_processos ORDER BY id DESC');
  const zs = await prazoPrincipal('processo_id', rows.map((p) => p.id));
  res.json(rows.map((p) => procOf(p, zs.get(p.id))));
}));

const procSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título.').max(200),
  descricao: z.string().trim().max(600).optional().default(''),
  prioridade: z.enum(P.PRIORIDADES).default('Média'),
  responsavel: z.string().trim().max(160).optional().default(''),
  ...prazoFields
});

router.post('/processos', ah(async (req, res) => {
  const b = parse(procSchema, req.body);
  const p = await db.tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtext('protocolo_processos'))");
    const { rows } = await c.query("SELECT COALESCE(MAX(split_part(codigo, '-', 2)::int), 0) + 1 AS n FROM protocolo_processos");
    const codigo = 'PROC-' + String(rows[0].n).padStart(3, '0');
    const r = await c.query('INSERT INTO protocolo_processos (codigo, titulo, descricao, prioridade, responsavel, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [codigo, b.titulo, b.descricao || 'Sem descrição.', b.prioridade, b.responsavel, req.user.id]);
    await upsertPrazo(c, 'processo_id', r.rows[0].id, b, 'Prazo do processo', req.user.id);
    return r.rows[0];
  });
  await audit.log(req, { action: 'Processo criado', module: 'protocolo', detail: p.codigo + ' · ' + p.titulo });
  res.status(201).json(procOf(p));
}));

router.put('/processos/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(procSchema, req.body);
  const p = await db.tx(async (c) => {
    const r = await c.query('UPDATE protocolo_processos SET titulo=$2, descricao=$3, prioridade=$4, responsavel=$5, updated_at=NOW() WHERE id=$1 RETURNING *', [id, b.titulo, b.descricao || 'Sem descrição.', b.prioridade, b.responsavel]);
    if (!r.rows.length) throw notFound('Processo não encontrado.');
    await upsertPrazo(c, 'processo_id', id, b, 'Prazo do processo', req.user.id);
    return r.rows[0];
  });
  await audit.log(req, { action: 'Processo editado', module: 'protocolo', detail: p.codigo });
  res.json(procOf(p));
}));

router.post('/processos/:id/progresso', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { delta } = parse(z.object({ delta: z.union([z.literal(10), z.literal(-10)]) }), req.body);
  const { rows } = await db.query('UPDATE protocolo_processos SET progresso = LEAST(100, GREATEST(0, progresso + $2)), updated_at = NOW() WHERE id = $1 RETURNING *', [id, delta]);
  if (!rows.length) throw notFound('Processo não encontrado.');
  res.json(procOf(rows[0]));
}));

// ---------- Prazos ----------
router.get('/prazos', ah(async (req, res) => res.json(await P.prazos())));

const prazoSchema = z.object({
  refTipo: z.enum(['documento', 'processo'], { message: 'Informe o documento/processo, a descrição e a data.' }),
  refId: z.coerce.number().int().positive('Informe o documento/processo, a descrição e a data.'),
  descricao: z.string().trim().min(1, 'Informe o documento/processo, a descrição e a data.').max(200),
  vencimento: z.string().regex(ISO, 'Informe o documento/processo, a descrição e a data.')
});
async function refExists(b) {
  const t = b.refTipo === 'documento' ? 'protocolo_documentos' : 'protocolo_processos';
  const { rows } = await db.query(`SELECT 1 FROM ${t} WHERE id = $1`, [b.refId]);
  if (!rows.length) throw badRequest('Documento ou processo não encontrado.');
}

router.post('/prazos', ah(async (req, res) => {
  const b = parse(prazoSchema, req.body);
  await refExists(b);
  const col = b.refTipo === 'documento' ? 'documento_id' : 'processo_id';
  const { rows } = await db.query(`INSERT INTO protocolo_prazos (${col}, descricao, vencimento, created_by) VALUES ($1,$2,$3,$4) RETURNING id`, [b.refId, b.descricao, b.vencimento, req.user.id]);
  await audit.log(req, { action: 'Prazo cadastrado', module: 'protocolo', detail: b.descricao + ' · ' + fmtBR(b.vencimento) });
  res.status(201).json({ id: rows[0].id });
}));

router.put('/prazos/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(prazoSchema, req.body);
  await refExists(b);
  const doc = b.refTipo === 'documento';
  const { rowCount } = await db.query('UPDATE protocolo_prazos SET documento_id=$2, processo_id=$3, descricao=$4, vencimento=$5 WHERE id=$1 AND concluido_em IS NULL', [id, doc ? b.refId : null, doc ? null : b.refId, b.descricao, b.vencimento]);
  if (!rowCount) throw notFound('Prazo não encontrado.');
  await audit.log(req, { action: 'Prazo editado', module: 'protocolo', detail: b.descricao + ' · ' + fmtBR(b.vencimento) });
  res.json({ ok: true });
}));

router.post('/prazos/:id/concluir', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { rows } = await db.query('UPDATE protocolo_prazos SET concluido_em = NOW(), concluido_por = $2 WHERE id = $1 AND concluido_em IS NULL RETURNING descricao', [id, req.user.id]);
  if (!rows.length) throw notFound('Prazo não encontrado.');
  await audit.log(req, { action: 'Prazo concluído', module: 'protocolo', detail: rows[0].descricao });
  res.json({ ok: true });
}));

// ---------- Calendário integrado (somente módulos acessíveis ao usuário) ----------
router.get('/calendario', ah(async (req, res) => res.json(await feed.calendar(req.user.modules))));
router.get('/prazos-criticos', ah(async (req, res) => res.json(await feed.critical(req.user.modules))));

module.exports = router;
