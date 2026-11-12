/** Chaves de exemplo (locais da Câmara). Empréstimos exigem assinatura real e não são semeados. */
async function seed(c) {
  const K = [
    ['CH-001', 'Sala de Sessões', 'Porta principal'], ['CH-002', 'Plenário', 'Acesso lateral'], ['CH-003', 'Almoxarifado Central', 'Depósito'],
    ['CH-004', 'Arquivo Geral', 'Arquivo morto'], ['CH-005', 'Sala de Reuniões', '2º andar'], ['CH-006', 'Auditório', 'Porta dupla'],
    ['CH-007', 'Garagem', 'Portão eletrônico — controle e chave'], ['CH-008', 'Sala de Imprensa', '']
  ];
  for (const [codigo, local, descricao] of K) await c.query('INSERT INTO chaves (codigo, local, descricao) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [codigo, local, descricao]);
}
module.exports = { seed };
