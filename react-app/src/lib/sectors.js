const DEFAULTS = ['Diretoria Administrativa', 'Servi\u00e7o de Licita\u00e7\u00f5es e Contratos', 'Servi\u00e7o de Almoxarifado e Patrim\u00f4nio'];
const KEY = 'DA_sectors';

export function getSectors() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(s) && s.length) return s; } catch (e) {}
  return [...DEFAULTS];
}

export function addSector(name) {
  name = (name || '').trim();
  const s = getSectors();
  if (!name || s.includes(name)) return s;
  s.push(name);
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  window.dispatchEvent(new CustomEvent('sectorschange', { detail: { sectors: s } }));
  return s;
}
