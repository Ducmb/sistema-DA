require('dotenv').config();
const SECRET = process.env.JWT_SECRET || '';
if (SECRET.length < 32 || /change|secret|example|password/i.test(SECRET)) {
  console.error('FATAL: JWT_SECRET ausente ou fraco. Use ao menos 32 caracteres aleatórios (ex.: openssl rand -hex 32).');
  process.exit(1);
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const pool = require('./db/connection');

const app = express();
const PORT = process.env.PORT || 3000;

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  credentials: true
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
const authRouter = require('./routes/auth');
const inventoryRouter = require('./routes/inventory');
const comprasRouter = require('./routes/compras');
const rhRouter = require('./routes/rh');
const protocoloRouter = require('./routes/protocolo');
const rbacRouter = require('./routes/rbac');
const auditRouter = require('./routes/audit');

app.use('/api/auth', authRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/compras', comprasRouter);
app.use('/api/rh', rhRouter);
app.use('/api/protocolo', protocoloRouter);
app.use('/api/rbac', rbacRouter);
app.use('/api/audit', auditRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({
    error: status < 500 && err.expose ? err.message : (status === 413 ? 'Payload too large' : status < 500 ? 'Bad Request' : 'Internal Server Error'),
    requestId: req.id
  });
});

// Database connection test
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    logger.error('Database connection failed:', err);
  } else {
    logger.info('Database connected');
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = app;
