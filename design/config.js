(function(){
if (window.DAConfig) return;
var KEY = 'DA_config_v1';
var ROLES = ['Administrativo', 'Compras', 'Almoxarifado', 'Patrimônio', 'Gerenciamento', 'Visualizador'];
var MODULES = [
  ['dashboard', 'Painel de Controle'], ['perfil', 'Meus Dados (Perfil)'], ['notificacoes', 'Notificações'], ['legislacoes', 'Legislações'],
  ['almoxarifado', 'Almoxarifado'], ['analytics', 'Analytics & Relatórios'], ['compras', 'Compras & Licitações'], ['rh', 'Gestão de Pessoal'],
  ['mocoes', 'Moções & Homenagens'], ['patrimonio', 'Patrimônio'], ['protocolo', 'Protocolo'], ['auditoria', 'Log e Auditoria'], ['configuracoes', 'Configurações do Sistema']
];
var BASE = ['dashboard', 'perfil', 'notificacoes', 'legislacoes'];
var ACCESS = {
  'Administrativo': MODULES.map(function (m) { return m[0]; }),
  'Compras': BASE.concat(['mocoes', 'compras']),
  'Almoxarifado': BASE.concat(['mocoes', 'almoxarifado']),
  'Patrimônio': BASE.concat(['patrimonio']),
  'Gerenciamento': BASE.concat(['protocolo']),
  'Visualizador': ['analytics', 'perfil']
};
var N = function (k, label, def, unit, min, max, hint) { return { key: k, label: label, type: 'number', def: def, unit: unit || '', min: min, max: max, hint: hint || '' }; };
var T = function (k, label, def, hint) { return { key: k, label: label, type: 'toggle', def: def, hint: hint || '' }; };
var S = function (k, label, def, options, hint) { return { key: k, label: label, type: 'select', def: def, options: options, hint: hint || '' }; };
var X = function (k, label, def, hint) { return { key: k, label: label, type: 'text', def: def, hint: hint || '' }; };
var SCHEMA = [
  { key: 'geral', label: 'Geral', icon: '⚙', groups: [
    { title: 'Sessão e acesso', fields: [N('geral.sessaoMin', 'Encerrar sessão após inatividade', 30, 'min', 5, 240, 'Aplicado em todas as telas'), N('geral.loginTentativas', 'Tentativas de login antes do bloqueio', 5, 'tentativas', 3, 10), N('geral.loginBloqueioMin', 'Tempo de bloqueio da conta', 15, 'min', 5, 120)] },
    { title: 'Senhas', fields: [N('geral.senhaMin', 'Tamanho mínimo da senha', 8, 'caracteres', 8, 32), T('geral.senhaComplexa', 'Exigir letras e números', true), N('geral.tokenSenhaMin', 'Validade do link de redefinição', 30, 'min', 10, 120, 'RF03 — token de uso único')] },
    { title: 'Instituição', fields: [X('geral.orgao', 'Nome do órgão', 'Câmara Municipal — Diretoria Administrativa'), X('geral.emailRemetente', 'E-mail remetente do sistema', 'nao-responda@camara.gov.br'), S('geral.exercicio', 'Exercício fiscal padrão', '2026', ['2025', '2026', '2027'])] }
  ] },
  { key: 'painel', label: 'Painel de Controle', icon: '▦', groups: [
    { title: 'Alertas', fields: [N('painel.autoDismiss', 'Tempo de exibição de cada aviso no feed', 5, 's', 2, 120, 'O feed avança para o próximo aviso após esse tempo; azuis/verdes saem do feed, amarelos e vermelhos voltam ao fim da fila'), N('painel.opacidade', 'Opacidade do feed em repouso', 40, '%', 10, 100), T('painel.agrupar', 'Agrupar atualizações repetidas no mesmo cartão', true)] },
    { title: 'Prazos críticos', fields: [N('painel.janelaUrgente', 'Janela "urgente"', 7, 'dias', 1, 30), N('painel.janelaProxima', 'Janela "próximos"', 30, 'dias', 7, 120)] },
    { title: 'Atualização', fields: [N('painel.refresh', 'Intervalo de atualização em tempo real', 30, 's', 5, 3600, 'Digite o tempo em segundos e pressione Enter')] }
  ] },
  { key: 'compras', label: 'Compras & Licitações', icon: '🛒', groups: [
    { title: 'Limites legais', fields: [N('compras.limCompras', 'Dispensa — compras e serviços (art. 75, II)', 65492.11, 'R$', 0, 10000000), N('compras.limEng', 'Dispensa — obras e engenharia (art. 75, I)', 130984.20, 'R$', 0, 10000000), X('compras.fonteLimites', 'Fonte legal dos valores', 'Decreto nº 12.807/2025'), N('compras.limAtencao', 'Aviso de atenção a partir de', 80, '% do limite', 50, 99)] },
    { title: 'Alertas de contratos', fields: [N('compras.avisoAzul', 'Aviso informativo (azul)', 120, 'dias antes', 30, 365), N('compras.avisoAmarelo', 'Aviso de atenção (amarelo)', 60, 'dias antes', 15, 180), N('compras.avisoVermelho', 'Aviso crítico (vermelho)', 30, 'dias antes', 1, 90), N('compras.saldoMin', 'Saldo de empenho mínimo', 20, '%', 5, 50)] },
    { title: 'Notas fiscais e TCN', fields: [N('compras.nfAtraso', 'NF não recebida vira crítica após', 5, 'dias úteis', 1, 30, 'Amarela no dia previsto'), N('compras.tcnPrazo', 'Prazo do TCN após o empenho', 5, 'dias úteis', 1, 30)] },
    { title: 'Controle de processos', fields: [N('compras.sla', 'Etapa parada vira atrasada após', 5, 'dias úteis', 1, 30), T('compras.refazerJust', 'Exigir justificativa em "Refazer"', true), T('compras.sugerirAgente', 'Sugerir agente com menor carga', true), T('compras.chefiaConfirma', 'Atribuição precisa de confirmação da chefia', true)] }
  ] },
  { key: 'almoxarifado', label: 'Almoxarifado', icon: '📦', groups: [
    { title: 'Escala de contagem', fields: [N('almox.itensSessao', 'Itens por sessão', 3, 'itens', 1, 50), N('almox.sessoesSemana', 'Sessões por semana', 2, 'sessões', 1, 5), S('almox.metodo', 'Método de amostragem padrão', 'alta', ['alta', 'media', 'baixa', 'balanceado'])] },
    { title: 'Qualidade da contagem', fields: [N('almox.tolerancia', 'Tolerância de divergência', 5, '%', 0, 100), N('almox.recontagem', 'Recontagem por amostra', 10, '%', 0, 100)] },
    { title: 'Alertas', fields: [N('almox.critico', 'Material crítico quando o estoque cobre menos de', 1, 'mês de consumo', 0.5, 12), T('almox.alertaPainel', 'Enviar materiais críticos ao Painel', true)] },
    { title: 'Atualização de estoque (RME/BRM)', fields: [N('almox.intervalo', 'Verificar a pasta monitorada a cada', 60, 'min', 5, 1440), T('almox.confirmarNovos', 'Pedir confirmação antes de cadastrar itens novos da BRM', true)] },
    { title: 'Listagens', fields: [N('almox.pageBase', 'Itens por página na Base Completa', 25, 'itens', 10, 100), N('almox.pageDocs', 'Documentos por página', 10, 'itens', 5, 50)] }
  ] },
  { key: 'patrimonio', label: 'Patrimônio', icon: '🏛', groups: [
    { title: 'Transferências', fields: [N('patrim.prazoTermo', 'Prazo para assinar o termo', 5, 'dias úteis', 1, 30), T('patrim.alertaPendente', 'Alertar transferências pendentes', true), T('patrim.bloqueioDuplo', 'Bloquear nova transferência com outra pendente', true)] }
  ] },
  { key: 'mocoes', label: 'Moções & Homenagens', icon: '🎗', groups: [
    { title: 'Cotas e regras', fields: [N('mocoes.cotaVereador', 'Homenagens por vereador por legislatura', 2, 'homenagens', 1, 20, 'Portaria DA 01/2026'), X('mocoes.portaria', 'Norma de referência', 'Portarias DA 01/2026 e 03/2023')] },
    { title: 'Alertas de bandeiras', fields: [N('mocoes.bandAmarelo', 'Aviso de devolução (amarelo)', 1, 'dia antes', 0, 15), T('mocoes.bandVermelho', 'Vermelho após a data prevista', true)] },
    { title: 'Arranjos e placas', fields: [N('mocoes.antecedencia', 'Antecedência mínima para encomenda', 7, 'dias', 1, 60), T('mocoes.listarSemData', 'Listar entregas "a agendar" nos prazos críticos', true)] }
  ] },
  { key: 'protocolo', label: 'Protocolo', icon: '📋', groups: [
    { title: 'Prazos', fields: [N('prot.prazoPadrao', 'Prazo padrão de resposta', 15, 'dias', 1, 90), N('prot.alertaAntes', 'Alertar antes do vencimento', 3, 'dias', 0, 30)] },
    { title: 'Calendário integrado', fields: [T('prot.calCompras', 'Exibir Compras por padrão', true), T('prot.calMocoes', 'Exibir Moções por padrão', true), T('prot.calPessoal', 'Exibir Gestão de Pessoal por padrão', true), T('prot.calAlmox', 'Exibir Almoxarifado por padrão', true)] }
  ] },
  { key: 'pessoal', label: 'Gestão de Pessoal', icon: '🧑‍💼', groups: [
    { title: 'Férias e licenças', fields: [N('rh.antecedencia', 'Antecedência mínima da solicitação', 30, 'dias', 0, 120), T('rh.aprovaChefia', 'Exigir aprovação da chefia', true), N('rh.alertaParada', 'Alertar solicitação parada após', 5, 'dias úteis', 1, 30)] },
    { title: 'Cadastro de servidores', fields: [T('rh.lgpdLog', 'Registrar leituras de dados pessoais (LGPD)', true), S('rh.perfilPadrao', 'Perfil de acesso padrão de novos servidores', 'Visualizador', ROLES.slice(1))] }
  ] },
  { key: 'legislacoes', label: 'Legislações', icon: '⚖', groups: [
    { title: 'Exibição', fields: [T('leg.mostrarInativas', 'Mostrar normas inativas por padrão', false), N('leg.pagina', 'Normas por página', 20, 'itens', 5, 100)] },
    { title: 'Edição', fields: [S('leg.editores', 'Quem pode editar e ativar/inativar', 'Administrativo', ['Administrativo', 'Administrativo e Gerenciamento'])] }
  ] },
  { key: 'notificacoes', label: 'Notificações', icon: '🔔', groups: [
    { title: 'Canais', fields: [T('notif.sistema', 'Notificações no sistema', true), T('notif.email', 'Enviar por e-mail', false), X('notif.resumoHora', 'Horário do resumo diário', '08:00')] },
    { title: 'Alertas por gravidade', fields: [T('notif.critico', 'Críticos (vermelho)', true), T('notif.atencao', 'Atenção (amarelo)', true), T('notif.info', 'Informativos (azul)', false)] }
  ] },
  { key: 'analytics', label: 'Analytics', icon: '📈', groups: [
    { title: 'Relatórios', fields: [S('analytics.periodo', 'Período padrão', '30', ['7', '30', '90', '365']), S('analytics.formato', 'Formato de exportação', 'CSV', ['CSV', 'PDF'])] }
  ] },
  { key: 'auditoria', label: 'Log e Auditoria', icon: '🛡', groups: [
    { title: 'Retenção', fields: [N('audit.maxRegistros', 'Registros mantidos no navegador', 500, 'registros', 100, 5000), N('audit.retencaoDias', 'Retenção no servidor', 1825, 'dias', 365, 3650, 'Mínimo recomendado: 5 anos')] },
    { title: 'Eventos registrados', fields: [T('audit.logins', 'Logins e falhas de login', true), T('audit.negados', 'Acessos negados', true), T('audit.exportacoes', 'Exportações de dados', true)] }
  ] }
];
function defaults() { var o = {}; SCHEMA.forEach(function (t) { t.groups.forEach(function (g) { g.fields.forEach(function (f) { o[f.key] = f.def; }); }); }); return o; }
function read() { try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') return s; } catch (e) {} return {}; }
function write(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} window.dispatchEvent(new CustomEvent('configchange')); }
var C = {
  ROLES: ROLES, MODULES: MODULES, SCHEMA: SCHEMA, DEFAULT_ACCESS: ACCESS,
  get: function (k) { var s = read(); return (s.values && Object.prototype.hasOwnProperty.call(s.values, k)) ? s.values[k] : defaults()[k]; },
  set: function (k, v) { var s = read(); s.values = s.values || {}; s.values[k] = v; write(s); },
  resetTab: function (tabKey) { var s = read(); var t = SCHEMA.find(function (x) { return x.key === tabKey; }); if (s.values && t) t.groups.forEach(function (g) { g.fields.forEach(function (f) { delete s.values[f.key]; }); }); write(s); },
  access: function () { var s = read(); var a = {}; ROLES.forEach(function (r) { a[r] = (s.access && s.access[r]) ? s.access[r].slice() : ACCESS[r].slice(); }); a['Administrativo'] = ACCESS['Administrativo'].slice(); return a; },
  setAccess: function (role, mod, on) { if (role === 'Administrativo') return; var s = read(); var a = C.access(); var l = a[role].filter(function (m) { return m !== mod; }); if (on) l.push(mod); s.access = s.access || {}; s.access[role] = l; write(s); },
  resetAccess: function () { var s = read(); delete s.access; write(s); },
  isDefault: function (k) { var s = read(); return !(s.values && Object.prototype.hasOwnProperty.call(s.values, k)); }
};
window.DAConfig = C;
})();
