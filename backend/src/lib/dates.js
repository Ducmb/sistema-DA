/**
 * Datas de calendário (AAAA-MM-DD) no fuso de Brasília. TODAY_OVERRIDE fixa o "hoje" em testes.
 */
const TZ = 'America/Sao_Paulo';

function today() {
  if (process.env.TODAY_OVERRIDE) return process.env.TODAY_OVERRIDE;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
const toDate = (iso) => new Date(iso + 'T12:00:00Z');
const fromDate = (d) => d.toISOString().slice(0, 10);

function addDays(iso, n) { const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return fromDate(d); }
function addMonths(iso, n) { const d = toDate(iso); d.setUTCMonth(d.getUTCMonth() + n); return fromDate(d); }
const isWeekend = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/** Soma n dias úteis (seg–sex). */
function addBiz(iso, n) {
  const d = toDate(iso); let k = 0;
  while (k < n) { d.setUTCDate(d.getUTCDate() + 1); if (!isWeekend(d)) k++; }
  return fromDate(d);
}

/** Dias úteis decorridos de fromIso até toIso (padrão: hoje). */
function bizDays(fromIso, toIso) {
  if (!fromIso) return 0;
  const a = toDate(fromIso), b = toDate(toIso || today()); let n = 0;
  while (a < b) { a.setUTCDate(a.getUTCDate() + 1); if (!isWeekend(a)) n++; }
  return n;
}

/** Diferença em dias corridos (iso − hoje). */
function daysTo(iso, from) { return Math.round((toDate(iso) - toDate(from || today())) / 864e5); }

const fmtBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const brToIso = (s) => { const p = String(s || '').split('/'); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : s; };
const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const year = (iso) => (iso ? +String(iso).slice(0, 4) : 0);

module.exports = { today, addDays, addMonths, addBiz, bizDays, daysTo, fmtBR, brToIso, brl, year, toDate, fromDate };
