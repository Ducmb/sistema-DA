/**
 * Aplica, em ordem, os arquivos de src/db/migrations ainda não registrados em schema_migrations.
 * Cada arquivo roda em uma transação.
 */
const fs = require('fs');
const path = require('path');

async function migrate(pool, { log = console.log } = {}) {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      log('Migração aplicada: ' + f);
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error('Falha em ' + f + ': ' + e.message);
    } finally {
      client.release();
    }
  }
}

module.exports = { migrate };

if (require.main === module) {
  require('dotenv').config({ quiet: true });
  const { pool } = require('./index');
  migrate(pool)
    .then(() => console.log('Banco atualizado.'))
    .catch((e) => { console.error(e.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
