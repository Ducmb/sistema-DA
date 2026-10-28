/**
 * Patrimônio (módulo patrimonio): transferências de responsabilidade e termos por centro de custo.
 */
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const P = require('../services/patrimonio');
const { ah, parse, idParam, notFound, badRequest, conflict, forbidden } = require('../lib/http');
const { today, fmtBR } = require('../lib/dates');

const router = express.Router();
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

const patCcs = async () => (await db.query("SELECT id, codigo, nome FROM cost_centers WHERE tipo = 'patrimonio' AND ativo ORDER BY codigo")).rows;

router.get('/meta', ah(async (req, res) => {
  const { rows: users } = await db.query("SELECT id, name FROM users WHERE status = 'active' AND situacao <> 'Desligado' ORDER BY name");
  res.json({ stages: P.STAGES, patCcs: await patCcs(), users, prazoTermo: await config.get('patrim.prazoTermo') });
}));

const decorate = (t, me) => {
  const s = P.stageInfo(t.status);
  const aguarda = t.status === 'Pendente' && !!t.toUserId;
  return { ...t, ...s, next: aguarda ? null : s.next, aguardaAssinatura: aguarda, canSign: aguarda && t.toUserId === me };
};

router.get('/transferencias', ah(async (req, res) => {
  const items = (await P.transferencias()).map((t) => decorate(t, req.user.id));
  res.json({ items, myPending: items.find((t) => t.canSign) || null, termosPendentes: (await P.termos(await P.ultimoMes())).pendentes });
}));

const trSchema = z.object({
  code: z.string().trim().min(1, 'Preencha todos os campos.').max(40).transform((s) => s.toUpperCase()),
  description: z.string().trim().min(1, 'Preencha todos os campos.').max(200),
  fromUser: z.string().trim().min(1, 'Preencha todos os campos.').max(160),
  toUser: z.string().trim().min(1, 'Preencha todos os campos.').max(160),
  fromCc: z.string().trim().max(160).optional().default(''),
  toCc: z.string().trim().max(160).optional().default(''),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Preencha todos os campos.')
});

/** Valida e resolve centros de custo (somente tipo Patrimônio) e o servidor de destino. */
async function resolve(b) {
  const ccs = await patCcs();
  const find = (n) => ccs.find((c) => c.nome.toLowerCase() === n.toLowerCase() || c.codigo.toLowerCase() === n.toLowerCase());
  if ((b.fromCc && !find(b.fromCc)) || (b.toCc && !find(b.toCc))) throw badRequest('Use um centro de custo do tipo Patrimônio cadastrado.');
  if (b.fromUser.toLowerCase() === b.toUser.toLowerCase()) throw badRequest('O novo responsável deve ser diferente do atual.');
  // Sem centro informado, o responsável pode ser o próprio setor (nome igual ao do centro de custo).
  const from = find(b.fromCc || b.fromUser), to = find(b.toCc || b.toUser);
  const { rows } = await db.query("SELECT id FROM users WHERE lower(name) = lower($1) AND status = 'active' LIMIT 1", [b.toUser]);
  return { fromCcId: from ? from.id : null, toCcId: to ? to.id : null, toUserId: rows[0] ? rows[0].id : null };
}

router.post('/transferencias', ah(async (req, res) => {
  const b = parse(trSchema, req.body);
  const r = await resolve(b);
  if (await config.get('patrim.bloqueioDuplo')) {
    const d = await db.query("SELECT 1 FROM patrimonio_transferencias WHERE upper(code) = $1 AND status NOT IN ('Realizado', 'Recusado')", [b.code]);
    if (d.rows.length) throw conflict('Já existe transferência pendente para este bem.');
  }
  const { rows } = await db.query(
    `INSERT INTO patrimonio_transferencias (code, description, from_user, to_user, to_user_id, from_cc_id, to_cc_id, data, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [b.code, b.description, b.fromUser, b.toUser, r.toUserId, r.fromCcId, r.toCcId, b.date, req.user.id]);
  await audit.log(req, { action: 'Transferência registrada', module: 'patrimonio', detail: `${b.code} · ${b.description} · ${b.fromUser} → ${b.toUser}` });
  res.status(201).json({ id: rows[0].id, code: b.code });
}));

const getT = async (id) => {
  const t = (await P.transferencias()).find((x) => x.id === id);
  if (!t) throw notFound('Transferência não encontrada.');
  return t;
};

router.put('/transferencias/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const before = await getT(id);
  const b = parse(trSchema, req.body);
  // Depois de assinado, o termo não muda: só os centros de custo podem ser completados
  if (before.signedAt && (b.code !== before.code || b.description !== before.description || b.fromUser !== before.fromUser || b.toUser !== before.toUser || b.date !== before.date)) {
    throw conflict('Termo já assinado: somente os centros de custo podem ser alterados.');
  }
  const r = await resolve(b);
  await db.query(
    `UPDATE patrimonio_transferencias SET code=$2, description=$3, from_user=$4, to_user=$5, to_user_id=$6, from_cc_id=$7, to_cc_id=$8, data=$9, updated_at=NOW() WHERE id=$1`,
    [id, b.code, b.description, b.fromUser, b.toUser, r.toUserId, r.fromCcId, r.toCcId, b.date]);
  await audit.log(req, { action: 'Transferência editada', module: 'patrimonio', detail: before.code + ' · ' + b.description });
  res.json({ ok: true, code: b.code });
}));

router.post('/transferencias/:id/etapa', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { dir } = parse(z.object({ dir: z.union([z.literal(1), z.literal(-1)]) }), req.body);
  const t = await getT(id), s = P.stageInfo(t.status);
  const st = dir > 0 ? s.next : s.prev;
  if (!st) throw badRequest(t.status === 'Recusado' ? 'Transferência recusada não muda de etapa.' : 'Não há etapa ' + (dir > 0 ? 'seguinte.' : 'anterior.'));
  // O termo só se formaliza com a assinatura do servidor de destino: não se pula essa etapa
  if (t.status === 'Pendente' && t.toUserId) throw forbidden('Aguardando a assinatura de ' + t.toUser + '. Somente o novo responsável assina o termo.');
  // Voltar para Pendente invalida a assinatura (o termo precisa ser assinado de novo)
  await db.query(`UPDATE patrimonio_transferencias SET status=$2, updated_at=NOW()${st === 'Pendente' ? ', assinado_em=NULL, assinado_por=NULL' : ''} WHERE id=$1`, [id, st]);
  await audit.log(req, { action: 'Transferência: etapa alterada', module: 'patrimonio', detail: `${t.code} · ${t.status} → ${st}` });
  res.json({ ok: true, status: st });
}));

/** Assinatura/recusa: somente o servidor de destino, enquanto a transferência estiver Pendente. */
async function decide(req, sign) {
  const id = idParam(req.params.id);
  const t = await getT(id);
  if (t.toUserId !== req.user.id) throw forbidden('Somente o novo responsável pode assinar ou recusar o termo.');
  if (t.status !== 'Pendente') throw conflict('A transferência não está pendente de assinatura.');
  await db.query(
    `UPDATE patrimonio_transferencias SET status=$2, assinado_em=NOW(), assinado_por=$3, updated_at=NOW() WHERE id=$1`,
    [id, sign ? 'Verificar transferência' : 'Recusado', req.user.id]);
  await audit.log(req, { action: sign ? 'Termo de responsabilidade assinado' : 'Termo de responsabilidade recusado', module: 'patrimonio', detail: t.code + ' · ' + t.description });
  return t;
}
router.post('/transferencias/:id/assinar', ah(async (req, res) => { await decide(req, true); res.json({ ok: true, status: 'Verificar transferência' }); }));
router.post('/transferencias/:id/recusar', ah(async (req, res) => { await decide(req, false); res.json({ ok: true, status: 'Recusado' }); }));

// ---------- Termos de responsabilidade ----------
router.get('/termos', ah(async (req, res) => {
  const ym = YM.test(String(req.query.mes || '')) ? req.query.mes : await P.ultimoMes();
  res.json(await P.termos(ym));
}));

async function termoParams(req) {
  const ccId = idParam(req.params.ccId), ym = String(req.params.ym);
  if (!YM.test(ym)) throw badRequest('Mês inválido.');
  const { rows } = await db.query("SELECT nome FROM cost_centers WHERE id = $1 AND tipo = 'patrimonio'", [ccId]);
  if (!rows.length) throw notFound('Centro de custo de patrimônio não encontrado.');
  return { ccId, ym, nome: rows[0].nome };
}
router.put('/termos/:ccId/:ym', ah(async (req, res) => {
  const p = await termoParams(req);
  await db.query('INSERT INTO patrimonio_termos (cost_center_id, ym, emitido_em, emitido_por) VALUES ($1,$2,$3,$4) ON CONFLICT (cost_center_id, ym) DO NOTHING', [p.ccId, p.ym, today(), req.user.id]);
  await audit.log(req, { action: 'Termo de responsabilidade emitido', module: 'patrimonio', detail: p.nome + ' · ' + p.ym });
  res.json({ ok: true, emitido: today(), label: fmtBR(today()) });
}));
router.delete('/termos/:ccId/:ym', ah(async (req, res) => {
  const p = await termoParams(req);
  await db.query('DELETE FROM patrimonio_termos WHERE cost_center_id = $1 AND ym = $2', [p.ccId, p.ym]);
  await audit.log(req, { action: 'Emissão de termo desfeita', module: 'patrimonio', detail: p.nome + ' · ' + p.ym });
  res.json({ ok: true });
}));

module.exports = router;
