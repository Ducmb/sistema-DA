const jwt = require('jsonwebtoken');
const pool = require('../db/connection');

/**
 * Verify JWT token and attach user to request
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, async (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    try {
      // token_version permite revogar todas as sessões (troca/redefinição de senha)
      const r = await pool.query('SELECT token_version, status FROM users WHERE id = $1', [user.id]);
      if (!r.rows.length || r.rows[0].status !== 'active' || (r.rows[0].token_version || 0) !== (user.tv || 0)) {
        return res.status(401).json({ error: 'Session revoked' });
      }
      req.user = user;
      next();
    } catch (e) {
      res.status(500).json({ error: 'Authentication failed' });
    }
  });
};

/**
 * Check if user has required role
 */
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

/**
 * Check if user has required permission
 */
const authorizePermission = (permissionName) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
      const result = await pool.query(
        `SELECT rp.permission_id FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.id
         WHERE rp.role_id = (SELECT role_id FROM users WHERE id = $1)
         AND p.name = $2`,
        [req.user.id, permissionName]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      next();
    } catch (err) {
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

/**
 * Allow only the user referenced by req.params[param] or an admin
 */
const requireSelfOrAdmin = (param) => (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || String(req.user.id) === String(req.params[param]))) return next();
  return res.status(403).json({ error: 'Forbidden' });
};

/**
 * Router-level validators for numeric route params
 */
const ID_RE = /^[1-9]\d{0,9}$/;
const registerParamValidators = (router) => {
  ['id', 'userId', 'roleId', 'logId', 'permissionId'].forEach((p) =>
    router.param(p, (req, res, next, v) => (ID_RE.test(v) ? next() : res.status(400).json({ error: 'Invalid parameter: ' + p }))));
  router.param('month', (req, res, next, v) => (/^(0?[1-9]|1[0-2])$/.test(v) ? next() : res.status(400).json({ error: 'Invalid month' })));
  router.param('year', (req, res, next, v) => (/^20\d{2}$/.test(v) ? next() : res.status(400).json({ error: 'Invalid year' })));
};

module.exports = {
  requireSelfOrAdmin,
  registerParamValidators,
  authenticateToken,
  authorizeRole,
  authorizePermission
};
