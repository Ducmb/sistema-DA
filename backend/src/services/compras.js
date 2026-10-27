/**
 * Regras de Compras & Licitações (portadas de design/liccont.js):
 * etapas dos processos, SLA, carga por agente, contratos (vigência, saldo, notas mensais),
 * acumulado por Classe CATMAT / Grupo CATSER x limites de dispensa, dotação, alertas e calendário.
 */
const db = require('../db');
const config = require('./config');
const { today, addDays, addBiz, bizDays, daysTo, fmtBR, brl, year } = require('../lib/dates');

const STAGES = [
  ['dfd', 'Recebimento DFD', 'interna'], ['conformidade', 'Conformidade', 'interna'], ['orcamento', 'Orçamento', 'interna'], ['pareceres', 'Pareceres', 'interna'], ['presidente', 'Presidente', 'interna'], ['arq_int', 'Arquivamento', 'interna'],
  ['inicial', 'Inicial', 'externa'], ['docs', 'Docs aprovados', 'externa'], ['reserva', 'Requisição de reserva', 'externa'], ['publicacoes', 'Publicações', 'externa'], ['pesquisa', 'Pesquisa de preços', 'externa'], ['mapa', 'Mapa de preços', 'externa'],
  ['habilitacao', 'Habilitação', 'externa'], ['fracionamento', 'Fracionamento', 'externa'], ['homologacao', 'Homologação', 'externa'], ['sol_empenho', 'Solicitação de empenho', 'externa'], ['nota_empenho', 'Nota de empenho', 'externa'], ['afos', 'AF/OS', 'externa'],
  ['confirmacao', 'Confirmação de compra', 'externa'], ['tcn', 'TCN', 'externa'], ['publicacao', 'Publicação', 'externa'], ['requisitante', 'Requisitante e Almoxarifado', 'externa'], ['patrimonio', 'Patrimônio', 'externa'], ['arq_ext', 'Arquivamento', 'externa']
].map((s, i) => ({ idx: i, key: s[0], label: s[1], fase: s[2] }));
const MODOS = ['Dispensa', 'Inexigibilidade', 'Licitação'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/* ---------------- Pessoas: agentes e chefia ---------------- */
/** Agentes de contratação: servidores ativos com perfil Compras e hierarquia Funcionário. */
async function agents() {
  const { rows } = await db.query(
    `SELECT u.id, u.name FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'Compras'
      WHERE u.status = 'active' AND u.situacao <> 'Desligado' AND u.hierarchy = 'Funcionário' ORDER BY u.name`);
  return rows;
}
/** Chefia de compras: Administrativo, ou acesso a Compras com hierarquia Chefia/Diretoria. */
const isChefia = (user) => !!user && (user.isAdmin || (user.modules.includes('compras') && ['Chefia', 'Diretoria'].includes(user.hierarchy)));
const canEdit = (p, user) => isChefia(user) || (!!p.agenteId && p.agenteId === user.id);

/* ---------------- Processos ---------------- */
async function loadProcesses(where = '', params = []) {
  const { rows: ps } = await db.query(
    `SELECT p.*, u.name AS agente FROM compras_processos p LEFT JOIN users u ON u.id = p.agente_id ${where} ORDER BY p.created_at DESC, p.id DESC`, params);
  if (!ps.length) return [];
  const { rows: et } = await db.query('SELECT e.*, u.name AS por_nome FROM compras_etapas e LEFT JOIN users u ON u.id = e.por WHERE processo_id = ANY($1) ORDER BY idx', [ps.map((p) => p.id)]);
  const byP = {};
  et.forEach((e) => { (byP[e.processo_id] = byP[e.processo_id] || [])[e.idx] = { s: e.status, since: e.since || undefined, date: e.data || undefined, just: e.justificativa || undefined, note: e.nota || undefined, by: e.por_nome || undefined }; });
  return ps.map((p) => ({
    id: p.id, interno: p.interno, externo: p.externo, objeto: p.objeto, modo: p.modo, setor: p.setor, valor: +p.valor,
    agenteId: p.agente_id, agente: p.agente || '', createdAt: p.created_at,
    stages: STAGES.map((s) => (byP[p.id] && byP[p.id][s.idx]) || { s: 'pend' })
  }));
}

function procInfo(p, sla) {
  const cur = p.stages.findIndex((s) => s.s === 'pend' || s.s === 'refazer');
  const done = p.stages.filter((s) => s.s === 'ok' || s.s === 'na').length;
  const st = cur >= 0 ? p.stages[cur] : null;
  const delay = st && st.s === 'pend' ? bizDays(st.since) : 0;
  return {
    current: cur, currentLabel: cur >= 0 ? STAGES[cur].label : 'Concluído', fase: cur >= 0 ? STAGES[cur].fase : 'concluido',
    done, pct: Math.round((done / STAGES.length) * 100), atrasado: delay > sla, delay,
    refazer: p.stages.some((s) => s.s === 'refazer'), concluido: cur < 0
  };
}

function loads(processes, agentList, sla) {
  return agentList.map((a) => {
    const ps = processes.filter((p) => p.agenteId === a.id);
    const infos = ps.map((p) => procInfo(p, sla));
    return { agenteId: a.id, agente: a.name, ativos: infos.filter((i) => !i.concluido).length, total: ps.length, atrasados: infos.filter((i) => i.atrasado).length };
  });
}
function suggestAgent(ls) {
  const l = ls.slice().sort((a, b) => a.ativos - b.ativos || a.total - b.total);
  return l[0] || null;
}

/* ---------------- Contratos ---------------- */
async function loadContracts() {
  const [{ rows: cs }, { rows: ns }, { rows: hs }] = await Promise.all([
    db.query('SELECT * FROM contratos ORDER BY fim, contratada'),
    db.query('SELECT * FROM contrato_notas'),
    db.query('SELECT * FROM contrato_historico')
  ]);
  return cs.map((c) => {
    const notas = {};
    ns.filter((n) => n.contrato_id === c.id).forEach((n) => { (notas[n.ano] = notas[n.ano] || new Array(12).fill(0))[n.mes] = +n.valor; });
    const hist = {};
    hs.filter((h) => h.contrato_id === c.id).forEach((h) => { hist[h.ano] = { assinatura: h.assinatura, inicio: h.inicio, fim: h.fim }; });
    return { id: c.id, contratada: c.contratada, contrato: c.contrato, processo: c.processo || '', aditamentos: c.aditamentos, assinatura: c.assinatura, fim: c.fim, empenhado: +c.empenhado, fornecedorId: c.fornecedor_id, notas, hist };
  });
}
const mensal = (c, ano) => c.notas[ano] || new Array(12).fill(0);
const inYear = (c, ano) => year(c.assinatura) <= ano && year(c.fim) >= ano;
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const lastDay = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** Meses (0–11) do exercício cuja NF já deveria ter chegado (ciclo mensal pela data de assinatura). */
function notasFaltantes(c, ano) {
  const hoje = today(), day = +c.assinatura.slice(8, 10), out = [], m12 = mensal(c, ano);
  for (let m = 0; m < 12; m++) {
    const ini = iso(ano, m, 1), fimMes = iso(ano, m, lastDay(ano, m));
    if (fimMes < c.assinatura || ini > c.fim) continue;
    const due = m === 11 ? iso(ano + 1, 0, Math.min(day, 28)) : iso(ano, m + 1, Math.min(day, 28));
    if (hoje > due && !(m12[m] > 0)) out.push(m);
  }
  return out;
}

function contractInfo(c, ano, cfg) {
  const gasto = mensal(c, ano).reduce((a, b) => a + (b || 0), 0);
  const saldo = c.empenhado - gasto, pct = c.empenhado ? saldo / c.empenhado : 0, dias = daysTo(c.fim);
  const av = cfg('compras.avisoAzul'), am = cfg('compras.avisoAmarelo'), vm = cfg('compras.avisoVermelho'), sm = cfg('compras.saldoMin') / 100;
  const level = dias < 0 ? 'vencido' : dias <= vm ? 'critical' : dias <= am ? 'warning' : dias <= av ? 'info' : 'ok';
  return { gasto, saldo, saldoPct: pct, saldoBaixo: pct < sm, dias, level };
}

/* ---------------- Despesas e limites legais ---------------- */
async function loadExpenses() {
  const [{ rows: ex }, { rows: vb }] = await Promise.all([
    db.query('SELECT d.*, c.contrato AS contrato_num FROM despesas d LEFT JOIN contratos c ON c.id = d.contrato_id ORDER BY d.data_empenho DESC, d.id DESC'),
    db.query('SELECT * FROM verbinha ORDER BY data')
  ]);
  return {
    expenses: ex.map((e) => ({
      id: e.id, processo: e.processo, catmat: e.catmat || '', classe: e.classe || '', catser: e.catser || '', grupo: e.grupo || '', objeto: e.objeto,
      descricao: e.descricao || '', reserva: e.reserva == null ? null : +e.reserva, data: e.data, modalidade: e.modalidade || '', empenhado: +e.empenhado,
      ficha: e.ficha || '', sub: e.sub || '', dataEmpenho: e.data_empenho, audesp: e.audesp, tcn: e.tcn, contratoId: e.contrato_id, contrato: e.contrato_num || ''
    })),
    verbinha: vb.map((v) => ({ id: v.id, origem: v.origem, classe: v.classe || '', grupo: v.grupo || '', data: v.data, valor: +v.valor }))
  };
}
const isEng = (e) => /^54/.test(e.grupo || '');
const expKey = (e) => (e.classe ? 'CATMAT classe ' + e.classe : e.grupo ? 'CATSER grupo ' + e.grupo : '');
const legal = (cfg) => ({ compras: cfg('compras.limCompras'), engenharia: cfg('compras.limEng'), fonte: cfg('compras.fonteLimites'), atencao: cfg('compras.limAtencao') / 100 });

/** Acumulado da Classe/Grupo no exercício até a data do empenho (despesas + verbinha). */
function accumulated(e, data, cfg, at) {
  const k = expKey(e); if (!k) return null;
  const L = legal(cfg), lim = isEng(e) ? L.engenharia : L.compras;
  const when = at || e.dataEmpenho || e.data, y = year(when);
  const s = data.expenses.filter((x) => expKey(x) === k && (x.dataEmpenho || x.data) <= when && year(x.dataEmpenho || x.data) === y).reduce((a, x) => a + x.empenhado, 0);
  const v = data.verbinha.filter((x) => (e.classe && x.classe === e.classe) || (e.grupo && x.grupo === e.grupo)).filter((x) => x.data <= when && year(x.data) === y).reduce((a, x) => a + x.valor, 0);
  return { chave: k, despesas: s, verbinha: v, total: s + v, limite: lim, pct: (s + v) / lim, eng: isEng(e) };
}

/* ---------------- Dotação ---------------- */
function dotacaoInfo(d, expenses) {
  const itens = expenses.filter((x) => (x.ficha || '—') === d.ficha && (x.sub || '—') === d.sub && year(x.dataEmpenho || x.data) === d.ano);
  const emp = itens.reduce((a, x) => a + x.empenhado, 0);
  return { itens, empenhado: emp, saldo: d.orcado - emp, pct: d.orcado ? emp / d.orcado : 0 };
}

/* ---------------- Alertas (Painel e Notificações) ---------------- */
async function alerts() {
  const cfg = await config.snapshot();
  const sla = cfg('compras.sla'), ano = year(today());
  const [procs, contracts, data] = await Promise.all([loadProcesses(), loadContracts(), loadExpenses()]);
  const out = [];
  procs.forEach((p) => {
    const info = procInfo(p, sla), href = '/compras?tab=processos&proc=' + p.id;
    p.stages.forEach((s, i) => { if (s.s === 'refazer') out.push({ id: `lic-ref-${p.id}-${i}`, module: 'compras', category: 'COMPRAS', level: 'warning', title: 'Refazer: ' + STAGES[i].label + ' — ' + p.interno, description: p.objeto + ' · ' + (s.just || 'sem justificativa'), href }); });
    if (info.atrasado) out.push({ id: 'lic-sla-' + p.id, module: 'compras', category: 'COMPRAS', level: 'warning', title: 'Etapa parada há ' + info.delay + ' dias úteis — ' + p.interno, description: info.currentLabel + ' · ' + (p.agente || 'sem agente'), href });
  });
  contracts.filter((c) => inYear(c, ano)).forEach((c) => {
    const href = '/compras?tab=contratos&contrato=' + c.id;
    const nf = notasFaltantes(c, ano);
    if (nf.length) out.push({ id: 'lic-nf-' + c.id, module: 'compras', category: 'CONTRATOS', level: 'warning', title: nf.length + ' nota(s) fiscal(is) não recebida(s) — ' + c.contrato, description: c.contratada + ' · ciclo mensal desde ' + fmtBR(c.assinatura), href });
  });
  data.expenses.forEach((e) => {
    if (e.tcn === '' && e.dataEmpenho && bizDays(e.dataEmpenho) > cfg('compras.tcnPrazo')) out.push({ id: 'lic-tcn-' + e.id, module: 'compras', category: 'COMPRAS', level: 'warning', title: 'TCN pendente — processo ' + e.processo, description: e.objeto + ' · empenho em ' + fmtBR(e.dataEmpenho), href: '/compras?tab=limits' });
  });
  contracts.forEach((c) => {
    const ci = contractInfo(c, ano, cfg), href = '/compras?tab=contratos&contrato=' + c.id;
    if (ci.level !== 'ok' && ci.dias >= -365) out.push({ id: 'lic-fim-' + c.id, module: 'compras', category: 'CONTRATOS', level: ci.level === 'vencido' ? 'critical' : ci.level, title: 'Contrato ' + c.contrato + (ci.dias < 0 ? ' vencido' : ' vence em ' + ci.dias + ' dias'), description: c.contratada + ' · fim ' + fmtBR(c.fim), href });
    if (inYear(c, ano) && ci.dias >= 0 && ci.saldoBaixo) out.push({ id: 'lic-saldo-' + c.id, module: 'compras', category: 'CONTRATOS', level: 'warning', title: `Saldo de empenho abaixo de ${cfg('compras.saldoMin')}% — ` + c.contrato, description: c.contratada + ' · saldo ' + brl(ci.saldo), href });
  });
  return out;
}

/* ---------------- Calendário integrado ---------------- */
async function calendarEvents() {
  const cfg = await config.snapshot();
  const hoje = today(), ano = year(hoje), av = cfg('compras.avisoAzul'), am = cfg('compras.avisoAmarelo'), vm = cfg('compras.avisoVermelho'), tcn = cfg('compras.tcnPrazo'), N = cfg('compras.nfAtraso');
  const lim = addDays(hoje, cfg('painel.janelaProxima'));
  const [contracts, data] = await Promise.all([loadContracts(), loadExpenses()]);
  const ev = [];
  contracts.forEach((c) => {
    const ci = contractInfo(c, ano, cfg), href = '/compras?tab=contratos&contrato=' + c.id;
    ev.push({ title: 'Fim do contrato ' + c.contrato + ' — ' + c.contratada, start: c.fim, end: c.fim, level: ci.level === 'ok' ? 'info' : ci.level === 'vencido' ? 'critical' : ci.level, deadline: true, href });
    [[av, 'info'], [am, 'warning'], [vm, 'critical']].forEach(([d, lv]) => { const x = addDays(c.fim, -d); ev.push({ title: `Aviso de ${d} dias — contrato ${c.contrato} vence em ${fmtBR(c.fim)}`, start: x, end: x, level: lv, href }); });
    if (!inYear(c, ano)) return;
    const day = +c.assinatura.slice(8, 10), m12 = mensal(c, ano);
    for (let m = 0; m < 12; m++) {
      const ini = iso(ano, m, 1), fimMes = iso(ano, m, lastDay(ano, m));
      if (fimMes < c.assinatura || ini > c.fim || m12[m] > 0) continue;
      const due = m === 11 ? iso(ano + 1, 0, Math.min(day, 28)) : iso(ano, m + 1, Math.min(day, 28));
      if (due > lim) continue;
      ev.push({ title: `NF de ${MESES[m]} prevista — contrato ${c.contrato} (${c.contratada})`, start: due, end: due, level: due > hoje ? 'info' : bizDays(due) > N ? 'critical' : 'warning', deadline: true, href });
    }
  });
  data.expenses.forEach((e) => {
    if (e.tcn !== '' || !e.dataEmpenho) return;
    const due = addBiz(e.dataEmpenho, tcn);
    ev.push({ title: `Prazo do TCN — processo ${e.processo} (${e.objeto})`, start: due, end: due, level: due < hoje ? 'critical' : bizDays(hoje, due) <= 2 ? 'warning' : 'info', deadline: true, href: '/compras?tab=limits' });
  });
  return ev;
}

module.exports = {
  STAGES, MODOS, agents, isChefia, canEdit, loadProcesses, procInfo, loads, suggestAgent,
  loadContracts, mensal, inYear, notasFaltantes, contractInfo, loadExpenses, isEng, expKey, legal, accumulated, dotacaoInfo,
  alerts, calendarEvents
};
