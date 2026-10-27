/** Recria o banco de testes do zero e aplica as migrações + dados de exemplo. */
module.exports = async () => {
  require('./env');
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  const { migrate } = require('../src/db/migrate');
  await migrate(pool, { log: () => {} });
  const { run } = require('../src/db/seed');
  await run(pool, { log: () => {} });
  await pool.end();
};
