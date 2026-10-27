(function(){
if (window.DAVereadores) return;
// Cadastro único de vereadores (autores de moções, homenagens, arranjos e bandeiras)
var KEY = 'DA_vereadores_v1';
var SEED = ['Márcio Teixeira', 'Beatriz Lopes', 'Fernando Souza', 'Helena Duarte', 'Natalino', 'Marcos Antonio de Souza', 'Arnaldo Ribeiro', 'Hélio Venâncio', 'Julio Cesar', 'André Maldonado', 'Borgo', 'Edmilson Marinho da Silva Júnior'];
function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function load() { try { var s = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(s) && s.length) return s; } catch (e) {} return SEED.slice(); }
function save(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {} window.dispatchEvent(new CustomEvent('vereadoreschange')); }
window.DAVereadores = {
  all: function () { return load().slice().sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }); },
  merge: function (names) { var l = load(), ch = false; (names || []).forEach(function (n) { if (n && !l.some(function (x) { return norm(x) === norm(n); })) { l.push(n); ch = true; } }); if (ch) save(l); return l; },
  match: function (n) { var k = norm(n); return load().find(function (x) { return norm(x) === k; }) || ''; },
  norm: norm
};
})();
