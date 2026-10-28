/**
 * Telas do sistema: menu lateral (por categoria, ordem alfabética) e busca global.
 */
export const SCREENS = [
  { path: '/painel', module: 'dashboard', icon: '▦', label: 'Painel de Controle', group: 'main', keywords: 'painel dashboard indicadores alertas prazos fluxo' },
  { path: '/almoxarifado', module: 'almoxarifado', icon: '📦', label: 'Almoxarifado', group: 'main', keywords: 'almoxarifado estoque amostragem materiais contagem inventario rme brm' },
  { path: '/compras', module: 'compras', icon: '🛒', label: 'Compras & Licitações', group: 'main', keywords: 'compras licitacoes requisicoes fornecedores pregao contratos despesas dotacao' },
  { path: '/mocoes', module: 'mocoes', icon: '🎗', label: 'Moções & Homenagens', group: 'main', keywords: 'mocoes homenagens galeria vereador portaria arranjos placas bandeiras' },
  { path: '/patrimonio', module: 'patrimonio', icon: '🏛', label: 'Patrimônio', group: 'main', keywords: 'patrimonio bens tombamento transferencias ativos termos' },
  { path: '/analytics', module: 'analytics', icon: '📈', label: 'Analytics & Relatórios', group: 'comp', keywords: 'analytics relatorios metricas indicadores consolidado' },
  { path: '/configuracoes', module: 'configuracoes', icon: '⚙', label: 'Configurações do Sistema', group: 'comp', keywords: 'configuracoes parametros parametrizacao ajustes alertas limites acessos perfis centros de custo' },
  { path: '/pessoal', module: 'rh', icon: '🧑‍💼', label: 'Gestão de Pessoal', group: 'comp', keywords: 'rh recursos humanos servidores ferias usuarios permissoes' },
  { path: '/legislacoes', module: 'legislacoes', icon: '⚖', label: 'Legislações', group: 'comp', keywords: 'legislacao leis decretos portarias resolucoes recomendacoes normas' },
  { path: '/auditoria', module: 'auditoria', icon: '🛡', label: 'Log e Auditoria', group: 'comp', keywords: 'log auditoria seguranca acessos lgpd logins' },
  { path: '/protocolo', module: 'protocolo', icon: '📋', label: 'Protocolo', group: 'comp', keywords: 'protocolo documentos processos prazos calendario' },
  { path: '/notificacoes', module: 'notificacoes', icon: '🔔', label: 'Notificações', group: 'hidden', keywords: 'notificacoes alertas central avisos' },
  { path: '/perfil', module: 'perfil', icon: '👤', label: 'Meus Dados (Perfil)', group: 'hidden', keywords: 'perfil meus dados telefone email aniversario senha tema' }
];

export const GROUPS = [
  { key: 'main', label: 'Sistemas & Gestão' },
  { key: 'comp', label: 'Módulos Complementares' }
];
const GROUP_LABEL = { main: 'Sistemas & Gestão', comp: 'Complementares', hidden: 'Pessoal' };

const byLabel = (a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' });

/** Itens do menu por grupo, filtrados pelo acesso; Painel sempre primeiro. */
export function menu(can) {
  return GROUPS.map((g) => ({
    ...g,
    items: SCREENS.filter((s) => s.group === g.key && can(s.module)).sort((a, b) => (a.path === '/painel' ? -1 : b.path === '/painel' ? 1 : byLabel(a, b)))
  })).filter((g) => g.items.length);
}

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca global: nome e palavras-chave, sem acentos. */
export function searchScreens(q, can) {
  const k = norm(q.trim());
  if (!k) return [];
  return SCREENS.filter((s) => can(s.module) && norm(s.label + ' ' + s.keywords).includes(k)).slice(0, 6).map((s) => ({ ...s, groupLabel: GROUP_LABEL[s.group] }));
}

const ORDER = ['/painel', '/analytics', '/compras', '/almoxarifado', '/patrimonio', '/protocolo', '/mocoes', '/perfil'];
/** Primeira tela permitida para o usuário após o login. */
export function homePath(can) {
  const s = ORDER.find((p) => { const x = SCREENS.find((y) => y.path === p); return x && can(x.module); });
  return s || '/perfil';
}

export const screenByPath = (path) => SCREENS.find((s) => path === s.path || path.startsWith(s.path + '/'));

/** Caminho interno seguro para redirecionar (evita open redirect: //host, /\host, esquemas). */
export function safePath(p) {
  const s = String(p || '');
  if (!/^\/(?![/\\])[^\\\s]*$/.test(s)) return null;
  return screenByPath(s.split(/[?#]/)[0]) || s === '/' ? s : null;
}
