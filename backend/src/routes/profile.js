/**
 * Meus Dados (RF09–RF11, RNF04). Dados funcionais são somente leitura para o próprio usuário.
 */
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const { ah, parse, forbidden } = require('../lib/http');

const router = express.Router();
const LOCKED = ['name', 'registration', 'position', 'email', 'institutionalEmail', 'department', 'hierarchy', 'username', 'roles'];

const profileOf = (u) => ({
  name: u.name, registration: u.registration || '', position: u.position || '', department: u.department || '', hierarchy: u.hierarchy,
  institutionalEmail: u.email, phone: u.phone || '', personalEmail: u.personal_email || '', birthday: u.birthday || ''
});

router.get('/', ah(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  res.json({ ...profileOf(rows[0]), roles: req.user.roles, role: req.user.role });
}));

router.put('/', ah(async (req, res) => {
  const tried = Object.keys(req.body || {}).filter((k) => LOCKED.includes(k));
  if (tried.length) {
    await audit.log(req, { action: 'Alteração bloqueada', module: 'perfil', detail: 'Tentativa de alterar dados funcionais: ' + tried.join(', '), level: 'warning' });
    throw forbidden('Nome, matrícula, cargo e e-mail institucional só podem ser alterados pela Gestão de Pessoal.');
  }
  const body = parse(z.object({
    phone: z.string().trim().regex(/^\(\d{2}\)\s*\d{4,5}-\d{4}$/, 'Telefone inválido. Use (XX) XXXXX-XXXX ou (XX) XXXX-XXXX').or(z.literal('')),
    personalEmail: z.string().trim().max(160).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'E-mail pessoal inválido').or(z.literal('')),
    birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').refine((d) => d <= new Date().toISOString().slice(0, 10) && d >= '1900-01-01', 'Data inválida').or(z.literal(''))
  }).strict(), req.body);
  const { rows } = await db.query(
    'UPDATE users SET phone = $1, personal_email = $2, birthday = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
    [body.phone || null, body.personalEmail || null, body.birthday || null, req.user.id]);
  await audit.log(req, { action: 'Dados pessoais atualizados', module: 'perfil', detail: 'Telefone, e-mail pessoal e/ou aniversário', targetUserId: req.user.id });
  res.json(profileOf(rows[0]));
}));

module.exports = router;
