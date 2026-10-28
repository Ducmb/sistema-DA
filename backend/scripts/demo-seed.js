/**
 * Dados de demonstração para ambiente de testes (ex.: Vercel). Roda no build quando DEMO_SEED=true.
 * - Só semeia banco vazio (nunca apaga dados).
 * - Exige DEMO_PASSWORD (12+ caracteres): todos os usuários de exemplo recebem essa senha,
 *   porque as senhas padrão do seed estão publicadas no README.
 */
require('dotenv').config({ quiet: true });
require('../src/env');
const { pool } = require('../src/db');
const { run } = require('../src/db/seed');
const pw = require('../src/services/passwords');

async function main() {
  if (process.env.DEMO_SEED !== 'true') return console.log('[demo-seed] DEMO_SEED não é "true": nada a fazer.');
  const senha = process.env.DEMO_PASSWORD || '';
  if (senha.length < 12) throw new Error('Defina DEMO_PASSWORD com 12+ caracteres para carregar os dados de demonstração.');
  const { rows } = await pool.query('SELECT COUNT(*)::int n FROM users');
  if (rows[0].n > 0) return console.log('[demo-seed] Banco já tem usuários: dados preservados.');
  await run(pool, { log: (m) => console.log('[demo-seed] ' + m) });
  await pool.query('UPDATE users SET password_hash = $1 WHERE password_hash <> $2', [await pw.hash(senha), pw.UNUSABLE]);
  console.log('[demo-seed] Usuários de exemplo com a senha de DEMO_PASSWORD.');
}

main().then(() => pool.end(), (e) => { console.error('[demo-seed] ' + e.message); pool.end(); process.exitCode = 1; });
