/** Amostra de Moções & Homenagens (protótipos MocoesHomenagens, HomenagensArranjos e HomenagensBandeiras). */
const data = require('./data/liccont.json');

async function seed(c, ctx) {
  const by = ctx.users['Dr. Roberto Alencar'] || null;
  const ver = async (nome) => (await c.query('INSERT INTO vereadores (nome) VALUES ($1) ON CONFLICT (lower(nome)) DO UPDATE SET ativo = TRUE RETURNING id', [nome])).rows[0].id;
  const M = [
    [40, 'Aplauso', 'Moção de Aplauso - Req. 274/2026', 'Márcio Teixeira', '2026-07-10', '2026-07-14', 'Aprovada'],
    [39, 'Pesar', 'Moção de Pesar - Servidor Público', 'Helena Duarte', '2026-07-08', '2026-07-14', 'Aprovada'],
    [38, 'Congratulação', 'Moção de Congratulação - Escola Municipal', 'Beatriz Lopes', '2026-07-05', '2026-10-27', 'Em Análise'],
    [37, 'Apoio', 'Moção de Apoio - Campanha de Saúde', 'Fernando Souza', '2026-07-01', '2026-07-07', 'Aprovada'],
    [36, 'Repúdio', 'Moção de Repúdio - Ato de Vandalismo', 'Márcio Teixeira', '2026-06-28', '2026-06-30', 'Arquivada']
  ];
  for (const [n, t, a, v, d, s, st] of M) await c.query('INSERT INTO mocoes (numero, ano, tipo, assunto, vereador_id, data, sessao, status, created_by) VALUES ($1,2026,$2,$3,$4,$5,$6,$7,$8)', [n, t, a, await ver(v), d, s, st, by]);
  const G = [['Maria das Graças Ferreira', 'Beatriz Lopes', 'Q-014'], ['José Antônio Ribeiro', 'Helena Duarte', 'Q-015'], ['Comunidade do Bairro Vila Nova', 'Márcio Teixeira', 'Q-016']];
  for (const [h, v, q] of G) await c.query("INSERT INTO homenageados (homenageado, vereador_id, legislatura, quadro, created_by) VALUES ($1,$2,'2025-2028',$3,$4)", [h, await ver(v), q, by]);
  for (const h of data.homenagens) {
    await c.query('INSERT INTO homenagens_entregas (homenageado, honraria, vereador_id, material, processo, decreto, data, horario, status, obs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [h.homenageado, h.honraria, await ver(h.vereador), h.material, h.processo === '-' ? '' : h.processo, h.decreto, h.data, h.data ? h.horario : '', h.status, h.obs]);
  }
  const ALL = ['bauru', 'sp', 'brasil', 'mastros', 'suporte'];
  const B = [
    ['2026-05-25', 'Igreja ADBrasBauru Cong-Tangarás', '45030566000102', '(14) 99143-3817', '1633/2026', ALL, true, '2026-08-14', '2026-08-18', 'Sim'],
    ['2026-09-03', 'Agro Sem Limites 2026', '', '', '2882/2026', ALL, true, '2026-09-03', '2026-09-08', 'Sim'],
    ['2026-10-16', 'Assembleia de Deus Ministério Santo Fogo', '79873340815', '(14) 98804-5019', '2627/2026', ['bauru', 'mastros', 'suporte'], true, '2026-10-16', '2026-10-19', 'Sim'],
    ['2026-10-20', 'Escola Estadual Prof. Ayrton Busch', '', '(14) 3234-5678', '3012/2026', ['brasil', 'mastros'], true, '2026-10-26', '2026-10-28', '']
  ];
  for (const b of B) await c.query('INSERT INTO bandeiras_emprestimos (solicitacao, entidade, documento, telefone, protocolo, itens, retirado, retirada, devolucao, conformidade, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [...b, by]);
}

module.exports = { seed };
