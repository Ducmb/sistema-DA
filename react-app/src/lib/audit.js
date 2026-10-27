import { getSession } from './session.js';
const KEY = 'DA_audit_v1';
export function listAudit() { try { const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
export function logAudit(action, module, detail = '', level = 'info') {
  const s = getSession(); const a = listAudit();
  a.unshift({ id: 'A' + Date.now() + Math.floor(Math.random() * 1000), ts: new Date().toISOString().slice(0, 19), user: (s && s.name) || 'desconhecido', role: (s && s.role) || '\u2014', action, module, detail, level, device: /Mobi/.test(navigator.userAgent) ? 'Celular' : 'Navegador' });
  try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 500))); } catch (e) {}
  window.dispatchEvent(new CustomEvent('auditchange'));
}
if (typeof window !== 'undefined' && !window.DAAudit) window.DAAudit = { list: listAudit, log: logAudit };
