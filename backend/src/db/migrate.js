require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try { await pool.query(sql); console.log('Schema aplicado.'); }
  catch (e) { console.error('Falha ao aplicar schema:', e.message); process.exitCode = 1; }
  finally { await pool.end(); }
})();
