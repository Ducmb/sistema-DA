/** Normas de exemplo (protótipo Legislacoes). */
async function seed(c, ctx) {
  const by = ctx.users['Dr. Roberto Alencar'] || null;
  const N = [
    ['Base legal', 'Lei nº 14.133/2021', 'Lei de Licitações e Contratos Administrativos.', 'União', '2021-04-01', 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm', 'licitação, contratos, dispensa', true],
    ['Decreto', 'Decreto nº 12.807/2025', 'Atualiza os valores dos limites de dispensa da Lei nº 14.133/2021, vigentes a partir de 01/01/2026.', 'União', '2025-12-30', '', 'limites, dispensa, art. 75', true],
    ['Decreto', 'Decreto nº 12.343/2024', 'Valores de limites de dispensa vigentes em 2025 — substituído pelo Decreto nº 12.807/2025.', 'União', '2024-12-30', '', 'limites, histórico', false],
    ['Base legal', 'Lei nº 13.709/2018 (LGPD)', 'Lei Geral de Proteção de Dados Pessoais.', 'União', '2018-08-14', 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm', 'privacidade, dados pessoais', true],
    ['Portaria', 'Portaria DA nº 01/2026', 'Regulamenta o controle de moções na Câmara Municipal.', 'Diretoria Administrativa', '2026-01-05', '', 'moções', true],
    ['Portaria', 'Portaria DA nº 03/2023', 'Regras e cotas para homenagens e galeria de homenageados.', 'Diretoria Administrativa', '2023-03-10', '', 'homenagens, cotas', true]
  ];
  for (const n of N) await c.query('INSERT INTO normas (tipo, numero, ementa, orgao, data, link, tags, ativa, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [...n, by]);
}

module.exports = { seed };
