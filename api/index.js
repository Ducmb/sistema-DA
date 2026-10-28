/**
 * Função serverless da Vercel: a mesma aplicação Express do back-end, servida em /api.
 * (As rotinas agendadas do node-cron não rodam na Vercel — ver VERCEL.md.)
 */
const { envError } = require('../backend/src/env');

const err = envError();
module.exports = err
  ? (req, res) => { console.error('[vercel] ' + err); res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Servidor sem configuração. Defina as variáveis de ambiente na Vercel.' })); }
  : require('../backend/src/app');
