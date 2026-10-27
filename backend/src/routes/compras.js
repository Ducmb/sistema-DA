const express = require('express');
const pool = require('../db/connection');
const { authenticateToken, authorizePermission, registerParamValidators } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
registerParamValidators(router);

/**
 * GET /api/compras/requests
 */
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pr.id, p.name as product_name, pr.quantity, pr.status, pr.due_date,
              u.name as requester, pr.total_value
       FROM purchase_requests pr
       JOIN products p ON pr.product_id = p.id
       LEFT JOIN users u ON pr.requested_by = u.id
       ORDER BY pr.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch purchase requests' });
  }
});

/**
 * POST /api/compras/requests
 */
router.post('/requests',
  authenticateToken,
  authorizePermission('create_purchase_request'),
  async (req, res) => {
    try {
      const { productId, quantity, dueDate, totalValue } = req.body;

      const result = await pool.query(
        `INSERT INTO purchase_requests (product_id, quantity, requested_by, due_date, total_value)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [productId, quantity, req.user.id, dueDate, totalValue]
      );

      await auditLog(req.user.id, 'purchase_request_created', 'compras', result.rows[0].id,
        { productId, quantity }, req);

      res.json(result.rows[0]);
    } catch (err) {
      await req.auditLogError(req.user.id, 'purchase_request_error', 'compras', err, req);
      res.status(500).json({ error: 'Failed to create purchase request' });
    }
  }
);

module.exports = router;
