const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db/connection');
const { auditLog } = require('../middleware/audit');
const { authenticateToken, registerParamValidators } = require('../middleware/auth');
const crypto = require('crypto');
const { sendResetEmail } = require('../services/mailer');

// Strong password: 8+ chars, upper, lower, digit, symbol
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const signToken = (u) => jwt.sign({ id: u.id, username: u.username, role: u.role, tv: u.token_version || 0 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRY || '8h' });

const router = express.Router();
registerParamValidators(router);

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', [
  body('username').notEmpty().withMessage('Username required'),
  body('password').notEmpty().withMessage('Password required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.password_hash, u.name, u.email, u.status, u.token_version, r.name as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      await auditLog(null, 'login_failed', 'auth', null, { username }, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcryptjs.compare(password, user.password_hash);

    if (!passwordMatch || user.status !== 'active') {
      await auditLog(user.id, 'login_failed', 'auth', user.id, { username }, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);

    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    await auditLog(user.id, 'login_success', 'auth', user.id, { username }, req);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (err) {
    await auditLog(null, 'login_error', 'auth', null, { error: err.message }, req);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.name, u.email, r.name as role, u.department
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * POST /api/auth/logout
 * Logout (token invalidation handled client-side)
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await auditLog(req.user.id, 'logout', 'auth', req.user.id, {}, req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * POST /api/auth/forgot-password  (RF03)
 * Always returns the same response to avoid revealing which e-mails exist.
 */
router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], async (req, res) => {
  const generic = { success: true, message: 'Se o e-mail constar na base, um link de redefinição foi enviado.' };
  if (!validationResult(req).isEmpty()) return res.json(generic);
  try {
    const r = await pool.query("SELECT id FROM users WHERE email = $1 AND status = 'active'", [req.body.email]);
    if (r.rows.length) {
      const userId = r.rows[0].id;
      const raw = crypto.randomBytes(32).toString('hex');
      await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);
      await pool.query("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 minutes')", [userId, sha256(raw)]);
      await sendResetEmail(req.body.email, (process.env.APP_URL || '') + '/redefinir-senha?token=' + raw);
      await auditLog(userId, 'password_reset_requested', 'auth', userId, {}, req);
    }
    res.json(generic);
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
});

/**
 * POST /api/auth/reset-password
 * Single-use token, 30 min validity; revokes every active session.
 */
router.post('/reset-password', [
  body('token').isHexadecimal().isLength({ min: 64, max: 64 }),
  body('password').matches(STRONG_PASSWORD)
], async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ error: 'Link inválido ou senha fora da regra (mín. 8 caracteres, maiúscula, minúscula, número e símbolo).' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query('SELECT id, user_id FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW() FOR UPDATE', [sha256(req.body.token)]);
    if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Link inválido ou expirado' }); }
    const hash = await bcryptjs.hash(req.body.password, 12);
    await client.query('UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW() WHERE id = $2', [hash, r.rows[0].user_id]);
    await client.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [r.rows[0].id]);
    await client.query('COMMIT');
    await auditLog(r.rows[0].user_id, 'password_reset', 'auth', r.rows[0].user_id, {}, req);
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Reset failed' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/auth/password  ("Meus Dados")
 * Requires current password; ends all other sessions and returns a fresh token.
 */
router.put('/password', authenticateToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').matches(STRONG_PASSWORD)
], async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ error: 'Senha fora da regra (mín. 8 caracteres, maiúscula, minúscula, número e símbolo).' });
  try {
    const r = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!r.rows.length || !(await bcryptjs.compare(req.body.currentPassword, r.rows[0].password_hash))) {
      await auditLog(req.user.id, 'password_change_failed', 'auth', req.user.id, {}, req);
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    if (await bcryptjs.compare(req.body.newPassword, r.rows[0].password_hash)) return res.status(400).json({ error: 'A nova senha deve ser diferente da atual' });
    const hash = await bcryptjs.hash(req.body.newPassword, 12);
    const u = await pool.query('UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW() WHERE id = $2 RETURNING id, username, token_version', [hash, req.user.id]);
    await auditLog(req.user.id, 'password_changed', 'auth', req.user.id, {}, req);
    res.json({ success: true, token: signToken({ ...u.rows[0], role: req.user.role }) });
  } catch (err) {
    res.status(500).json({ error: 'Password change failed' });
  }
});

module.exports = router;
