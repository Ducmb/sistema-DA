/** Formatação em pt-BR. */
export const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (v, d = 0) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (v, d = 0) => (Number(v || 0) * 100).toLocaleString('pt-BR', { maximumFractionDigits: d }) + '%';
/** AAAA-MM-DD → DD/MM/AAAA */
export const fmtDate = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
export const fmtDateTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
export const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const initials = (name) => {
  const p = String(name || '').replace(/^(Dr|Dra|Sr|Sra)\.?\s+/i, '').trim().split(/\s+/);
  return ((p[0] || '')[0] || '').toUpperCase() + (p.length > 1 ? (p[p.length - 1][0] || '').toUpperCase() : '');
};
/** Máscara dinâmica de telefone: (XX) XXXX-XXXX ou (XX) XXXXX-XXXX */
export function maskPhone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? '(' + d : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^\(\d{2}\)\s*\d{4,5}-\d{4}$/;

/** Prazo digitado: "dd/mm/aaaa", "aaaa-mm-dd" ou atalho "+X" (dias a partir de hoje) → AAAA-MM-DD ('' se inválido). */
export function parsePrazo(t) {
  t = String(t || '').trim();
  const pad = (n) => String(n).padStart(2, '0'), iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  let m = t.match(/^\+\s*(\d{1,4})(\s*dias?)?$/i);
  if (m) { const d = new Date(); d.setDate(d.getDate() + parseInt(m[1], 10)); return iso(d); }
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) { const d = new Date(+m[3], +m[2] - 1, +m[1]); return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? iso(d) : ''; }
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
}
