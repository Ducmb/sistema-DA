const express = require('express');
const pool = require('../db/connection');
const { authenticateToken, authorizePermission, registerParamValidators } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
registerParamValidators(router);

/**
 * GET /api/inventory/products
 */
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.sku, p.category, p.unit, p.stock_quantity,
              p.min_stock, p.max_stock, p.unit_price, s.name as supplier
       FROM products p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.status = 'active'
       ORDER BY p.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * POST /api/inventory/products/:productId/transaction
 */
router.post('/products/:productId/transaction',
  authenticateToken,
  authorizePermission('manage_inventory'),
  async (req, res) => {
    try {
      const { productId } = req.params;
      const { action, quantity, notes } = req.body;

      const transaction = await pool.query(
        `INSERT INTO inventory_transactions (product_id, action, quantity, notes, user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [productId, action, quantity, notes, req.user.id]
      );

      await auditLog(req.user.id, 'inventory_transaction', 'inventory', productId,
        { action, quantity }, req);

      res.json(transaction.rows[0]);
    } catch (err) {
      await req.auditLogError(req.user.id, 'inventory_transaction_error', 'inventory', err, req);
      res.status(500).json({ error: 'Failed to record transaction' });
    }
  }
);

module.exports = router;
