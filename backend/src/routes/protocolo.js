const express = require('express');
const pool = require('../db/connection');
const { authenticateToken, registerParamValidators } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
registerParamValidators(router);

/**
 * GET /api/protocolo/motions
 */
router.get('/motions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, number, title, status, author, submission_date, deadline
       FROM motions
       ORDER BY submission_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch motions' });
  }
});

/**
 * GET /api/protocolo/honorificences
 */
router.get('/honorificences', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, number, title, recipient, status, approval_date
       FROM honorificences
       ORDER BY approval_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch honorificences' });
  }
});

module.exports = router;
