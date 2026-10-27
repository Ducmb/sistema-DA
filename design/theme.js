(function(){
if (window.__themeLoaded) return; window.__themeLoaded = true;
// Tema por usuário: a preferência fica salva no navegador, com a chave do usuário logado.
var PREFIX = 'DA_theme_user_';
function user() { try { var s = JSON.parse(sessionStorage.getItem('DA_session')); return s && (s.userId || s.name) ? String(s.userId || s.name) : ''; } catch (e) { return ''; } }
var DEVICE = 'DA_theme_device';
function devicePref() { try { var v = localStorage.getItem(DEVICE); if (v === 'dark' || v === 'light') return v; } catch (e) {} return 'light'; }
// Usuário logado: usa a própria escolha; sem escolha salva, herda a da tela de login deste computador.
function getPref() { var u = user(); if (u) { try { var v = localStorage.getItem(PREFIX + u); if (v === 'dark' || v === 'light') return v; } catch (e) {} } return devicePref(); }
function rgb(h) { h = h.replace('#', ''); return 'rgb(' + parseInt(h.slice(0, 2), 16) + ', ' + parseInt(h.slice(2, 4), 16) + ', ' + parseInt(h.slice(4, 6), 16) + ')'; }
var D = 'html[data-theme="dark"] ';
var BG = [
  [['FFFFFF'], '#1A1F23'],
  [['F9F9F9', 'F5F5F5', 'FAFAFA', 'F4F4F2', 'F0F0F0', 'EDEDEB', 'F7F9F8', 'FCFCFB', 'FAFAF9', 'F7F7F5', 'F0F0EE', 'FAFAF8', 'F7F7F6', 'F9F9F7', 'F4F4F4', 'EEEEEE', 'F8F8F8'], '#222A2F'],
  [['E8E8E8', 'E8E8E6', 'E0E0E0', 'D9D9D9', 'D8D8D4', 'E0E0DE'], '#39434A'],
  [['CCCCCC', 'B8C7BF'], '#3A4247'],
  [['EAF3EE', 'F2F7F4', 'F4F9F6', 'F0FDF4', 'F7FBF9', 'FAFCFB', 'EAF7EF', 'DCFCE7'], '#173326'],
  [['FDF3F2', 'FEF2F2', 'FEE2E2', 'FEE'], '#3A1F22'],
  [['FDF8EC', 'FEF3C7', 'FFFBF3', 'FFFBEB', 'FFFBF0', 'FDF0D5', 'FEF9C3'], '#362C14'],
  [['EFF6FF', 'EEF4FD', 'F0F6FD', 'DBEAFE', 'DCEAFE'], '#1A2840'],
  [['F3EEFD', 'EDE9FE'], '#2A2240'],
  // CTA e destaques verdes: tom mais claro que mantém 5:1 com texto branco e 3:1 contra o fundo
  [['1C543A'], '#2E7D55'],
  [['164530', '153A2E', '2E6B4E'], '#276B49']
];
var TX = [
  [['1D1D1B', '333333', '1A1A1A'], '#E8ECEA'],
  [['444444', '555555'], '#CBD1CE'],
  [['666666', '777777'], '#AEB5B1'],
  [['999999', '888888'], '#959D99'],
  [['CCCCCC', 'B8C7BF'], '#6B736F'],
  [['1C543A', '164530', '153A2E', '166534', '2E6B4E'], '#86D9A8'],
  [['92400E', 'B45309', '78350F', 'A8834B'], '#F4C978'],
  [['B91C1C', '991B1B', '7F1D1D', 'DC2626', 'B45454', '933'], '#FFA3A0'],
  [['1E40AF', '2563EB', '1E3A8A', '6484B8', '3B82F6'], '#9DC0FA'],
  [['5B21B6', '7C3AED'], '#CBB4F8']
];
var BORDER = ['E8E8E8', 'E0E0E0', 'E0E0DE', 'E8E8E6', 'F0F0F0', 'F0F0EE', 'D0D0D0', 'EDEDEB', 'F4F4F2', 'CFE3D7', 'F3E6C7', 'F5C2C2', 'E5E5E5', 'DDDDDD'];
function hx(h) { return h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h; }
var css = [':root[data-theme="dark"] { color-scheme: dark; }', D + 'body { background-color: #111518 !important; color: #E8ECEA; }'];
BG.forEach(function (g) { css.push(g[0].map(function (h) { return D + '[style*="background-color: ' + rgb(hx(h)) + '"]'; }).join(',\n') + ' { background-color: ' + g[1] + ' !important; }'); });
TX.forEach(function (g) { var sel = []; g[0].forEach(function (h) { sel.push(D + '[style^="color: ' + rgb(hx(h)) + '"]', D + '[style*="; color: ' + rgb(hx(h)) + '"]'); }); css.push(sel.join(',\n') + ' { color: ' + g[1] + ' !important; }'); });
css.push(BORDER.map(function (h) { return D + '[style*="solid ' + rgb(h) + '"],\n' + D + '[style*="border-color: ' + rgb(h) + '"]'; }).join(',\n') + ' { border-color: #353E44 !important; }');
// Bordas verdes (foco, sublinhado de seção, botões secundários): visíveis no escuro
css.push(D + '[style*="solid rgb(28, 84, 58)"],\n' + D + '[style*="border-color: rgb(28, 84, 58)"] { border-color: #56B07F !important; }');
css.push(D + '[style*="solid rgb(243, 217, 164)"] { border-color: #8A6A2A !important; }');
css.push(D + '[style*="dashed rgb("] { border-color: #46515A !important; }');
// Texto sobre fundos saturados mantém a cor original (avatares e etiquetas amarelas)
css.push(D + '[style*="background-color: rgb(240, 180, 41)"], ' + D + '[style*="background-color: rgb(245, 158, 11)"] { color: #1D1D1B !important; }');
css.push(D + '[style*="background-color: rgb(220, 38, 38)"], ' + D + '[style*="background-color: rgb(59, 130, 246)"] { color: #FFFFFF !important; }');
// Superfícies translúcidas
css.push(['0.6', '0.7', '0.75', '0.8', '0.85', '0.9', '0.92', '0.94', '0.95', '0.96', '0.97', '0.98'].map(function (a) { return D + '[style*="background-color: rgba(255, 255, 255, ' + a + ')"]'; }).join(',\n') + ' { background-color: rgba(26, 31, 35, 0.94) !important; }');
css.push(D + '[style*="color: rgba(29, 29, 27"] { color: rgba(232, 236, 234, 0.7) !important; }');
css.push(D + '[style*="background-color: rgba(0, 0, 0, 0.5)"] { background-color: rgba(0, 0, 0, 0.68) !important; }');
// Página e áreas principais
css.push(D + 'main[style*="background-color"],\n' + D + '[style*="min-height: 100vh"][style*="background-color"] { background-color: #111518 !important; }');
// Menu lateral
css.push(D + 'aside[style*="background-color"] { background-color: #0F2D20 !important; border-right: 1px solid #1E3F30; }');
css.push(D + 'aside a[aria-current="page"] { background-color: rgba(134, 217, 168, 0.16) !important; color: #A9E8C4 !important; box-shadow: inset 3px 0 0 #86D9A8; }');
css.push(D + 'aside a[aria-current="page"] span { color: inherit !important; }');
// Formulários e foco visível
css.push(D + 'input, ' + D + 'select, ' + D + 'textarea { color: #E8ECEA; caret-color: #86D9A8; }');
css.push(D + 'input::placeholder, ' + D + 'textarea::placeholder { color: #8E9692; opacity: 1; }');
css.push(D + 'input:disabled, ' + D + 'select:disabled, ' + D + 'textarea:disabled, ' + D + 'button:disabled { opacity: 0.55; }');
css.push(D + 'option { background-color: #1A1F23; color: #E8ECEA; }');
css.push(D + '[style*="accent-color"], ' + D + 'input[type="checkbox"], ' + D + 'input[type="radio"], ' + D + 'input[type="range"], ' + D + 'progress { accent-color: #56B07F !important; }');
css.push(D + ':focus-visible { outline: 2px solid #86D9A8 !important; outline-offset: 2px; }');
css.push(D + 'a:not([style]) { color: #86D9A8; } ' + D + 'a:not([style]):hover { color: #A9E8C4; }');
css.push(D + 'table, ' + D + 'th, ' + D + 'td { border-color: #353E44; }');
css.push(D + '::selection { background-color: rgba(134, 217, 168, 0.35); color: #FFFFFF; }');
// Sombras mais densas, sem halo claro
css.push(D + '[style*="box-shadow: 0"] { box-shadow: 0 1px 2px rgba(0,0,0,0.5), 0 6px 18px rgba(0,0,0,0.35) !important; }');
// Gráficos SVG
css.push(D + 'svg [stroke="#1C543A"], ' + D + 'svg [stroke="#1c543a"] { stroke: #5FC08C; } ' + D + 'svg [fill="#1C543A"], ' + D + 'svg [fill="#1c543a"] { fill: #3E9A6C; }');
css.push(D + 'svg [stop-color="#1C543A"] { stop-color: #5FC08C; }');
css.push(D + 'svg [stroke="#E8E8E8"], ' + D + 'svg [stroke="#EDEDEB"], ' + D + 'svg [stroke="#F0F0F0"], ' + D + 'svg [stroke="#E0E0E0"] { stroke: #353E44; }');
css.push(D + 'svg [fill="#1D1D1B"] { fill: #E8ECEA; } ' + D + 'svg [fill="#666666"], ' + D + 'svg [fill="#999999"] { fill: #AEB5B1; } ' + D + 'svg [fill="#FFFFFF"] { fill: #1A1F23; }');
var styleEl = null;
function ensureCss() { if (styleEl) return; styleEl = document.createElement('style'); styleEl.id = 'da-dark-theme'; styleEl.textContent = css.join('\n'); (document.head || document.documentElement).appendChild(styleEl); }
function apply(t) { ensureCss(); document.documentElement.setAttribute('data-theme', t); try { document.documentElement.style.colorScheme = t; } catch (e) {} }
function setTheme(t) {
  if (t !== 'dark' && t !== 'light') return;
  var u = user();
  try { localStorage.setItem(u ? PREFIX + u : DEVICE, t); } catch (e) {}
  apply(t);
  if (window.DAAudit && u) window.DAAudit.log('Tema alterado', 'perfil', t === 'dark' ? 'Modo escuro' : 'Modo padrão');
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } }));
}
window.theme = {
  getCurrent: getPref,
  get current() { return getPref(); },
  isDark: function () { return getPref() === 'dark'; },
  set: setTheme,
  toggle: function () { setTheme(getPref() === 'dark' ? 'light' : 'dark'); },
  init: function () { apply(getPref()); }
};
apply(getPref());
// Outro usuário pode entrar em outra aba: reaplica quando a sessão ou a preferência mudam
window.addEventListener('storage', function (e) { if (!e.key || e.key.indexOf(PREFIX) === 0 || e.key === DEVICE) apply(getPref()); });
window.addEventListener('focus', function () { apply(getPref()); });
})();
