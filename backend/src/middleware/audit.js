const { v4: uuidv4 } = require('uuid');
const pool = require('../db/connection');

/**
 * Log audit entry for user actions
 */
const auditLog = async (userId, action, resourceType, resourceId, changes = null, req = null) => {
  try {
    const requestId = req?.id || uuidv4();
    const ipAddress = req?.ip || null;
    const userAgent = req?.get('User-Agent') || null;

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes, ip_address, user_agent, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, action, resourceType, resourceId, JSON.stringify(changes), ipAddress, userAgent, requestId]
    );
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
};

/**
 * Log audit entry on error
 */
const auditLogError = async (userId, action, resourceType, error, req = null) => {
  try {
    const requestId = req?.id || uuidv4();
    const ipAddress = req?.ip || null;
    const userAgent = req?.get('User-Agent') || null;

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, status, error_message, ip_address, user_agent, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, action, resourceType, 'failed', error.message, ipAddress, userAgent, requestId]
    );
  } catch (err) {
    console.error('Audit error logging failed:', err);
  }
};

/**
 * Middleware to attach unique request ID and audit context
 */
const auditMiddleware = (req, res, next) => {
  req.id = uuidv4();
  req.auditLog = auditLog;
  req.auditLogError = auditLogError;
  next();
};

module.exports = {
  auditLog,
  auditLogError,
  auditMiddleware
};
