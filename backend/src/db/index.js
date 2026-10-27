const { Pool, types } = require('pg');

// DATE como texto ISO (AAAA-MM-DD), sem conversão de fuso; NUMERIC como número.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: +process.env.DB_POOL_MAX || 10
});

pool.on('error', (err) => {
  console.error('[db] erro inesperado no pool:', err.message);
});

const query = (text, params) => pool.query(text, params);

/** Executa fn(client) em uma transação; desfaz tudo se fn lançar erro. */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, tx };
