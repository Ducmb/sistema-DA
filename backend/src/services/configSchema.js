/**
 * Parâmetros do sistema por módulo (Configurações do Sistema). Portado de design/config.js.
 * Os valores ficam em system_config; sem linha = valor padrão (def).
 */
const ROLES = ['Administrativo', 'Compras', 'Almoxarifado', 'Patrimônio', 'Gerenciamento', 'Visualizador'];

const N = (key, label, def, unit, min, max, hint) => ({ key, label, type: 'number', def, unit: unit || '', min, max, hint: hint || '' });
const T = (key, label, def, hint) => ({ key, label, type: 'toggle', def, hint: hint || '' });
const S = (key, label, def, options, hint) => ({ key, label, type: 'select', def, options, hint: hint || '' });
const X = (key, label, def, hint) => ({ key, label, type: 'text', def, hint: hint || '' });

const SCHEMA = [
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
    { title: 'Retenção', fields: [N('audit.maxRegistros', 'Registros exibidos por consulta', 500, 'registros', 100, 5000), N('audit.retencaoDias', 'Retenção no servidor', 1825, 'dias', 365, 3650, 'Mínimo recomendado: 5 anos')] },
    { title: 'Eventos registrados', fields: [T('audit.logins', 'Logins e falhas de login', true), T('audit.negados', 'Acessos negados', true), T('audit.exportacoes', 'Exportações de dados', true)] }
  ] }
];

const FIELDS = {};
SCHEMA.forEach((t) => t.groups.forEach((g) => g.fields.forEach((f) => { FIELDS[f.key] = { ...f, tab: t.key, tabLabel: t.label }; })));

/** Valida e normaliza um valor; retorna { ok, value } ou { ok:false, msg }. */
function coerce(field, v) {
  if (field.type === 'number') {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    if (!isFinite(n) || (field.min != null && n < field.min) || (field.max != null && n > field.max)) return { ok: false, msg: `Informe um valor entre ${field.min} e ${field.max}.` };
    return { ok: true, value: n };
  }
  if (field.type === 'toggle') {
    if (typeof v !== 'boolean') return { ok: false, msg: 'Valor deve ser verdadeiro ou falso.' };
    return { ok: true, value: v };
  }
  if (field.type === 'select') {
    if (!field.options.includes(String(v))) return { ok: false, msg: 'Opção inválida.' };
    return { ok: true, value: String(v) };
  }
  const s = String(v == null ? '' : v).trim();
  if (s.length > 200) return { ok: false, msg: 'Texto muito longo (máx. 200 caracteres).' };
  if (field.key === 'notif.resumoHora' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return { ok: false, msg: 'Use o formato HH:MM.' };
  if (field.key === 'geral.emailRemetente' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { ok: false, msg: 'E-mail inválido.' };
  return { ok: true, value: s };
}

function show(field, v) {
  if (field.type === 'toggle') return v ? 'Sim' : 'Não';
  if (field.unit === 'R$') return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  return String(v) + (field.unit ? ' ' + field.unit : '');
}

module.exports = { SCHEMA, FIELDS, ROLES, coerce, show };
