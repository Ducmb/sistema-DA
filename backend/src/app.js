/**
 * Monta a aplicação Express (sem abrir porta) — usada pelo servidor e pelos testes.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { authenticate, requireModule, requireAdmin } = require('./middleware/auth');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);

app.use(helmet());
const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(cors({ origin: origins, credentials: false }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const api = express.Router();
api.use('/auth', require('./routes/auth'));

// Daqui em diante tudo exige sessão válida
api.use(authenticate);
api.use('/profile', requireModule('perfil'), require('./routes/profile'));
api.use('/users', require('./routes/users'));
api.use('/audit', requireModule('auditoria'), require('./routes/audit'));
api.use('/config', requireAdmin, require('./routes/config'));
api.use('/', require('./routes/cadastros'));
require('./routes/modules').mount(api);

app.use('/api', api);

app.use((req, res) => res.status(404).json({ error: 'Recurso não encontrado.' }));

// Erros: 4xx com mensagem segura; 5xx sem detalhes internos
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Conteúdo muito grande.' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Arquivo muito grande.' });
  if (err.name === 'MulterError') return res.status(400).json({ error: err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Arquivos demais nesta remessa.' : 'Envio de arquivo inválido.' });
  if (err.expose && err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
  console.error('[erro]', req.method, req.originalUrl, err);
  res.status(500).json({ error: 'Erro interno. Tente novamente.' });
});

module.exports = app;
