/**
 * Calendário integrado e prazos críticos (portado de design/calendar-feed.js).
 * Cada módulo publica seus eventos; o usuário só recebe os módulos a que tem acesso.
 */
const config = require('./config');
const { today, addDays } = require('../lib/dates');

/** Fontes do calendário. `pending` lista itens sem data ("a agendar"). */
const SOURCES = [
  { key: 'protocolo', label: 'Protocolo', color: '#1C543A', href: '/protocolo', events: () => require('./protocolo').calendarEvents(), alerts: () => require('./protocolo').alerts() },
  { key: 'compras', label: 'Compras & Licitações', color: '#2563EB', href: '/compras', cfg: 'prot.calCompras', events: () => require('./compras').calendarEvents(), alerts: () => require('./compras').alerts() },
  { key: 'rh', label: 'Gestão de Pessoal', color: '#B45309', href: '/pessoal', cfg: 'prot.calPessoal', events: async () => (await require('../routes/pessoal').feed()).events, alerts: async () => (await require('../routes/pessoal').feed()).alerts },
  { key: 'mocoes', label: 'Moções & Homenagens', color: '#7C3AED', href: '/mocoes', cfg: 'prot.calMocoes', events: () => optional('./mocoes', 'calendarEvents'), alerts: () => optional('./mocoes', 'alerts'), pending: () => optional('./mocoes', 'pendingItems') },
  { key: 'almoxarifado', label: 'Almoxarifado', color: '#0F766E', href: '/almoxarifado', cfg: 'prot.calAlmox', events: () => require('./estoque').calendarEvents(), alerts: () => require('./estoque').alerts() },
  { key: 'patrimonio', label: 'Patrimônio', color: '#6B7280', href: '/patrimonio', events: () => require('./patrimonio').calendarEvents(), alerts: () => require('./patrimonio').alerts() }
];

/** Módulo ainda não implantado devolve lista vazia. */
async function optional(mod, fn) {
  let m;
  try { m = require(mod); } catch (e) { if (e.code === 'MODULE_NOT_FOUND') return []; throw e; }
  return m[fn] ? m[fn]() : [];
}

const visible = (modules) => SOURCES.filter((s) => modules.includes(s.key));

/** Eventos do calendário por módulo visível ao usuário. */
async function calendar(modules) {
  const cfg = await config.snapshot();
  const srcs = visible(modules);
  const lists = await Promise.all(srcs.map((s) => s.events()));
  const events = [];
  srcs.forEach((s, i) => lists[i].forEach((e) => { if (e.start) events.push({ ...e, end: e.end || e.start, module: s.key, moduleLabel: s.label, color: s.color, href: e.href || s.href }); }));
  return {
    modules: srcs.map((s) => ({ key: s.key, label: s.label, color: s.color, count: events.filter((e) => e.module === s.key).length, on: s.cfg ? cfg(s.cfg) !== false : true })),
    events
  };
}

/** Prazos críticos: vencido, urgente (janela curta), próximo (janela longa) e "a agendar". */
async function critical(modules) {
  const cfg = await config.snapshot();
  const hoje = today(), j7 = addDays(hoje, cfg('painel.janelaUrgente')), j30 = addDays(hoje, cfg('painel.janelaProxima'));
  const { events } = await calendar(modules);
  const rows = [];
  events.forEach((e) => {
    let bucket = null;
    if (e.deadline && e.end < hoje) bucket = 'vencido';
    else if (e.start >= hoje && e.start <= j7) bucket = 'urgente';
    else if (e.start > j7 && e.start <= j30) bucket = 'proximo';
    if (bucket) rows.push({ title: e.title, date: bucket === 'vencido' ? e.end : e.start, bucket, level: e.level, module: e.module, moduleLabel: e.moduleLabel, color: e.color, href: e.href, own: !!e.own, ref: e.ref || null });
  });
  const order = { vencido: 0, urgente: 1, proximo: 2 };
  rows.sort((a, b) => order[a.bucket] - order[b.bucket] || a.date.localeCompare(b.date));
  let pend = [];
  if (cfg('mocoes.listarSemData') !== false) {
    for (const s of visible(modules).filter((x) => x.pending)) {
      (await s.pending()).forEach((p) => pend.push({ title: p.title, date: '', bucket: 'agendar', level: 'warning', module: s.key, moduleLabel: s.label, color: s.color, href: p.href || s.href, own: false, ref: null }));
    }
  }
  return { janelaUrgente: cfg('painel.janelaUrgente'), janelaProxima: cfg('painel.janelaProxima'), rows: rows.concat(pend) };
}

/** Alertas de todos os módulos visíveis (Painel e Central de Notificações). */
async function alerts(modules) {
  const lists = await Promise.all(visible(modules).map((s) => s.alerts()));
  return lists.flat();
}

module.exports = { SOURCES, calendar, critical, alerts };
