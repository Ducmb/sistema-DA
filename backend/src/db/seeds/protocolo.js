/** Amostra do Protocolo (protótipo ProtocoloModule). */
async function seed(c, ctx) {
  const by = ctx.users['Dr. Roberto Alencar'] || null;
  const D = [
    ['PRT-2026-001', 'Solicitação de Parecer - Contrato de Manutenção', 'Dr. Roberto Alencar', 'Serviço de Licitações e Contratos', '2026-06-01', 'Finalizado'],
    ['PRT-2026-002', 'Processo de Revisão de Normas Administrativas', 'Ana Silva', 'Diretoria Administrativa', '2026-06-05', 'Em Processamento'],
    ['PRT-2026-003', 'Requerimento de Isenção Fiscal', 'Carlos Costa', 'Diretoria Administrativa', '2026-06-08', 'Registrado'],
    ['PRT-2026-004', 'Autorização para Despesa Extraordinária', 'Mariana Luz', 'Serviço de Licitações e Contratos', '2026-06-10', 'Em Processamento'],
    ['PRT-2026-005', 'Relatório Semestral de Atividades', 'Dr. Roberto Alencar', 'Diretoria Administrativa', '2026-06-12', 'Arquivado']
  ];
  const doc = {}, proc = {};
  for (const [p, a, i, s, d, st] of D) doc[p] = (await c.query('INSERT INTO protocolo_documentos (protocolo, assunto, interessado, setor, data, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [p, a, i, s, d, st, by])).rows[0].id;
  const P = [
    ['PROC-001', 'Revisão de Normativos Internos', 'Análise e atualização das normas administrativas da Câmara para 2026.', 'Alta', 60, 'Dr. Roberto Alencar'],
    ['PROC-002', 'Contratação de Consultoria Externa', 'Processo de seleção e contratação de consultores para modernização de TI.', 'Média', 40, 'Ana Beatriz Silva'],
    ['PROC-003', 'Auditoria Interna Anual', 'Auditoria geral dos processos administrativos e financeiros.', 'Baixa', 20, 'Patricia de Souza'],
    ['PROC-004', 'Elaboração de Relatório de Conformidade', 'Relatório anual de conformidade com legislação federal.', 'Alta', 80, 'Carlos Mendes Oliveira']
  ];
  for (const [k, t, d, pr, pg, r] of P) proc[k] = (await c.query('INSERT INTO protocolo_processos (codigo, titulo, descricao, prioridade, progresso, responsavel, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [k, t, d, pr, pg, r, by])).rows[0].id;
  const Z = [
    [doc['PRT-2026-002'], null, 'Parecer jurídico obrigatório', '2026-10-20'],
    [null, proc['PROC-001'], 'Aprovação da diretoria', '2026-10-26'],
    [doc['PRT-2026-004'], null, 'Despacho final', '2026-10-28'],
    [null, proc['PROC-002'], 'Publicação de edital', '2026-11-06'],
    [null, proc['PROC-003'], 'Conclusão de auditoria', '2026-11-17']
  ];
  for (const [d, p, desc, v] of Z) await c.query('INSERT INTO protocolo_prazos (documento_id, processo_id, descricao, vencimento, created_by) VALUES ($1,$2,$3,$4,$5)', [d, p, desc, v, by]);
}

module.exports = { seed };
