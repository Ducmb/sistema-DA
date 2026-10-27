require('dotenv').config({ quiet: true });

const SECRET = process.env.JWT_SECRET || '';
if (SECRET.length < 32 || /change|secret|example|password|exemplo|senha/i.test(SECRET)) {
  console.error('FATAL: JWT_SECRET ausente ou fraco. Use ao menos 32 caracteres aleatórios (ex.: openssl rand -hex 32).');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL não definido.');
  process.exit(1);
}

const app = require('./app');
const db = require('./db');
const jobs = require('./jobs');

const PORT = +process.env.PORT || 3000;

db.query('SELECT 1')
  .then(() => {
    app.listen(PORT, () => console.log(`Sistema DA — API na porta ${PORT}`));
    if (process.env.NODE_ENV !== 'test') jobs.schedule();
  })
  .catch((e) => {
    console.error('FATAL: não foi possível conectar ao banco:', e.message);
    process.exit(1);
  });
