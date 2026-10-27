/** Amostra da planilha CONTROLE GERAL LICCONT (≈10 registros por aba) + fornecedores e catálogo do protótipo. */
const data = require('./data/liccont.json');

const FORNECEDORES = [
  ['Papéis e Cia', '12.345.678/0001-90', '(85) 3256-1234', 'cotacao@papeisecia.com.br', ['Suprimentos de Escritório'], true, 2018],
  ['Tech Solutions Ltda', '98.765.432/0001-21', '(85) 98765-4321', 'comercial@techsolutions.com.br', ['Tecnologia', 'Suprimentos de Escritório'], true, 2020],
  ['Limpeza Express', '11.222.333/0001-44', '(85) 3333-5555', 'vendas@limpezaexpress.com.br', ['Serviços de Limpeza'], true, 2019],
  ['Segurança Premium', '55.666.777/0001-88', '(85) 3456-7890', 'contato@segurancapremium.com.br', ['Segurança e Vigilância'], true, 2021],
  ['Software Enterprise', '99.888.777/0001-55', '(85) 98888-9999', 'licitacoes@softwareenterprise.com.br', ['Tecnologia'], true, 2017],
  ['Logística Rápida', '44.333.222/0001-11', '(85) 3111-2222', 'orcamento@logisticarapida.com.br', ['Transportes e Logística'], false, 2019]
];

const CATALOGO = [
  ['CATMAT', '461905', 'Papel A4 75g/m² — resma 500 fl', ['75', 'Utensílios e suprimentos de escritório'], ['7530', 'Artigos de papelaria'], ['04721', 'Papel A4']],
  ['CATMAT', '279383', 'Caneta esferográfica azul', ['75', 'Utensílios e suprimentos de escritório'], ['7510', 'Artigos de escritório'], ['01482', 'Caneta esferográfica']],
  ['CATMAT', '317025', 'Pasta polionda com elástico', ['75', 'Utensílios e suprimentos de escritório'], ['7510', 'Artigos de escritório'], ['05530', 'Pasta arquivo']],
  ['CATMAT', '445381', 'Desinfetante hospitalar 5 L', ['79', 'Equipamentos e materiais para limpeza'], ['7930', 'Produtos de limpeza e polimento'], ['06287', 'Desinfetante']],
  ['CATMAT', '350713', 'Papel higiênico folha dupla', ['85', 'Artigos de higiene'], ['8540', 'Artigos de papel para higiene'], ['02870', 'Papel higiênico']],
  ['CATMAT', '484411', 'Toner para impressora laser', ['70', 'Equipamentos de TI, software e acessórios'], ['7045', 'Suprimentos de TI'], ['08902', 'Toner']],
  ['CATMAT', '245803', 'Biscoito tipo rosquinha', ['89', 'Subsistência'], ['8920', 'Produtos de panificação e cereais'], ['10011', 'Biscoito']],
  ['CATSER', '5380', 'Manutenção predial preventiva e corretiva', ['542', 'Serviços de engenharia'], ['5421', 'Manutenção de edificações'], ['5380', 'Manutenção predial']],
  ['CATSER', '3115', 'Serviço de chaveiro', ['871', 'Serviços de manutenção e reparo'], ['8712', 'Reparos em instalações'], ['3115', 'Chaveiro']],
  ['CATSER', '26077', 'Suporte técnico de TI', ['871', 'Serviços de manutenção e reparo'], ['8716', 'Manutenção de equipamentos de TI'], ['26077', 'Suporte de TI']]
];

async function seed(c, ctx) {
  const uid = ctx.users;
  for (const p of data.processes) {
    const r = await c.query('INSERT INTO compras_processos (interno, externo, objeto, modo, setor, valor, agente_id, criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [p.interno, p.externo, p.objeto, p.modo, p.setor, p.valor, uid[p.agente] || null, uid['Carlos Mendes Oliveira']]);
    for (let i = 0; i < 24; i++) {
      const s = p.stages[i] || { s: 'pend' };
      await c.query('INSERT INTO compras_etapas (processo_id, idx, status, since, data, justificativa, nota, por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [r.rows[0].id, i, s.s, s.since || null, s.date || null, s.just || null, s.note || null, s.date ? uid[p.agente] || null : null]);
    }
  }
  const fids = {};
  for (const [nome, cnpj, tel, email, segs, ativo, desde] of FORNECEDORES) {
    const r = await c.query('INSERT INTO fornecedores (nome, cnpj, telefone, email, segmentos, ativo, desde) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [nome, cnpj, tel, email, segs, ativo, desde]);
    const id = r.rows[0].id; fids[nome] = id;
    await c.query("INSERT INTO fornecedor_eventos (fornecedor_id, data, tipo, titulo, detalhe) VALUES ($1,$2,'cadastro','Cadastro homologado','Documentação de habilitação aprovada (SICAF regular)')", [id, desde + '-02-15']);
    await c.query("INSERT INTO fornecedor_eventos (fornecedor_id, data, tipo, titulo, detalhe) VALUES ($1,'2025-05-10','cotacao','Cotação respondida',$2)", [id, 'Pesquisa de preços — ' + segs.join(', ')]);
    await c.query("INSERT INTO fornecedor_eventos (fornecedor_id, data, tipo, titulo, detalhe) VALUES ($1,'2026-03-03','cotacao','Cotação respondida',$2)", [id, 'Pesquisa de preços — ' + segs.join(', ')]);
    if (!ativo) await c.query("INSERT INTO fornecedor_eventos (fornecedor_id, data, tipo, titulo, detalhe) VALUES ($1,'2026-06-01','situacao','Fornecedor inativado','Alteração de situação cadastral')", [id]);
  }
  await c.query("INSERT INTO fornecedor_eventos (fornecedor_id, data, tipo, titulo, detalhe) VALUES ($1,'2025-11-14','ocorrencia','Notificação de atraso na entrega','Advertência registrada — prazo regularizado em 5 dias')", [fids['Limpeza Express']]);

  const cids = {};
  for (const k of data.contracts) {
    const r = await c.query('INSERT INTO contratos (contratada, contrato, processo, aditamentos, assinatura, fim, empenhado) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [k.contratada, k.contrato, k.processo, k.aditamentos || 0, k.assinatura, k.fim, k.empenhado]);
    const id = r.rows[0].id; cids[k.contrato] = cids[k.contrato] || id;
    for (let m = 0; m < 12; m++) if ((k.mensal || [])[m] > 0) await c.query('INSERT INTO contrato_notas (contrato_id, ano, mes, valor) VALUES ($1,2026,$2,$3)', [id, m, k.mensal[m]]);
    if (k.hist2025) {
      await c.query('INSERT INTO contrato_historico (contrato_id, ano, assinatura, inicio, fim) VALUES ($1,2025,$2,$3,$4)', [id, k.hist2025.assinatura, k.hist2025.inicio, k.hist2025.fim]);
      for (let m = 0; m < 12; m++) if (k.hist2025.mensal[m] > 0) await c.query('INSERT INTO contrato_notas (contrato_id, ano, mes, valor) VALUES ($1,2025,$2,$3)', [id, m, k.hist2025.mensal[m]]);
    }
  }
  for (const e of data.expenses) {
    await c.query(
      `INSERT INTO despesas (processo, catmat, classe, catser, grupo, objeto, descricao, reserva, data, modalidade, empenhado, ficha, sub, data_empenho, audesp, tcn, contrato_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [e.processo, e.catmat || null, e.classe || null, e.catser || null, e.grupo || null, e.objeto, e.descricao, e.reserva, e.data, e.modalidade, e.empenhado, e.ficha || null, e.sub || null, e.dataEmpenho, e.audesp || '', e.tcn || '', e.contrato ? cids[e.contrato] || null : null]);
  }
  for (const v of data.verbinha) await c.query('INSERT INTO verbinha (origem, classe, grupo, data, valor) VALUES ($1,$2,$3,$4,$5)', [v.origem, v.classe || null, v.grupo || null, v.data, v.valor]);
  for (const d of data.dotacoes) await c.query('INSERT INTO dotacoes (ano, ficha, sub, descricao, orcado) VALUES ($1,$2,$3,$4,$5)', [d.ano, d.ficha, d.sub, d.descricao, d.orcado]);
  for (const [cat, cod, nome, g, cl, pdm] of CATALOGO) {
    await c.query('INSERT INTO catalogo_itens (catalogo, codigo, nome, grupo_cod, grupo_nome, classe_cod, classe_nome, pdm_cod, pdm_nome) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [cat, cod, nome, g[0], g[1], cl[0], cl[1], pdm[0], pdm[1]]);
  }
}

module.exports = { seed };
