/**
 * Central de Notificações (módulo notificacoes): caixa de entrada, não lidas, arquivadas e preferências.
 */
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const N = require('../services/notifications');
const { ah, parse, badRequest, notFound } = require('../lib/http');

const router = express.Router();
const nid = (v) => { if (!/^[\w.:-]{1,120}$/.test(String(v))) throw badRequest('Identificador inválido.'); return String(v); };

router.get('/', ah(async (req, res) => res.json(await N.list(req.user))));
router.get('/summary', ah(async (req, res) => res.json(await N.summary(req.user))));

async function setState(req, sql) {
  const { rowCount } = await db.query(`UPDATE notification_state SET ${sql} WHERE user_id = $1 AND notif_id = $2`, [req.user.id, nid(req.params.id)]);
  if (!rowCount) throw notFound('Notificação não encontrada.');
}
router.post('/read-all', ah(async (req, res) => {
  await N.current(req.user.id, req.user.modules);
  await db.query('UPDATE notification_state SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL AND archived_at IS NULL', [req.user.id]);
  res.json({ ok: true });
}));
/** "Limpar todos": arquiva (marcando como lidas) as notificações da caixa de entrada. */
router.post('/archive-all', ah(async (req, res) => {
  const { live } = await N.current(req.user.id, req.user.modules);
  await db.query('UPDATE notification_state SET archived_at = NOW(), read_at = COALESCE(read_at, NOW()) WHERE user_id = $1 AND archived_at IS NULL AND notif_id = ANY($2)', [req.user.id, live]);
  res.json({ ok: true });
}));
router.post('/:id/read', ah(async (req, res) => { await setState(req, 'read_at = COALESCE(read_at, NOW())'); res.json({ ok: true }); }));
router.post('/:id/archive', ah(async (req, res) => { await setState(req, 'archived_at = NOW(), read_at = COALESCE(read_at, NOW())'); res.json({ ok: true }); }));
router.post('/:id/restore', ah(async (req, res) => { await setState(req, 'archived_at = NULL'); res.json({ ok: true }); }));

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
router.put('/preferences', ah(async (req, res) => {
  const b = parse(z.object({
    types: z.record(z.enum(N.TYPES.map((t) => t.id)), z.boolean()),
    tempoReal: z.boolean(),
    email: z.boolean(),
    silencio: z.object({ on: z.boolean(), inicio: z.string().regex(HM, 'Use o formato HH:MM.'), fim: z.string().regex(HM, 'Use o formato HH:MM.') })
  }), req.body);
  const prefs = { ...req.user.preferences, notificacoes: b };
  await db.query('UPDATE users SET preferences = $1 WHERE id = $2', [JSON.stringify(prefs), req.user.id]);
  res.json(N.prefsOf({ preferences: prefs }));
}));

module.exports = router;
