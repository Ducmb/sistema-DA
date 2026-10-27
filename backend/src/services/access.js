/**
 * Perfis, módulos e cálculo do acesso efetivo de um usuário.
 * Regra (portada de design/session.js + config.js):
 *  - Administrativo vê tudo.
 *  - Acesso dos demais perfis = matriz perfil × módulo (padrão abaixo, editável em Configurações).
 *  - Usuário com vários perfis recebe a soma dos módulos.
 *  - Permissão individual (Gestão de Pessoal › Usuários) prevalece sobre o perfil,
 *    exceto para Log e Auditoria e Configurações (sempre exclusivos do Administrativo).
 */
const db = require('../db');
const { ROLES } = require('./configSchema');

const MODULES = [
  ['dashboard', 'Painel de Controle'], ['perfil', 'Meus Dados (Perfil)'], ['notificacoes', 'Notificações'], ['legislacoes', 'Legislações'],
  ['almoxarifado', 'Almoxarifado'], ['analytics', 'Analytics & Relatórios'], ['compras', 'Compras & Licitações'], ['rh', 'Gestão de Pessoal'],
  ['mocoes', 'Moções & Homenagens'], ['patrimonio', 'Patrimônio'], ['protocolo', 'Protocolo'], ['auditoria', 'Log e Auditoria'], ['configuracoes', 'Configurações do Sistema']
];
const MODULE_KEYS = MODULES.map((m) => m[0]);
const MODULE_LABEL = Object.fromEntries(MODULES);
const ADMIN_ONLY = ['auditoria', 'configuracoes'];
// Módulos com chave individual na tela de Usuários & Permissões
const OVERRIDABLE = ['compras', 'protocolo', 'rh', 'almoxarifado', 'mocoes', 'patrimonio', 'analytics', 'legislacoes', 'notificacoes', 'dashboard'];

const BASE = ['dashboard', 'perfil', 'notificacoes', 'legislacoes'];
const DEFAULT_ACCESS = {
  Administrativo: MODULE_KEYS.slice(),
  Compras: BASE.concat(['mocoes', 'compras']),
  Almoxarifado: BASE.concat(['mocoes', 'almoxarifado']),
  'Patrimônio': BASE.concat(['patrimonio']),
  Gerenciamento: BASE.concat(['protocolo']),
  Visualizador: ['analytics', 'perfil']
};

/** Matriz efetiva perfil → módulos (com personalizações salvas). */
async function roleMatrix(client = db) {
  const [{ rows: custom }, { rows: rm }] = await Promise.all([
    client.query('SELECT role FROM role_modules_custom'),
    client.query('SELECT role, module FROM role_modules')
  ]);
  const customized = new Set(custom.map((r) => r.role));
  const out = {};
  ROLES.forEach((r) => {
    if (r === 'Administrativo') out[r] = MODULE_KEYS.slice();
    else if (customized.has(r)) out[r] = rm.filter((x) => x.role === r).map((x) => x.module);
    else out[r] = DEFAULT_ACCESS[r].slice();
  });
  return out;
}

/** Calcula os módulos permitidos a partir de perfis, overrides e matriz. */
function computeModules(roles, overrides, matrix) {
  if (roles.includes('Administrativo')) return MODULE_KEYS.slice();
  const set = new Set();
  roles.forEach((r) => (matrix[r] || []).forEach((m) => set.add(m)));
  ADMIN_ONLY.forEach((m) => set.delete(m));
  Object.entries(overrides || {}).forEach(([m, allowed]) => {
    if (ADMIN_ONLY.includes(m) || !MODULE_KEYS.includes(m)) return;
    if (allowed) set.add(m); else set.delete(m);
  });
  set.add('perfil'); // todo servidor acessa os próprios dados
  return MODULE_KEYS.filter((m) => set.has(m));
}

async function userAccess(userId, client = db) {
  const [{ rows: rr }, { rows: ov }, matrix] = await Promise.all([
    client.query('SELECT role FROM user_roles WHERE user_id = $1', [userId]),
    client.query('SELECT module, allowed FROM user_module_overrides WHERE user_id = $1', [userId]),
    roleMatrix(client)
  ]);
  const roles = sortRoles(rr.map((r) => r.role));
  const overrides = Object.fromEntries(ov.map((o) => [o.module, o.allowed]));
  return { roles, overrides, modules: computeModules(roles, overrides, matrix), isAdmin: roles.includes('Administrativo') };
}

const sortRoles = (roles) => ROLES.filter((r) => roles.includes(r));
/** Perfil "principal" exibido (Administrativo tem precedência). */
const primaryRole = (roles) => (roles.includes('Administrativo') ? 'Administrativo' : roles[0] || 'Visualizador');

module.exports = { MODULES, MODULE_KEYS, MODULE_LABEL, ADMIN_ONLY, OVERRIDABLE, DEFAULT_ACCESS, ROLES, roleMatrix, computeModules, userAccess, sortRoles, primaryRole };
