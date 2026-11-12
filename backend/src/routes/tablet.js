/**
 * API do tablet pareado (Android/iPad) do Controle de Chaves — sem login de usuário.
 * Autenticação: "Authorization: Tablet <token>" (token de dispositivo obtido no pareamento).
 * O tablet só enxerga o pedido de assinatura enviado a ele e só pode assiná-lo.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const K = require('../services/chaves');
const T = require('../services/tablets');
const { ah, parse, badRequest, conflict, notFound } = require('../lib/http');

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const USO_APOS_ASSINAR_MIN = 30;
const limitePareamento = rateLimit({ windowMs: 15 * 60000, limit: 10, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test', message: { error: 'Muitas tentativas. Aguarde alguns minutos.' } });

/** Troca o código de pareamento (uso único, 15 min) pelo token do dispositivo. */
router.post('/parear', limitePareamento, ah(async (req, res) => {
  const { codigo } = parse(z.object({ codigo: z.string().max(20) }), req.body);
  const c = T.normCodigo(codigo);
  if (c.length !== 8) throw badRequest('Código inválido ou expirado.');
  const token = T.novoToken();
  const { rows } = await db.query(
    `UPDATE chaves_tablets SET token_hash = $2, codigo_hash = NULL, codigo_expira = NULL, pareado_em = NOW(), ultimo_contato = NOW(), ultimo_ip = $3, user_agent = $4
     WHERE codigo_hash = $1 AND codigo_expira > NOW() AND ativo RETURNING id, nome`,
    [T.sha(c), T.sha(token), String(req.ip || '').slice(0, 64), (req.get('User-Agent') || '').slice(0, 300)]);
  if (!rows.length) throw badRequest('Código inválido ou expirado.');
  await audit.log(req, { action: 'Tablet de assinatura pareado', module: 'chaves', detail: rows[0].nome });
  res.json({ token, nome: rows[0].nome });
}));

/** Autentica o tablet pelo token de dispositivo e registra o último contato (status "online" no computador). */
const tabletAuth = ah(async (req, res, next) => {
  const m = /^Tablet\s+(tab_[A-Za-z0-9_-]{20,100})$/.exec(req.get('Authorization') || '');
  if (!m) return res.status(401).json({ error: 'Tablet não pareado.' });
  const { rows } = await db.query(
    'UPDATE chaves_tablets SET ultimo_contato = NOW(), ultimo_ip = $2 WHERE token_hash = $1 AND ativo RETURNING id, nome',
    [T.sha(m[1]), String(req.ip || '').slice(0, 64)]);
  if (!rows.length) return res.status(401).json({ error: 'Tablet não pareado.' });
  req.tablet = rows[0];
  return next();
});

/** Pedido de assinatura aguardando neste tablet (o mais recente dentro da validade). */
router.get('/pedido', tabletAuth, ah(async (req, res) => {
  const { rows } = await db.query(
    "SELECT * FROM chaves_assinaturas WHERE tablet_id = $1 AND status = 'pendente' AND expira_em > NOW() ORDER BY created_at DESC LIMIT 1", [req.tablet.id]);
  res.json({ tablet: { nome: req.tablet.nome }, pedido: rows[0] ? K.assinaturaOf(rows[0]) : null });
}));

/** Grava o traço: vinculado ao conteúdo por SHA-256 com data/hora, IP e dispositivo. */
router.post('/pedido/:id/assinar', tabletAuth, ah(async (req, res) => {
  if (!UUID.test(req.params.id)) throw badRequest('Identificador inválido.');
  const { imagem } = parse(z.object({ imagem: z.string() }), req.body);
  const { rows } = await db.query('SELECT * FROM chaves_assinaturas WHERE id = $1 AND tablet_id = $2', [req.params.id, req.tablet.id]);
  const a = rows[0];
  if (!a) throw notFound('Pedido de assinatura não encontrado.');
  if (a.status !== 'pendente') throw conflict('Este pedido não está mais aguardando assinatura.');
  if (new Date(a.expira_em) < new Date()) throw conflict('O pedido de assinatura expirou. Peça um novo no computador.');
  const err = K.imagemInvalida(imagem);
  if (err) throw badRequest(err);
  const quando = new Date().toISOString();
  const { rowCount } = await db.query(
    `UPDATE chaves_assinaturas SET status='assinada', dispositivo='tablet', imagem=$2, hash=$3, assinada_em=$4, ip=$5, user_agent=$6, expira_em = NOW() + make_interval(mins => $7)
     WHERE id = $1 AND status = 'pendente'`,
    [a.id, imagem, K.hashOf(a.resumo, imagem, quando), quando, req.ip, (req.get('User-Agent') || '').slice(0, 300), USO_APOS_ASSINAR_MIN]);
  if (!rowCount) throw conflict('Este pedido não está mais aguardando assinatura.');
  res.json({ ok: true });
}));

module.exports = router;
