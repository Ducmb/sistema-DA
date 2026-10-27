const express = require('express');
const pool = require('../db/connection');
const { authenticateToken, authorizeRole, registerParamValidators } = require('../middleware/auth');

const router = express.Router();
registerParamValidators(router);

/**
 * GET /api/audit/logs
 * Retrieve audit logs (admin/auditor only)
 */
router.get('/logs', authenticateToken, authorizeRole('admin', 'auditor'), async (req, res) => {
  try {
    const { userId, resourceType, action, startDate, endDate, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT al.id, al.user_id, u.username, al.action, al.resource_type, al.resource_id,
             al.ip_address, al.user_agent, al.status, al.created_at, al.request_id
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (userId) {
      query += ` AND al.user_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (resourceType) {
      query += ` AND al.resource_type = $${paramCount}`;
      params.push(resourceType);
      paramCount++;
    }

    if (action) {
      query += ` AND al.action = $${paramCount}`;
      params.push(action);
      paramCount++;
    }

    if (startDate) {
      query += ` AND al.created_at >= $${paramCount}::timestamp`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND al.created_at <= $${paramCount}::timestamp`;
      params.push(endDate);
      paramCount++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM audit_logs');

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * GET /api/audit/logs/:logId
 * Get detailed audit log entry
 */
router.get('/logs/:logId', authenticateToken, authorizeRole('admin', 'auditor'), async (req, res) => {
  try {
    const { logId } = req.params;
    const result = await pool.query(
      `SELECT al.*, u.username FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.id = $1`,
      [logId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

/**
 * GET /api/audit/summary
 * Get audit activity summary
 */
router.get('/summary', authenticateToken, authorizeRole('admin', 'auditor'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_actions,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7d
      FROM audit_logs
    `);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit summary' });
  }
});

module.exports = router;
