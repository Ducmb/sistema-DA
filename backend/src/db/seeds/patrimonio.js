/** Amostra de transferências de patrimônio (protótipo PatrimonioModule). */
async function seed(c, ctx) {
  const ids = ctx.users;
  const cc = async (nome) => (await c.query("SELECT id FROM cost_centers WHERE tipo = 'patrimonio' AND nome = $1", [nome])).rows[0]?.id || null;
  const T = [
    ['DA-PAT-00452', 'Notebook Dell Latitude 5420', 'Almoxarifado Central', 'Maria Clara Gomes', 'Almoxarifado Central', 'Diretoria Administrativa', '2026-07-10', 'Pendente'],
    ['DA-PAT-00318', 'Mesa de Reunião 8 Lugares', 'Carlos Mendes Oliveira', 'Sala de Sessões', 'Diretoria Administrativa', 'Sala de Sessões', '2026-07-02', 'Realizado'],
    ['DA-PAT-00501', 'Projetor Epson PowerLite', 'Protocolo', 'Patricia de Souza', 'Protocolo', null, '2026-06-28', 'Realizado'],
    ['DA-PAT-00287', 'Armário de Aço 4 Portas', 'RH', 'Almoxarifado Central', null, 'Almoxarifado Central', '2026-06-20', 'Recusado'],
    ['DA-PAT-00533', 'Cadeira Giratória Presidente', 'Almoxarifado Central', 'Recepção', 'Almoxarifado Central', 'Recepção', '2026-10-19', 'Verificar transferência']
  ];
  for (const [code, desc, from, to, fcc, tcc, data, st] of T) {
    await c.query(
      `INSERT INTO patrimonio_transferencias (code, description, from_user, to_user, to_user_id, from_cc_id, to_cc_id, data, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [code, desc, from, to, ids[to] || null, fcc && await cc(fcc), tcc && await cc(tcc), data, st, ids['Maria Clara Gomes'] || null]);
  }
  const dir = await cc('Diretoria Administrativa');
  if (dir) await c.query("INSERT INTO patrimonio_termos (cost_center_id, ym, emitido_em, emitido_por) VALUES ($1, '2026-07', '2026-07-05', $2) ON CONFLICT DO NOTHING", [dir, ids['Maria Clara Gomes'] || null]);
}

module.exports = { seed };
