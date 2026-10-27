const express = require('express');
const pool = require('../db/connection');
const { authenticateToken, authorizePermission, registerParamValidators } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
registerParamValidators(router);

/**
 * GET /api/rh/employees
 */
router.get('/employees', authenticateToken, authorizePermission('view_employees'), async (req, res) => {
  try {
    await auditLog(req.user.id, 'personal_data_read', 'rh', null, { resource: 'employees', query: req.query }, req);
    const result = await pool.query(
      `SELECT e.id, u.name, e.registration_number, e.position, e.department,
              u.status, e.hire_date
       FROM employees e
       JOIN users u ON e.user_id = u.id
       ORDER BY u.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

/**
 * GET /api/rh/payroll/:month/:year
 */
router.get('/payroll/:month/:year', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.params;
    const result = await pool.query(
      `SELECT p.id, e.id as employee_id, u.name, e.position, p.base_salary,
              p.discounts, p.net_salary, p.status
       FROM payroll p
       JOIN employees e ON p.employee_id = e.id
       JOIN users u ON e.user_id = u.id
       WHERE p.month = $1 AND p.year = $2
       ORDER BY u.name`,
      [month, year]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payroll' });
  }
});

/**
 * POST /api/rh/vacation-requests
 */
router.post('/vacation-requests',
  authenticateToken,
  async (req, res) => {
    try {
      const { employeeId, type, startDate, endDate } = req.body;

      const result = await pool.query(
        `INSERT INTO vacation_requests (employee_id, type, start_date, end_date)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [employeeId, type, startDate, endDate]
      );

      await auditLog(req.user.id, 'vacation_request_created', 'rh', result.rows[0].id,
        { employeeId, type }, req);

      res.json(result.rows[0]);
    } catch (err) {
      await req.auditLogError(req.user.id, 'vacation_request_error', 'rh', err, req);
      res.status(500).json({ error: 'Failed to create vacation request' });
    }
  }
);

module.exports = router;
