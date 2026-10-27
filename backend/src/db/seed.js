/**
 * Carrega dados de exemplo (amostras do protótipo). Recusa rodar em produção.
 * Uso: npm run seed            (banco vazio)
 *      npm run seed -- --reset (apaga dados e recria — CUIDADO)
 */
if (require.main === module) require('dotenv').config({ quiet: true });
const SEEDS = ['core', 'pessoal', 'compras', 'almoxarifado'].map((n) => require('./seeds/' + n));

async function run(pool, { reset = false, log = console.log } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (reset) {
      const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'");
      if (rows.length) await client.query('TRUNCATE ' + rows.map((r) => '"' + r.tablename + '"').join(', ') + ' RESTART IDENTITY CASCADE');
    }
    const ctx = {};
    for (const s of SEEDS) Object.assign(ctx, (await s.seed(client, ctx)) || {});
    await client.query('COMMIT');
    log('Dados de exemplo carregados.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { run, SEEDS };

if (require.main === module) {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seed de exemplo bloqueado em produção.');
    process.exit(1);
  }
  const { pool } = require('./index');
  run(pool, { reset: process.argv.includes('--reset') })
    .catch((e) => { console.error('Falha no seed:', e.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
