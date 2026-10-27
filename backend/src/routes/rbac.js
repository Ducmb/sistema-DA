const express = require('express');
const pool = require('../db/connection');
const { authenticateToken, authorizeRole, authorizePermission, registerParamValidators, requireSelfOrAdmin } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
registerParamValidators(router);

/**
 * GET /api/rbac/roles
 * List all roles
 */
router.get('/roles', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.name, r.description, COUNT(u.id) as user_count
       FROM roles r
       LEFT JOIN users u ON r.id = u.role_id
       GROUP BY r.id
       ORDER BY r.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

/**
 * GET /api/rbac/permissions
 * List all permissions
 */
router.get('/permissions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, module FROM permissions ORDER BY module, name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

/**
 * GET /api/rbac/roles/:roleId/permissions
 * Get permissions for a role
 */
router.get('/roles/:roleId/permissions', authenticateToken, async (req, res) => {
  try {
    const { roleId } = req.params;
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.module
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.module, p.name`,
      [roleId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch role permissions' });
  }
});

/**
 * PUT /api/rbac/roles/:roleId/permissions/:permissionId
 * Assign/revoke permission from role (admin only)
 */
router.put('/roles/:roleId/permissions/:permissionId', 
  authenticateToken,
  authorizeRole('admin'),
  async (req, res) => {
    try {
      const { roleId, permissionId } = req.params;
      const { grant } = req.body; // true to grant, false to revoke

      if (grant) {
        await pool.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [roleId, permissionId]
        );
        await auditLog(req.user.id, 'permission_granted', 'rbac', roleId, 
          { roleId, permissionId }, req);
      } else {
        await pool.query(
          'DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
          [roleId, permissionId]
        );
        await auditLog(req.user.id, 'permission_revoked', 'rbac', roleId,
          { roleId, permissionId }, req);
      }

      res.json({ success: true });
    } catch (err) {
      await req.auditLogError(req.user.id, 'permission_update_error', 'rbac', err, req);
      res.status(500).json({ error: 'Failed to update permission' });
    }
  }
);

/**
 * POST /api/rbac/users/:userId/role
 * Assign role to user (admin only)
 */
router.post('/users/:userId/role',
  authenticateToken,
  authorizeRole('admin'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { roleId } = req.body;

      const result = await pool.query(
        'UPDATE users SET role_id = $1 WHERE id = $2 RETURNING id, username, role_id',
        [roleId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      await auditLog(req.user.id, 'role_assigned', 'users', userId,
        { userId, roleId }, req);

      res.json({ success: true, user: result.rows[0] });
    } catch (err) {
      await req.auditLogError(req.user.id, 'role_assignment_error', 'users', err, req);
      res.status(500).json({ error: 'Failed to assign role' });
    }
  }
);

/**
 * GET /api/rbac/user-permissions/:userId
 * Get all effective permissions for a user
 */
router.get('/user-permissions/:userId', authenticateToken, requireSelfOrAdmin('userId'), async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT DISTINCT p.id, p.name, p.module
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN roles r ON rp.role_id = r.id
       JOIN users u ON u.role_id = r.id
       WHERE u.id = $1
       ORDER BY p.module, p.name`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user permissions' });
  }
});

module.exports = router;
