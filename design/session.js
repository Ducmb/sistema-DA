(function(){
if (window.DASession) return;
var KEY = 'DA_session';
function IDLE() { var m = 30; try { var c = JSON.parse(localStorage.getItem('DA_config_v1')); if (c && c.values && +c.values['geral.sessaoMin'] > 0) m = +c.values['geral.sessaoMin']; } catch (e) {} return m * 60 * 1000; }
var PAGES = { 'Dashboard.dc.html': 'dashboard', 'UserManagement.dc.html': 'usuarios', 'UserProfile.dc.html': 'perfil', 'MocoesHomenagens.dc.html': 'mocoes', 'AlmoxarifadoAmostragem.dc.html': 'almoxarifado', 'PatrimonioModule.dc.html': 'patrimonio', 'ComprasModule.dc.html': 'compras', 'ProtocoloModule.dc.html': 'protocolo', 'RHModule.dc.html': 'rh', 'InventoryModule.dc.html': 'inventario', 'NotificationsModule.dc.html': 'notificacoes', 'AnalyticsModule.dc.html': 'analytics' };
PAGES['AuditLog.dc.html'] = 'auditoria';
PAGES['Legislacoes.dc.html'] = 'legislacoes';
PAGES['Configuracoes.dc.html'] = 'configuracoes';
var ALL = Object.keys(PAGES).map(function (k) { return PAGES[k]; });
var BASE = ['dashboard', 'perfil', 'notificacoes', 'legislacoes'];
var ACCESS = {
  'Administrativo': ALL,
  'Compras': BASE.concat(['mocoes', 'compras']),
  'Almoxarifado': BASE.concat(['mocoes', 'almoxarifado']),
  'Patrimônio': BASE.concat(['patrimonio']),
  'Gerenciamento': BASE.concat(['protocolo']),
  'Visualizador': ['analytics', 'perfil']
};
var LEGACY = { 'Operacional': 'Almoxarifado', 'Vereador': 'Gerenciamento' };
function roleOf(r) { return LEGACY[r] || r; }
function accessFor(role) {
  role = roleOf(role); if (role === 'Administrativo') return ALL;
  try { var c = JSON.parse(localStorage.getItem('DA_config_v1')); if (c && c.access && Array.isArray(c.access[role])) return c.access[role]; } catch (e) {}
  return ACCESS[role] || [];
}
var ORDER = ['Dashboard.dc.html', 'AnalyticsModule.dc.html', 'ComprasModule.dc.html', 'AlmoxarifadoAmostragem.dc.html', 'PatrimonioModule.dc.html', 'ProtocoloModule.dc.html', 'MocoesHomenagens.dc.html', 'UserProfile.dc.html'];
function read() { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { return null; } }
function valid(s) { return !!(s && s.token && s.role && (Date.now() - (s.lastActivity || 0)) < IDLE()); }
var S = {
  start: function (user, token) { sessionStorage.setItem(KEY, JSON.stringify({ userId: user.id, name: user.name, role: user.role, email: user.email, token: token, lastActivity: Date.now() })); window.DAAudit.log('Login', 'auth', 'Acesso ao sistema'); },
  get: function () { var s = read(); return valid(s) ? s : null; },
  token: function () { var s = S.get(); return s ? s.token : ''; },
  can: function (mod) { var s = S.get(); if (!s) return false;
    var key = mod === 'inventario' ? 'almoxarifado' : mod, ov = null;
    try { ov = (JSON.parse(localStorage.getItem('DA_user_access')) || {})[s.name]; } catch (e) {}
    if (ov && Object.prototype.hasOwnProperty.call(ov, key) && key !== 'configuracoes' && key !== 'auditoria') return !!ov[key];
    return accessFor(s.role).indexOf(key) >= 0; },
  home: function () { for (var i = 0; i < ORDER.length; i++) { if (S.canPage(ORDER[i])) return ORDER[i]; } return 'UserProfile.dc.html'; },
  role: function () { var s = S.get(); return s ? roleOf(s.role) : ''; },
  ROLES: ['Administrativo', 'Compras', 'Almoxarifado', 'Patrimônio', 'Gerenciamento', 'Visualizador'],
  overrides: function () { try { return JSON.parse(localStorage.getItem('DA_user_access')) || {}; } catch (e) { return {}; } },
  canPage: function (file) { var m = PAGES[file]; return !m || S.can(m); },
  logout: function (motivo) { if (read()) window.DAAudit.log(motivo === 'expirada' ? 'Sessão expirada' : 'Logout', 'auth', motivo === 'expirada' ? 'Inatividade de 30 min' : 'Saída manual'); sessionStorage.removeItem(KEY); location.href = 'Login.dc.html' + (motivo ? '?motivo=' + motivo : ''); }
};
window.DASession = S;
var AKEY = 'DA_audit_v1';
var SEED = [
  ['2026-10-15T08:02:11', 'Dr. Roberto Alencar', 'Administrativo', 'Login', 'auth', 'Acesso ao sistema', 'info'],
  ['2026-10-15T08:05:40', 'Dr. Roberto Alencar', 'Administrativo', 'Acesso Concedido', 'usuarios', 'Carlos Eduardo Costa · Módulo de RH', 'info'],
  ['2026-10-14T17:21:09', 'Ana Beatriz Silva', 'Operacional', 'Acesso negado', 'rh', 'Tentativa de abrir Recursos Humanos', 'warning'],
  ['2026-10-14T16:48:33', 'desconhecido', '—', 'Falha de login', 'auth', 'Usuário: suporte', 'warning'],
  ['2026-10-14T16:48:51', 'desconhecido', '—', 'Falha de login', 'auth', 'Usuário: suporte', 'warning'],
  ['2026-10-14T15:10:02', 'Ana Beatriz Silva', 'Operacional', 'Etapa marcada para refazer', 'compras', 'Processo 2112/2026 · Pesquisa de preços', 'warning'],
  ['2026-10-14T11:32:47', 'Dr. Roberto Alencar', 'Administrativo', 'Usuário Criado', 'usuarios', 'Patricia de Souza · Perfil: Usuário', 'info'],
  ['2026-10-13T18:00:00', 'Ana Beatriz Silva', 'Operacional', 'Sessão expirada', 'auth', 'Inatividade de 30 min', 'info'],
  ['2026-10-13T14:12:19', 'Dr. Roberto Alencar', 'Administrativo', 'Leitura de dados pessoais', 'rh', 'Lista de servidores (LGPD)', 'info'],
  ['2026-10-13T09:44:05', 'Dr. Roberto Alencar', 'Administrativo', 'Acesso Revogado', 'usuarios', 'Ana Beatriz Silva · Módulo de Compras', 'critical']
].map(function (r, i) { return { id: 'A' + (i + 1), ts: r[0], user: r[1], role: r[2], action: r[3], module: r[4], detail: r[5], level: r[6], device: 'Navegador' }; });
function aread() { try { var a = JSON.parse(localStorage.getItem(AKEY)); if (Array.isArray(a)) return a; } catch (e) {} return SEED.slice(); }
window.DAAudit = {
  list: aread,
  log: function (action, module, detail, level, who) {
    var s0 = read(); var a = aread();
    a.unshift({ id: 'A' + Date.now() + Math.floor(Math.random() * 1000), ts: new Date().toISOString().slice(0, 19), user: who || (s0 && s0.name) || 'desconhecido', role: (s0 && s0.role) || '—', action: action, module: module, detail: detail || '', level: level || 'info', device: /Mobi/.test(navigator.userAgent) ? 'Celular' : 'Navegador' });
    try { localStorage.setItem(AKEY, JSON.stringify(a.slice(0, (function () { try { var c = JSON.parse(localStorage.getItem('DA_config_v1')); return (c && c.values && +c.values['audit.maxRegistros']) || 500; } catch (e) { return 500; } })()))); } catch (e) {}
    window.dispatchEvent(new CustomEvent('auditchange'));
  }
};
var file = decodeURIComponent(location.pathname.split('/').pop() || ''), mod = PAGES[file];
if (!mod) return;
var s = read();
if (!valid(s)) { sessionStorage.removeItem(KEY); location.replace('Login.dc.html?motivo=' + (s ? 'expirada' : 'login')); return; }
if (!S.can(mod)) { window.DAAudit.log('Acesso negado', mod, 'Tentativa de abrir ' + file, 'warning'); var h = S.home(); location.replace((h === file ? 'UserProfile.dc.html' : h) + '?negado=' + mod); return; }
var last = 0;
function touch() { var n = Date.now(); if (n - last < 15000) return; last = n; var x = read(); if (x) { x.lastActivity = n; sessionStorage.setItem(KEY, JSON.stringify(x)); } }
['click', 'keydown', 'pointermove', 'scroll', 'touchstart'].forEach(function (e) { addEventListener(e, touch, { passive: true }); });
setInterval(function () { if (!valid(read())) S.logout('expirada'); }, 30000);
function filterLinks() { document.querySelectorAll('a[href]').forEach(function (a) { var f = (a.getAttribute('href') || '').split('?')[0].split('#')[0].split('/').pop(); if (PAGES[f] && !S.can(PAGES[f]) && a.style.display !== 'none') a.style.display = 'none'; }); }
function addLogout() {
  if (document.getElementById('da-logout') || document.querySelector('[data-da-logout]')) return;
  var existing = Array.prototype.filter.call(document.querySelectorAll('a[href="Login.dc.html"], button'), function (el) { return /Sair/.test(el.textContent || ''); });
  if (existing.length) { existing.forEach(function (el) { el.setAttribute('data-da-logout', '1'); el.addEventListener('click', function (ev) { ev.preventDefault(); S.logout(); }); }); return; }
  var aside = document.querySelector('aside'), qn = document.querySelector('nav[data-quick-nav]'), hd = document.querySelector('header');
  var host = aside || qn || hd; if (!host) return;
  var b = document.createElement('button'); b.id = 'da-logout'; b.type = 'button'; b.textContent = aside ? '⎋ Sair do sistema' : 'Sair';
  b.title = 'Encerrar sessão de ' + s.name; b.setAttribute('aria-label', 'Encerrar sessão');
  var base = 'height:44px;border-radius:8px;font:600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;flex-shrink:0;';
  b.setAttribute('data-da-logout', '1');
  if (aside) b.style.cssText = base + 'width:100%;margin-top:8px;padding:0 12px;text-align:left;border:1px solid rgba(255,255,255,0.25);background:transparent;color:#FFFFFF;';
  else b.style.cssText = base + 'margin-left:auto;padding:0 16px;border:1px solid rgba(255,255,255,0.4);background:transparent;color:#FFFFFF;';
  b.onmouseenter = function () { b.style.background = 'rgba(255,255,255,0.12)'; };
  b.onmouseleave = function () { b.style.background = 'transparent'; };
  b.onclick = function () { S.logout(); };
  host.appendChild(b);
}
function deniedToast() {
  var neg = new URLSearchParams(location.search).get('negado');
  if (!neg || document.getElementById('da-denied')) return;
  var n = { configuracoes: 'Configurações do Sistema', auditoria: 'Log e Auditoria', legislacoes: 'Legislações', notificacoes: 'Notificações', dashboard: 'Painel de Controle', usuarios: 'Usuários & Permissões', rh: 'Recursos Humanos', mocoes: 'Moções & Homenagens', almoxarifado: 'Almoxarifado', patrimonio: 'Patrimônio', compras: 'Compras', protocolo: 'Protocolo', inventario: 'Inventário', analytics: 'Analytics' }[neg] || neg;
  var d = document.createElement('div'); d.id = 'da-denied'; d.setAttribute('role', 'alert');
  d.textContent = 'Acesso negado: seu perfil (' + roleOf(s.role) + ') não tem permissão para ' + n + '.';
  d.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:100;max-width:calc(100% - 32px);background:#FDF3F2;color:#B91C1C;border:1px solid #F5C2C2;padding:12px 20px;border-radius:999px;font:600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.12);';
  document.body.appendChild(d);
  history.replaceState(null, '', location.pathname);
  setTimeout(function () { d.remove(); }, 5000);
}
var queued = false;
function run() { queued = false; filterLinks(); addLogout(); deniedToast(); }
function boot() { run(); new MutationObserver(function () { if (!queued) { queued = true; requestAnimationFrame(run); } }).observe(document.body, { childList: true, subtree: true }); }
if (document.body) boot(); else addEventListener('DOMContentLoaded', boot);
})();
