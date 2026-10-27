(function(){
if (window.DAExercicio) return;
var KEY = 'DA_exercicio', ANOS = [2026, 2025, 2024];
function get() { var v = parseInt(localStorage.getItem(KEY), 10); return ANOS.indexOf(v) >= 0 ? v : ANOS[0]; }
window.DAExercicio = {
  anos: ANOS, get: get,
  set: function (ano) { ano = parseInt(ano, 10); if (ANOS.indexOf(ano) < 0) return; try { localStorage.setItem(KEY, String(ano)); } catch (e) {} window.dispatchEvent(new CustomEvent('exerciciochange', { detail: { ano: ano } })); }
};
window.addEventListener('storage', function (e) { if (e.key === KEY) window.dispatchEvent(new CustomEvent('exerciciochange', { detail: { ano: get() } })); });
})();
