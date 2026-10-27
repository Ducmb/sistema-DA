const KEY = 'DA_exercicio';
export const ANOS = [2026, 2025, 2024];
export function getExercicio() { const v = parseInt(localStorage.getItem(KEY), 10); return ANOS.includes(v) ? v : ANOS[0]; }
export function setExercicio(ano) { ano = parseInt(ano, 10); if (!ANOS.includes(ano)) return; try { localStorage.setItem(KEY, String(ano)); } catch (e) {} window.dispatchEvent(new CustomEvent('exerciciochange', { detail: { ano } })); }
if (typeof window !== 'undefined' && !window.DAExercicio) window.DAExercicio = { anos: ANOS, get: getExercicio, set: setExercicio };
