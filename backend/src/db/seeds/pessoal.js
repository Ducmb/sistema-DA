/** Amostra de Gestão de Pessoal (protótipo RHModule). */
const pw = require('../../services/passwords');

async function seed(c, ctx) {
  const ids = ctx.users;
  const r = await c.query(
    `INSERT INTO users (username, email, name, registration, position, department, situacao, status, password_hash)
     VALUES ('mat-2019001', NULL, 'Ana Silva Santos', '2019-001', 'Assessor Administrativo', 'Serviço de Licitações e Contratos', 'Ativo', 'inactive', $1)
     ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [pw.UNUSABLE]);
  ids['Ana Silva Santos'] = r.rows[0].id;
  await c.query("UPDATE users SET situacao = 'Afastado' WHERE name = 'Maria Clara Gomes'");
  const A = [
    ['Ana Silva Santos', 'Férias', '2026-09-14', '2026-09-28', 'Aprovado'],
    ['Carlos Mendes Oliveira', 'Licença Médica', '2026-09-21', '2026-09-28', 'Pendente'],
    ['João Pedro Costa', 'Férias', '2026-10-01', '2026-10-15', 'Aprovado'],
    ['Patricia de Souza', 'Licença Paternidade', '2026-10-05', '2026-10-19', 'Recusado'],
    ['Maria Clara Gomes', 'Férias', '2026-11-12', '2026-11-26', 'Pendente']
  ];
  for (const [n, tipo, ini, fim, st] of A) {
    await c.query(
      `INSERT INTO rh_ausencias (user_id, tipo, inicio, fim, status, solicitado_por, solicitado_em, decidido_por, decidido_em)
       VALUES ($1,$2,$3::date,$4,$5::varchar,$6, $3::date - 40, $7, CASE WHEN $5::varchar = 'Pendente' THEN NULL ELSE $3::date - 30 END)`,
      [ids[n], tipo, ini, fim, st, ids['Dr. Roberto Alencar'], st === 'Pendente' ? null : ids['Dr. Roberto Alencar']]);
  }
}

module.exports = { seed };
