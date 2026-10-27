const KEY = 'DA_session';
const IDLE = 30 * 60 * 1000;
export const ROUTE_MOD = { '/dashboard': 'dashboard', '/usuarios': 'usuarios', '/perfil': 'perfil', '/mocoes': 'mocoes', '/almoxarifado': 'almoxarifado', '/patrimonio': 'patrimonio', '/compras': 'compras', '/compras/controle': 'compras', '/protocolo': 'protocolo', '/rh': 'rh', '/inventario': 'inventario', '/notificacoes': 'notificacoes', '/analytics': 'analytics', '/legislacoes': 'legislacoes' };
const ALL = Array.from(new Set(Object.values(ROUTE_MOD)));
const ACCESS = {
  Administrativo: ALL,
  Operacional: ['legislacoes', 'dashboard', 'perfil', 'notificacoes', 'almoxarifado', 'patrimonio', 'inventario', 'compras', 'protocolo'],
  Vereador: ['legislacoes', 'dashboard', 'perfil', 'notificacoes', 'mocoes', 'protocolo'],
  Visualizador: ['legislacoes', 'dashboard', 'perfil', 'notificacoes', 'analytics']
};
const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { return null; } };
const valid = (s) => !!(s && s.role && Date.now() - (s.lastActivity || 0) < IDLE);
export function startSession(user, token) { sessionStorage.setItem(KEY, JSON.stringify({ ...user, token, lastActivity: Date.now() })); }
export function getSession() { const s = read(); return valid(s) ? s : null; }
export function touchSession() { const s = read(); if (valid(s)) { s.lastActivity = Date.now(); sessionStorage.setItem(KEY, JSON.stringify(s)); } }
export function wasExpired() { const s = read(); return !!s && !valid(s); }
export function endSession() { sessionStorage.removeItem(KEY); }
export function getOverrides() { try { return JSON.parse(localStorage.getItem('DA_user_access')) || {}; } catch (e) { return {}; } }
export function can(mod) {
  const s = getSession(); if (!s) return false;
  const key = mod === 'inventario' ? 'almoxarifado' : mod; const ov = getOverrides()[s.name];
  if (ov && Object.prototype.hasOwnProperty.call(ov, key)) return !!ov[key];
  return (ACCESS[s.role] || []).includes(mod);
}
export function canPath(path) { const m = ROUTE_MOD[path]; return !m || can(m); }
