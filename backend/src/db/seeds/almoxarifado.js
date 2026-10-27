/** Amostra do almoxarifado (planilha de consumo v2.0, protótipo estoque.js). */
const I = (code, name, unit, category, priority, stock, avg, verify) => ({ code, name, unit, category, priority, stock, avg, verify: !!verify });
const ITEMS = [
  I('1 50 05 0024 8', 'DESINFETANTE PARA USO PROFISSIONAL - 5L', 'GL', 'Higiene', 'Alta', 52, 10.308, true),
  I('1 50 05 0034 5', 'PAPEL HIGIÊNICO BRANCO, 30M, FOLHA DUPLA, PICOTADO', 'PCT', 'Higiene', 'Alta', 72, 8.273, true),
  I('1 50 02 0068 6', 'PASTA EM POLIONDA LARGA COM ELÁSTICO 245x335x55MM', 'UN', 'Papelaria', 'Baixa', 56, 3.0, true),
  I('1 50 02 0069 4', 'TESOURA ESCOLAR COM CABO DE PLÁSTICO', 'UN', 'Papelaria', 'Baixa', 23, 1.2, true),
  I('1 50 02 0054 6', 'CADERNO UNIVERSITÁRIO DE 01 MATÉRIA (80 FOLHAS)', 'UN', 'Papelaria', 'Alta', 11, 2.545),
  I('1 50 05 0088 4', 'ESSÊNCIA AROMATIZANTE 250ML LAVANDA', 'UN', 'Higiene', 'Alta', 12, 10.083),
  I('1 50 02 0030 9', 'CORRETIVO EM FITA', 'UN', 'Papelaria', 'Baixa', 10, 1.8),
  I('1 50 02 0031 7', 'BORRACHA BRANCA ESCOLAR', 'UN', 'Papelaria', 'Baixa', 7, 1.571),
  I('1 50 02 0034 1', 'CANETA MARCA TEXTO ROSA', 'UN', 'Papelaria', 'Baixa', 6, 1.333),
  I('1 50 05 0089 2', 'ESSÊNCIA AROMATIZANTE 250ML BAMBU', 'UN', 'Higiene', 'Alta', 11, 12.182),
  I('1 50 02 0018 0', 'PACOTE DE PAPEL A4 C/ 500 FOLHAS 75G', 'PCT', 'Papelaria', 'Alta', 20, 9.5, true)
];

async function seed(c, ctx) {
  const ids = {};
  for (const it of ITEMS) {
    const d = it.code.replace(/\D/g, '');
    const r = await c.query('INSERT INTO materiais (codigo, codigo_digitos, descricao, unidade, categoria, prioridade, saldo, consumo_medio, verificar) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [it.code, d, it.name, it.unit, it.category, it.priority, it.stock, it.avg, it.verify]);
    ids[d] = r.rows[0].id;
    await c.query("INSERT INTO estoque_movimentos (material_id, tipo, referencia, quantidade, saldo_apos, criado_em) VALUES ($1,'Saldo inicial','Implantação',$2,$2,'2026-09-30 08:00-03')", [r.rows[0].id, it.stock]);
  }
  // Documentos já computados no protótipo
  const docs = [
    ['RME', '1270/2026', '2026-10-01', '1270.pdf', 'Diretoria Administrativa', '1500500345', 4, -1],
    ['BRM', '610/2026', '2026-10-02', '610-2026 BRM.pdf', 'PAPELARIA CENTRAL LTDA', '1500200180', 20, 1]
  ];
  for (const [tipo, num, data, arq, origem, d, qtd, sign] of docs) {
    const r = await c.query("INSERT INTO estoque_documentos (tipo, numero, data_doc, arquivo, origem, fonte, processado_em) VALUES ($1,$2,$3,$4,$5,'seed','2026-10-05 07:00-03') RETURNING id", [tipo, num, data, arq, origem]);
    const m = await c.query('SELECT saldo FROM materiais WHERE id = $1', [ids[d]]);
    const antes = +m.rows[0].saldo, depois = antes + sign * qtd;
    await c.query('UPDATE materiais SET saldo = $1 WHERE id = $2', [depois, ids[d]]);
    await c.query('INSERT INTO estoque_doc_itens (documento_id, codigo_digitos, descricao, quantidade, unidade, material_id, aplicado, saldo_antes, saldo_depois) VALUES ($1,$2,(SELECT descricao FROM materiais WHERE id=$3),$4,(SELECT unidade FROM materiais WHERE id=$3),$3,TRUE,$5,$6)', [r.rows[0].id, d, ids[d], qtd, antes, depois]);
    await c.query("INSERT INTO estoque_movimentos (material_id, documento_id, tipo, referencia, quantidade, saldo_apos, criado_em) VALUES ($1,$2,$3,$4,$5,$6,'2026-10-05 07:00-03')", [ids[d], r.rows[0].id, tipo, tipo + ' ' + num, sign * qtd, depois]);
  }
  const team = ['Ana Beatriz Silva', 'João Pedro Costa'].map((n) => ({ userId: ctx.users[n], active: true }));
  await c.query("INSERT INTO almox_params (id, equipe, atualizado_por, atualizado_em) VALUES (1, $1, $2, '2026-07-17 08:30-03')", [JSON.stringify(team), ctx.users['Dr. Roberto Alencar']]);
}

module.exports = { seed };
