require('dotenv').config({ quiet: true });

const err = require('./env').envError();
if (err) {
  console.error('FATAL: ' + err);
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
