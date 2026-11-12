/**
 * Documentação das rotas para o gerador do OpenAPI (scripts/openapi.js).
 * Chave: "MÉTODO /caminho" exatamente como registrado no Express.
 * Campos: s = resumo; m = módulo exigido (403 sem acesso); b = corpo "campo*:tipo, ..." (* = obrigatório;
 * tipos s|n|i|b|d|a|o|f = string, número, inteiro, booleano, data AAAA-MM-DD, lista, objeto, arquivo);
 * c = 201 quando cria registro; q = parâmetros de consulta "nome:tipo"; r = resposta (descrição); pub = rota pública; csv/pdf = conteúdo.
 */
module.exports = {
  'GET /health': { s: 'Verificação de saúde do serviço', pub: true, r: '{ ok: true }' },

  // ---------- Autenticação ----------
  'POST /api/auth/login': { s: 'Login com usuário (ou matrícula) e senha', pub: true, b: 'username*:s, password*:s', r: 'Token JWT e dados do usuário. 401 com tentativas restantes; 423 quando bloqueado.' },
  'GET /api/auth/me': { s: 'Usuário autenticado, perfis, módulos e preferências' },
  'POST /api/auth/logout': { s: 'Encerra a sessão atual (revoga o token)' },
  'GET /api/auth/password-rules': { s: 'Regras de senha vigentes (Configurações › Segurança)', pub: true },
  'POST /api/auth/forgot-password': { s: 'Solicita redefinição de senha (resposta sempre genérica)', pub: true, b: 'email*:s' },
  'POST /api/auth/reset-password': { s: 'Redefine a senha com token de uso único (30 min) ou convite', pub: true, b: 'token*:s, password*:s' },
  'PUT /api/auth/password': { s: 'Troca a própria senha (exige a atual; devolve novo token)', b: 'currentPassword*:s, newPassword*:s' },
  'PUT /api/auth/preferences': { s: 'Salva preferências do usuário (tema, exercício fiscal)', b: 'theme:s, exercicio:i' },

  // ---------- Perfil ----------
  'GET /api/profile/': { s: 'Dados do próprio perfil', m: 'perfil' },
  'PUT /api/profile/': { s: 'Atualiza telefone, e-mail pessoal e aniversário. Nome, matrícula, cargo e e-mail institucional → 403', m: 'perfil', b: 'phone:s, personalEmail:s, birthday:d' },

  // ---------- Usuários (Administrativo) ----------
  'GET /api/users/': { s: 'Lista usuários com perfis e permissões (leitura registrada — LGPD)', m: 'Administrativo' },
  'GET /api/users/history': { s: 'Histórico de alterações de acesso', m: 'Administrativo' },
  'POST /api/users/': { c: 201, s: 'Cria usuário e envia convite por e-mail', m: 'Administrativo', b: 'name*:s, email*:s, registration*:s, position:s, hierarchy:s, department:s, roles*:a' },
  'PUT /api/users/{id}': { s: 'Edita dados cadastrais do usuário', m: 'Administrativo', b: 'name*:s, email*:s, registration*:s, position:s, hierarchy:s, department:s' },
  'PUT /api/users/{id}/roles': { s: 'Define os perfis (vários por usuário); protege o último Administrativo', m: 'Administrativo', b: 'roles*:a' },
  'PUT /api/users/{id}/access/{module}': { s: 'Exceção de acesso a um módulo (sobrepõe o perfil)', m: 'Administrativo', b: 'allowed*:b' },
  'DELETE /api/users/{id}/access/{module}': { s: 'Remove a exceção de acesso (volta ao perfil)', m: 'Administrativo' },
  'POST /api/users/{id}/invite': { s: 'Reenvia o convite de primeiro acesso', m: 'Administrativo' },

  // ---------- Auditoria ----------
  'GET /api/audit/': { s: 'Log de auditoria com filtros e indicadores', m: 'auditoria', q: 'q:s, module:s, level:s, period:s' },
  'GET /api/audit/export.csv': { s: 'Exporta o log filtrado (CSV; exportação auditada)', m: 'auditoria', q: 'q:s, module:s, level:s, period:s', csv: true },

  // ---------- Configurações (Administrativo) ----------
  'GET /api/config/': { s: 'Parâmetros do sistema por aba (esquema + valores)', m: 'Administrativo' },
  'PUT /api/config/values/{key}': { s: 'Altera um parâmetro (validado pelo esquema; auditado)', m: 'Administrativo', b: 'value*:o' },
  'POST /api/config/reset/{tab}': { s: 'Restaura os padrões de uma aba', m: 'Administrativo' },
  'GET /api/config/comprasgov': { s: 'Status da integração com a API Compras.gov (endpoints, tempos, contagens, cache)', m: 'Administrativo' },
  'POST /api/config/comprasgov/testar': { s: 'Testa a conexão com cada endpoint da API Compras.gov (auditado)', m: 'Administrativo' },
  'GET /api/config/access': { s: 'Matriz perfil × módulo', m: 'Administrativo' },
  'PUT /api/config/access': { s: 'Liga/desliga um módulo para um perfil (auditado)', m: 'Administrativo', b: 'role*:s, module*:s, on*:b' },
  'POST /api/config/access/reset': { s: 'Restaura a matriz padrão', m: 'Administrativo' },

  // ---------- Cadastros base ----------
  'GET /api/cost-centers': { s: 'Centros de custo (padrão ou patrimônio)', q: 'tipo:s' },
  'POST /api/cost-centers': { c: 201, s: 'Cadastra centro de custo', m: 'Administrativo', b: 'codigo*:s, nome*:s, tipo*:s' },
  'PUT /api/cost-centers/{id}': { s: 'Edita centro de custo', m: 'Administrativo', b: 'codigo*:s, nome*:s, tipo*:s' },
  'PATCH /api/cost-centers/{id}/active': { s: 'Ativa/inativa centro de custo', m: 'Administrativo', b: 'ativo*:b' },
  'GET /api/vereadores': { s: 'Vereadores ativos (autores de moções e homenagens)' },
  'POST /api/vereadores': { c: 201, s: 'Cadastra vereador', m: 'mocoes ou configuracoes', b: 'nome*:s' },
  'GET /api/exercicio': { s: 'Exercícios fiscais disponíveis' },

  // ---------- Painel ----------
  'GET /api/painel/': { s: 'Indicadores do exercício e feed de alertas (somente módulos acessíveis)', m: 'dashboard', q: 'ano:i' },

  // ---------- Gestão de Pessoal ----------
  'GET /api/pessoal/servidores': { s: 'Servidores (leitura registrada — LGPD)', m: 'rh', q: 'situacao:s, setor:s' },
  'POST /api/pessoal/servidores': { c: 201, s: 'Cadastra servidor (sem acesso ao sistema até receber perfil)', m: 'rh', b: 'name*:s, registration*:s, position:s, department:s, situacao:s, email:s' },
  'PUT /api/pessoal/servidores/{id}': { s: 'Edita servidor', m: 'rh', b: 'name*:s, registration*:s, position:s, department:s, situacao:s, email:s' },
  'GET /api/pessoal/ausencias': { s: 'Férias e licenças', m: 'rh' },
  'POST /api/pessoal/ausencias': { c: 201, s: 'Solicita férias/licença (antecedência, limite de 30 dias e sobreposição validados)', m: 'rh', b: 'userId*:i, type*:s, start*:d, end*:d, notes:s' },
  'PATCH /api/pessoal/ausencias/{id}/status': { s: 'Aprova ou recusa (não pode decidir a própria)', m: 'rh', b: 'status*:s' },
  'GET /api/pessoal/indicadores': { s: 'Indicadores de pessoal', m: 'rh' },

  // ---------- Compras & Licitações ----------
  'GET /api/compras/meta': { s: 'Etapas, modos, setores, agentes e permissões do usuário', m: 'compras' },
  'GET /api/compras/processos': { s: 'Processos com etapas, SLA e carga por agente', m: 'compras' },
  'POST /api/compras/processos': { c: 201, s: 'Abre processo (chefia; agente sugerido pela menor carga)', m: 'compras', b: 'interno*:s, externo:s, objeto*:s, modo*:s, setor*:s, agenteId*:i' },
  'PUT /api/compras/processos/{id}': { s: 'Edita processo (chefia ou agente responsável)', m: 'compras', b: 'interno*:s, externo:s, objeto*:s, modo*:s, setor*:s' },
  'DELETE /api/compras/processos/{id}': { s: 'Remove processo (chefia)', m: 'compras' },
  'PUT /api/compras/processos/{id}/agente': { s: 'Atribui/transfere o agente de contratação (chefia)', m: 'compras', b: 'agenteId:i' },
  'PUT /api/compras/processos/{id}/etapas/{idx}': { s: 'Atualiza etapa (ok, pendente, refazer com justificativa, não se aplica)', m: 'compras', b: 'status*:s, justificativa:s' },
  'GET /api/compras/contratos': { s: 'Contratos do exercício com vigência, saldo e notas', m: 'compras', q: 'ano:i' },
  'POST /api/compras/contratos': { c: 201, s: 'Cadastra contrato', m: 'compras', b: 'contratada*:s, contrato*:s, processo:s, assinatura*:d, fim*:d, empenhado:n, aditamentos:i' },
  'PUT /api/compras/contratos/{id}': { s: 'Edita contrato', m: 'compras', b: 'contratada*:s, contrato*:s, processo:s, assinatura*:d, fim*:d, empenhado:n, aditamentos:i' },
  'PUT /api/compras/contratos/{id}/notas/{ano}/{mes}': { s: 'Lança o valor da nota fiscal do mês (0–11)', m: 'compras', b: 'valor*:n' },
  'GET /api/compras/despesas': { s: 'Despesas e verbinha do exercício com limites legais', m: 'compras', q: 'ano:i' },
  'POST /api/compras/despesas': { c: 201, s: 'Inclui despesa', m: 'compras', b: 'processo*:s, objeto*:s, descricao:s, catmat:s, classe:s, catser:s, grupo:s, pdm:s, modalidade:s, empenhado*:n, dataEmpenho*:d, ficha:s, sub:s' },
  'PUT /api/compras/despesas/{id}': { s: 'Edita despesa', m: 'compras', b: 'processo*:s, objeto*:s, descricao:s, catmat:s, classe:s, catser:s, grupo:s, pdm:s, modalidade:s, empenhado*:n, dataEmpenho*:d, ficha:s, sub:s' },
  'PATCH /api/compras/despesas/{id}': { s: 'Atualiza AUDESP, TCN e vínculo com contrato', m: 'compras', b: 'audesp:s, tcn:s, contratoId:i' },
  'GET /api/compras/limites': { s: 'Limites de dispensa e acumulado por objeto', m: 'compras', q: 'ano:i' },
  'POST /api/compras/limites/simular': { s: 'Simula nova despesa contra os limites', m: 'compras', b: 'itemId*:i, valor*:n' },
  'GET /api/compras/catalogo/consulta': { s: 'Item CATMAT/CATSER pelo código (cache local ou API de Dados Abertos do Compras.gov) — autocomplete do cadastro da despesa', m: 'compras', q: 'tipo:s, codigo:s', r: 'item com grupo, classe, PDM (material) ou seção/divisão/grupo/classe (serviço) e descrição; origem api|cache|cache-vencido; 404 se o código não existe.' },
  'POST /api/compras/catalogo/sync': { s: 'Sincroniza o catálogo CATMAT/CATSER', m: 'compras' },

  // ---------- Controle de Chaves (termo "Entrega e Recebimento de Chaves", assinatura eletrônica) ----------
  'GET /api/chaves/': { s: 'Chaves cadastradas com o empréstimo em aberto (se houver)', m: 'chaves' },
  'POST /api/chaves/': { c: 201, s: 'Cadastra chave (auditado)', m: 'chaves', b: 'codigo*:s, local*:s, descricao:s' },
  'PUT /api/chaves/{id}': { s: 'Edita chave (auditado)', m: 'chaves', b: 'codigo*:s, local*:s, descricao:s' },
  'PATCH /api/chaves/{id}/ativa': { s: 'Ativa/desativa chave; 409 se estiver emprestada', m: 'chaves', b: 'ativa*:b' },
  'POST /api/chaves/assinaturas': { c: 201, s: 'Assinatura do solicitante. Com imagem (PNG data URL) = já assinada no quadro da tela do computador; com tabletId = pedido enviado automaticamente ao tablet pareado', m: 'chaves', b: 'tipo*:s, chaveId:i, solicitante:s, solicitanteDoc:s, emprestimoId:i, devolvidoPor:s, imagem:s, tabletId:i', r: 'id, status (pendente|assinada), resumo assinado (montado no servidor), expiraEm, código de verificação.' },
  'GET /api/chaves/assinaturas/{id}': { s: 'Situação do pedido (somente quem criou): pendente|assinada|cancelada|expirada', m: 'chaves' },
  'DELETE /api/chaves/assinaturas/{id}': { s: 'Cancela pedido de assinatura pendente', m: 'chaves' },
  'GET /api/chaves/tablets': { s: 'Tablets pareados (online quando consultaram nos últimos 15 s)', m: 'chaves' },
  'POST /api/chaves/tablets': { c: 201, s: 'Cadastra tablet e gera código de pareamento (uso único, 15 min; auditado)', m: 'chaves', b: 'nome*:s', r: 'tablet + codigo (XXXX-XXXX)' },
  'POST /api/chaves/tablets/{id}/codigo': { s: 'Novo código de pareamento — desconecta o aparelho atual (auditado)', m: 'chaves' },
  'DELETE /api/chaves/tablets/{id}': { s: 'Remove o tablet e revoga o token do aparelho (auditado)', m: 'chaves' },
  'POST /api/tablet/parear': { s: 'Tablet: troca o código de pareamento pelo token de dispositivo (limite de tentativas)', pub: true, b: 'codigo*:s', r: '{ token, nome } — enviar depois em "Authorization: Tablet <token>"' },
  'GET /api/tablet/pedido': { s: 'Tablet (token de dispositivo): pedido de assinatura aguardando neste tablet', pub: true, r: '{ tablet: { nome }, pedido }; 401 se o tablet não estiver pareado' },
  'POST /api/tablet/pedido/{id}/assinar': { s: 'Tablet (token de dispositivo): grava a assinatura do pedido (SHA-256 do conteúdo + traço + data/hora)', pub: true, b: 'imagem*:s' },
  'GET /api/chaves/emprestimos': { s: 'Retiradas e devoluções com prazo e atraso', m: 'chaves', q: 'situacao:s, q:s', r: '{ items, kpis: { abertos, devolvidas_mes, atrasadas }, prazoHoras }' },
  'GET /api/chaves/emprestimos/{id}': { s: 'Termo de entrega e recebimento com as assinaturas (leitura registrada — LGPD)', m: 'chaves' },
  'POST /api/chaves/emprestimos': { c: 201, s: 'Registra a retirada com a assinatura do solicitante (uso único, confere com os dados assinados)', m: 'chaves', b: 'chaveId*:i, solicitante*:s, solicitanteDoc:s, assinaturaId*:s, observacao:s' },
  'POST /api/chaves/emprestimos/{id}/devolucao': { s: 'Registra a devolução com a assinatura de quem devolve; recebido pelo usuário logado', m: 'chaves', b: 'devolvidoPor*:s, assinaturaId*:s, observacao:s' },
  'GET /api/compras/dotacoes': { s: 'Dotações orçamentárias com execução', m: 'compras', q: 'ano:i' },
  'POST /api/compras/dotacoes': { c: 201, s: 'Cadastra dotação', m: 'compras', b: 'ficha*:s, sub:s, descricao:s, orcado*:n, ano:i' },
  'PUT /api/compras/dotacoes/{id}': { s: 'Edita dotação', m: 'compras', b: 'ficha*:s, sub:s, descricao:s, orcado*:n, ano:i' },
  'GET /api/compras/fornecedores': { s: 'Fornecedores por segmento', m: 'compras', q: 'segmento:s' },
  'GET /api/compras/fornecedores/export.csv': { s: 'Exporta fornecedores (CSV; auditado)', m: 'compras', q: 'segmento:s', csv: true },
  'POST /api/compras/fornecedores': { c: 201, s: 'Cadastra fornecedor', m: 'compras', b: 'name*:s, cnpj:s, contact:s, email:s, segments:a, since:d' },
  'PUT /api/compras/fornecedores/{id}': { s: 'Edita fornecedor', m: 'compras', b: 'name*:s, cnpj:s, contact:s, email:s, segments:a, since:d' },
  'PATCH /api/compras/fornecedores/{id}/ativo': { s: 'Ativa/inativa fornecedor', m: 'compras', b: 'ativo*:b' },
  'GET /api/compras/fornecedores/{id}/historico': { s: 'Histórico do fornecedor', m: 'compras' },

  // ---------- Almoxarifado ----------
  'GET /api/almoxarifado/resumo': { s: 'Estatísticas, críticos e capacidade da equipe', m: 'almoxarifado' },
  'GET /api/almoxarifado/materiais': { s: 'Materiais, escala ativa e última contagem', m: 'almoxarifado' },
  'POST /api/almoxarifado/materiais': { c: 201, s: 'Cadastra material (código 1 50 02 0018 0)', m: 'almoxarifado', b: 'code*:s, name*:s, unit:s, category:s, priority:s, stock:n, avgConsumption:n' },
  'PUT /api/almoxarifado/materiais/{id}': { s: 'Edita material', m: 'almoxarifado', b: 'code*:s, name*:s, unit:s, category:s, priority:s, stock:n, avgConsumption:n' },
  'GET /api/almoxarifado/params': { s: 'Parâmetros da escala de contagem', m: 'almoxarifado' },
  'PUT /api/almoxarifado/params': { s: 'Salva parâmetros (somente o responsável; pesos somam 100%)', m: 'almoxarifado', b: 'team*:a, days*:a, weights*:o, calcBase*:s, perSession*:i, sessionsPerWeek*:i, tolerancePct*:n, recountPct*:n' },
  'POST /api/almoxarifado/params/reset': { s: 'Restaura parâmetros padrão (responsável)', m: 'almoxarifado' },
  'POST /api/almoxarifado/escala': { c: 201, s: 'Gera a escala semanal por sorteio balanceado', m: 'almoxarifado', b: 'category*:s, method*:s, responsible*:s, size*:i' },
  'DELETE /api/almoxarifado/escala': { s: 'Encerra a escala ativa', m: 'almoxarifado' },
  'POST /api/almoxarifado/contagens': { c: 201, s: 'Registra contagem (somente o responsável pelo item)', m: 'almoxarifado', b: 'materialId*:i, contado*:n' },
  'POST /api/almoxarifado/contagens/{materialId}/corrigir': { s: 'Corrige o saldo pela contagem divergente', m: 'almoxarifado' },
  'GET /api/almoxarifado/estoque': { s: 'Visão de estoque', m: 'almoxarifado' },
  'GET /api/almoxarifado/estoque/documentos': { s: 'RME/BRM computados (paginado)', m: 'almoxarifado', q: 'tipo:s, page:i' },
  'GET /api/almoxarifado/estoque/arquivos-computados': { s: 'Nomes de arquivos já computados (evita reenvio)', m: 'almoxarifado' },
  'POST /api/almoxarifado/estoque/upload': { s: 'Envia PDFs de RME/BRM (multipart, até 200 arquivos de 10 MB)', m: 'almoxarifado', multipart: 'files*:f, tipo:s' },
  'POST /api/almoxarifado/estoque/sync': { s: 'Lê as pastas de RME/BRM no Google Drive (400 se não configurado)', m: 'almoxarifado' },
  'GET /api/almoxarifado/estoque/pendentes': { s: 'Itens de documentos sem material cadastrado', m: 'almoxarifado' },
  'POST /api/almoxarifado/estoque/pendentes': { s: 'Aceita (cadastra e aplica) ou recusa pendências', m: 'almoxarifado', b: 'decisions*:a' },

  // ---------- Patrimônio ----------
  'GET /api/patrimonio/meta': { s: 'Etapas, centros de custo de patrimônio e servidores', m: 'patrimonio' },
  'GET /api/patrimonio/transferencias': { s: 'Transferências e pendência de assinatura do usuário', m: 'patrimonio' },
  'POST /api/patrimonio/transferencias': { c: 201, s: 'Registra transferência (bloqueio de duplicidade configurável)', m: 'patrimonio', b: 'code*:s, description*:s, fromUser*:s, toUser*:s, fromCc:s, toCc:s, date*:d' },
  'PUT /api/patrimonio/transferencias/{id}': { s: 'Edita transferência', m: 'patrimonio', b: 'code*:s, description*:s, fromUser*:s, toUser*:s, fromCc:s, toCc:s, date*:d' },
  'POST /api/patrimonio/transferencias/{id}/etapa': { s: 'Avança (1) ou volta (−1) a etapa', m: 'patrimonio', b: 'dir*:i' },
  'POST /api/patrimonio/transferencias/{id}/assinar': { s: 'Assina o termo (somente o servidor de destino)', m: 'patrimonio' },
  'POST /api/patrimonio/transferencias/{id}/recusar': { s: 'Contesta/recusa o termo (somente o servidor de destino)', m: 'patrimonio' },
  'GET /api/patrimonio/termos': { s: 'Termos de responsabilidade do mês por centro de custo', m: 'patrimonio', q: 'mes:s' },
  'PUT /api/patrimonio/termos/{ccId}/{ym}': { s: 'Marca o termo como emitido', m: 'patrimonio' },
  'DELETE /api/patrimonio/termos/{ccId}/{ym}': { s: 'Desfaz a emissão do termo', m: 'patrimonio' },

  // ---------- Protocolo ----------
  'GET /api/protocolo/meta': { s: 'Fluxo, prioridades, setores e prazos padrão', m: 'protocolo' },
  'GET /api/protocolo/documentos': { s: 'Documentos protocolados', m: 'protocolo', q: 'q:s, status:s' },
  'POST /api/protocolo/documentos': { c: 201, s: 'Protocola documento (PRT-AAAA-NNN) com prazo opcional', m: 'protocolo', b: 'assunto*:s, interessado*:s, setor:s, prazo:d, prazoDesc:s' },
  'PUT /api/protocolo/documentos/{id}': { s: 'Edita documento e seu prazo principal', m: 'protocolo', b: 'assunto*:s, interessado*:s, setor:s, prazo:d, prazoDesc:s' },
  'POST /api/protocolo/documentos/{id}/etapa': { s: 'Avança (1) ou volta (−1) no fluxo', m: 'protocolo', b: 'dir*:i' },
  'GET /api/protocolo/processos': { s: 'Processos internos', m: 'protocolo' },
  'POST /api/protocolo/processos': { c: 201, s: 'Cria processo (PROC-NNN)', m: 'protocolo', b: 'titulo*:s, descricao:s, prioridade:s, responsavel:s, prazo:d, prazoDesc:s' },
  'PUT /api/protocolo/processos/{id}': { s: 'Edita processo', m: 'protocolo', b: 'titulo*:s, descricao:s, prioridade:s, responsavel:s, prazo:d, prazoDesc:s' },
  'POST /api/protocolo/processos/{id}/progresso': { s: 'Ajusta o progresso em ±10%', m: 'protocolo', b: 'delta*:i' },
  'GET /api/protocolo/prazos': { s: 'Prazos próprios em aberto', m: 'protocolo' },
  'POST /api/protocolo/prazos': { c: 201, s: 'Cadastra prazo para documento ou processo', m: 'protocolo', b: 'refTipo*:s, refId*:i, descricao*:s, vencimento*:d' },
  'PUT /api/protocolo/prazos/{id}': { s: 'Edita prazo', m: 'protocolo', b: 'refTipo*:s, refId*:i, descricao*:s, vencimento*:d' },
  'POST /api/protocolo/prazos/{id}/concluir': { s: 'Conclui prazo', m: 'protocolo' },
  'GET /api/protocolo/calendario': { s: 'Calendário integrado (eventos dos módulos acessíveis)', m: 'protocolo' },
  'GET /api/protocolo/prazos-criticos': { s: 'Prazos vencidos, urgentes, próximos e a agendar', m: 'protocolo' },

  // ---------- Moções & Homenagens ----------
  'GET /api/mocoes/meta': { s: 'Tipos, status, legislaturas, cota e itens de bandeiras', m: 'mocoes' },
  'GET /api/mocoes/mocoes': { s: 'Moções', m: 'mocoes', q: 'q:s' },
  'POST /api/mocoes/mocoes': { c: 201, s: 'Registra moção (numeração sequencial anual)', m: 'mocoes', b: 'tipo*:s, vereadorId*:i, assunto*:s, data*:d, sessao:d, status:s' },
  'PUT /api/mocoes/mocoes/{id}': { s: 'Edita moção', m: 'mocoes', b: 'tipo*:s, vereadorId*:i, assunto*:s, data*:d, sessao:d, status:s' },
  'GET /api/mocoes/galeria': { s: 'Galeria de homenageados e cota por vereador', m: 'mocoes' },
  'POST /api/mocoes/galeria': { c: 201, s: 'Registra homenagem (409 quando a cota da legislatura foi atingida)', m: 'mocoes', b: 'vereadorId*:i, homenageado*:s' },
  'PUT /api/mocoes/galeria/{id}': { s: 'Edita homenageado', m: 'mocoes', b: 'vereadorId*:i, homenageado*:s, legislatura*:s, quadro*:s' },
  'GET /api/mocoes/entregas': { s: 'Entregas de arranjos e placas', m: 'mocoes' },
  'POST /api/mocoes/entregas': { c: 201, s: 'Cadastra entrega (sem data = a agendar)', m: 'mocoes', b: 'homenageado*:s, honraria:s, vereadorId*:i, material:s, processo:s, decreto:s, data:d, horario:s, status*:s, obs:s' },
  'PUT /api/mocoes/entregas/{id}': { s: 'Edita entrega', m: 'mocoes', b: 'homenageado*:s, honraria:s, vereadorId*:i, material:s, processo:s, decreto:s, data:d, horario:s, status*:s, obs:s' },
  'GET /api/mocoes/bandeiras': { s: 'Empréstimos de bandeiras (leitura registrada — LGPD)', m: 'mocoes' },
  'POST /api/mocoes/bandeiras': { c: 201, s: 'Registra solicitação de empréstimo', m: 'mocoes', b: 'entidade*:s, documento:s, telefone:s, solicitacao*:d, protocolo:s, itens*:a, retirado*:b, retirada:d, devolucao:d, conformidade:s, obs:s' },
  'PUT /api/mocoes/bandeiras/{id}': { s: 'Edita empréstimo (retirada, devolução, conformidade)', m: 'mocoes', b: 'entidade*:s, documento:s, telefone:s, solicitacao*:d, protocolo:s, itens*:a, retirado*:b, retirada:d, devolucao:d, conformidade:s, obs:s' },
  'GET /api/mocoes/bandeiras/tablets': { s: 'Tablets pareados disponíveis para coletar a assinatura (pareamento em Controle de Chaves › Tablets)', m: 'mocoes' },
  'POST /api/mocoes/bandeiras/assinaturas': { c: 201, s: 'Assinatura de quem retira/devolve bandeiras. Com imagem = assinada no quadro da tela; com tabletId = enviada automaticamente ao tablet pareado. Conteúdo montado no servidor (entidade, itens, conferência)', m: 'mocoes', b: 'tipo*:s, emprestimoId*:i, retiradoPor:s, retiradoDoc:s, devolvidoPor:s, conformidade:s, obs:s, imagem:s, tabletId:i' },
  'GET /api/mocoes/bandeiras/assinaturas/{id}': { s: 'Situação do pedido de assinatura (somente quem criou)', m: 'mocoes' },
  'DELETE /api/mocoes/bandeiras/assinaturas/{id}': { s: 'Cancela pedido de assinatura pendente', m: 'mocoes' },
  'POST /api/mocoes/bandeiras/{id}/retirada': { s: 'Registra a retirada com a assinatura de quem retira (uso único, confere com os dados assinados)', m: 'mocoes', b: 'retiradoPor*:s, retiradoDoc:s, assinaturaId*:s' },
  'POST /api/mocoes/bandeiras/{id}/devolucao': { s: 'Registra a devolução e a conferência com a assinatura de quem devolve; recebido pelo usuário logado', m: 'mocoes', b: 'devolvidoPor*:s, conformidade*:s, obs:s, assinaturaId*:s' },
  'GET /api/mocoes/bandeiras/{id}/termo': { s: 'Termo de retirada e devolução com as assinaturas (leitura registrada — LGPD)', m: 'mocoes' },
  'DELETE /api/mocoes/bandeiras/{id}': { s: 'Exclui o registro', m: 'mocoes' },

  // ---------- Legislações ----------
  'GET /api/legislacoes/': { s: 'Normas e permissão de edição do usuário', m: 'legislacoes' },
  'POST /api/legislacoes/': { c: 201, s: 'Cadastra norma com PDF opcional (multipart; editores conforme leg.editores)', m: 'legislacoes', multipart: 'tipo*:s, numero*:s, ementa*:s, orgao:s, data:d, link:s, tags:s, texto:s, ativa:b, pdf:f' },
  'PUT /api/legislacoes/{id}': { s: 'Edita norma, troca ou remove o PDF', m: 'legislacoes', multipart: 'tipo*:s, numero*:s, ementa*:s, orgao:s, data:d, link:s, tags:s, texto:s, ativa:b, removerPdf:b, pdf:f' },
  'PATCH /api/legislacoes/{id}/ativa': { s: 'Ativa/inativa norma', m: 'legislacoes', b: 'ativa*:b' },
  'GET /api/legislacoes/{id}/pdf': { s: 'PDF anexado à norma', m: 'legislacoes', pdf: true },

  // ---------- Notificações ----------
  'GET /api/notifications/': { s: 'Caixa de entrada, arquivadas, tipos e preferências', m: 'notificacoes' },
  'GET /api/notifications/summary': { s: 'Contador do sino (respeita horário de silêncio)', m: 'notificacoes' },
  'POST /api/notifications/read-all': { s: 'Marca todas como lidas', m: 'notificacoes' },
  'POST /api/notifications/archive-all': { s: 'Arquiva todas da caixa de entrada', m: 'notificacoes' },
  'POST /api/notifications/{id}/read': { s: 'Marca como lida', m: 'notificacoes' },
  'POST /api/notifications/{id}/archive': { s: 'Arquiva', m: 'notificacoes' },
  'POST /api/notifications/{id}/restore': { s: 'Restaura da lista de arquivadas', m: 'notificacoes' },
  'PUT /api/notifications/preferences': { s: 'Preferências de notificação do usuário', m: 'notificacoes', b: 'types*:o, tempoReal*:b, email*:b, silencio*:o' },

  // ---------- Analytics ----------
  'GET /api/analytics/': { s: 'Visão consolidada (indicadores e blocos); periodo=custom exige de e ate', m: 'analytics', q: 'periodo:s, de:d, ate:d' },
  'GET /api/analytics/export.csv': { s: 'Exporta a visão consolidada (CSV; auditado)', m: 'analytics', q: 'periodo:s, de:d, ate:d', csv: true }
};
