/**
 * Analytics & Relatórios (módulo analytics): visão consolidada calculada a partir dos dados dos módulos
 * (portado de AnalyticsConsolidado). Exportação em CSV registrada na auditoria.
 */
const express = require('express');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const C = require('../services/compras');
const feed = require('../services/feed');
const { ah, badRequest } = require('../lib/http');
const { csv } = require('../lib/csv');
const { today, addDays, year, brl } = require('../lib/dates');

const router = express.Router();
const PERIODOS = ['7', '30', '90', '365', 'ano'];

async function consolidado(req) {
  const cfg = await config.snapshot();
  const hoje = today(), ano = year(hoje);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const custom = req.query.periodo === 'custom' && ISO.test(String(req.query.de)) && ISO.test(String(req.query.ate));
  if (req.query.periodo === 'custom' && !custom) throw badRequest('Informe as datas inicial e final do período.');
  if (custom && req.query.de > req.query.ate) throw badRequest('A data inicial deve ser anterior à final.');
  const periodo = custom ? 'custom' : PERIODOS.includes(String(req.query.periodo)) ? String(req.query.periodo) : String(cfg('analytics.periodo'));
  const desde = custom ? String(req.query.de) : periodo === 'ano' ? ano + '-01-01' : addDays(hoje, -+periodo);
  const ate = custom ? String(req.query.ate) : hoje;
  const sla = cfg('compras.sla');
  const procs = (await C.loadProcesses()).map((p) => ({ p, i: C.procInfo(p, sla) }));
  const ativos = procs.filter((x) => !x.i.concluido);
  const atras = procs.filter((x) => x.i.atrasado).length;
  const noPeriodo = procs.filter((x) => { const d = new Date(x.p.createdAt).toISOString().slice(0, 10); return d >= desde && d <= ate; });
  const contr = (await C.loadContracts()).map((c) => ({ c, ci: C.contractInfo(c, ano, cfg) }));
  const venc = contr.filter((x) => x.ci.dias >= 0 && x.ci.dias <= 120).length;
  const { expenses } = await C.loadExpenses();
  const dot = (await db.query('SELECT * FROM dotacoes WHERE ano = $1', [ano])).rows.map((d) => { const x = { ficha: d.ficha, sub: d.sub, ano: d.ano, orcado: +d.orcado }; return { d: x, i: C.dotacaoInfo(x, expenses) }; });
  const orc = dot.reduce((a, x) => a + x.d.orcado, 0), emp = dot.reduce((a, x) => a + x.i.empenhado, 0);
  const entregas = +(await db.query('SELECT COUNT(*) FROM homenagens_entregas WHERE data >= $1', [hoje])).rows[0].count;
  const alertas = (await feed.alerts(req.user.modules.concat(['compras', 'almoxarifado', 'rh', 'mocoes', 'patrimonio', 'protocolo']))).length;
  const setores = [...new Set(procs.map((x) => x.p.setor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const bars = (pairs, color, fmt) => { const mx = Math.max(1, ...pairs.map((p) => p[1])); return pairs.map(([label, v, c]) => ({ label, value: fmt ? fmt(v) : String(v), raw: v, color: c || color, pct: Math.round((v / mx) * 100) })); };
  const mk = (title, href, linkLabel, mod, rows) => ({ title, href, linkLabel, module: mod, rows, empty: !rows.length || rows.every((r) => !r.raw) });
  const contrRows = contr.slice().sort((a, b) => a.ci.dias - b.ci.dias).filter((x) => x.ci.dias >= 0).slice(0, 5)
    .map((x) => [x.c.contrato + ' · ' + x.c.contratada.split(' ').slice(0, 2).join(' '), x.ci.dias, x.ci.dias <= 30 ? '#B91C1C' : x.ci.dias <= 60 ? '#B45309' : x.ci.dias <= 120 ? '#1E40AF' : '#1C543A']);
  const dotRows = dot.slice().sort((a, b) => b.i.pct - a.i.pct).slice(0, 5).map((x) => ['Ficha ' + x.d.ficha + '/' + x.d.sub, Math.round(x.i.pct * 100), x.i.pct >= 0.8 ? '#B45309' : '#1C543A']);
  const loads = C.loads(procs.map((x) => x.p), await C.agents(), sla);

  return {
    periodo, desde, ate,
    kpis: [
      { label: 'Processos ativos', value: String(ativos.length), sub: atras + ' com etapa atrasada', level: atras ? 'warning' : 'ok', href: '/compras?tab=processos', module: 'compras' },
      { label: 'Valor estimado em curso', value: brl(ativos.reduce((a, x) => a + (x.p.valor || 0), 0)), sub: 'Soma dos processos ativos', level: 'neutral', href: '/compras?tab=processos', module: 'compras' },
      { label: 'Contratos vencendo', value: String(venc), sub: 'Nos próximos 120 dias', level: venc ? 'warning' : 'ok', href: '/compras?tab=contratos', module: 'compras' },
      { label: 'Execução da dotação', value: orc ? Math.round((emp / orc) * 100) + '%' : '—', sub: brl(emp) + ' de ' + brl(orc), level: 'ok', href: '/compras?tab=analytics', module: 'compras' },
      { label: 'Alertas ativos', value: String(alertas), sub: 'Todos os módulos', level: alertas ? 'critical' : 'ok', href: '/notificacoes', module: 'notificacoes' },
      { label: 'Entregas de homenagem', value: String(entregas), sub: 'Agendadas a partir de hoje', level: 'ok', href: '/mocoes?tab=arranjos', module: 'mocoes' }
    ],
    blocks: [
      mk('Processos ativos por setor requisitante', '/compras?tab=processos', 'Controle de Processos', 'compras', bars(setores.map((s) => [s, ativos.filter((x) => x.p.setor === s).length]), '#1C543A')),
      mk('Valor estimado por setor', '/compras?tab=processos', 'Controle de Processos', 'compras', bars(setores.map((s) => [s, ativos.filter((x) => x.p.setor === s).reduce((a, x) => a + (x.p.valor || 0), 0)]), '#2E6B4E', brl)),
      mk('Processos por modo de contratação (período)', '/compras?tab=processos', 'Controle de Processos', 'compras', bars(C.MODOS.map((m) => [m, noPeriodo.filter((x) => x.p.modo === m).length]), '#1C543A')),
      mk('Situação das fases', '/compras?tab=processos', 'Controle de Processos', 'compras', bars([['Fase interna', ativos.filter((x) => x.i.fase === 'interna').length], ['Fase externa', ativos.filter((x) => x.i.fase === 'externa').length], ['Concluídos', procs.length - ativos.length, '#7FA693']], '#1C543A')),
      mk('Contratos mais próximos do fim (dias)', '/compras?tab=contratos', 'Contratos', 'compras', bars(contrRows, '#1C543A', (v) => v + ' dias')),
      mk('Dotações mais utilizadas (%)', '/compras?tab=analytics', 'Dotação Orçamentária', 'compras', bars(dotRows, '#1C543A', (v) => v + '%')),
      mk('Carga por agente de contratação', '/compras?tab=processos', 'Controle de Processos', 'compras', bars(loads.map((l) => [l.agente, l.ativos, l.atrasados ? '#B45309' : '#1C543A']), '#1C543A')),
      { title: 'Gestão de Pessoal', href: '/pessoal?tab=analytics', linkLabel: 'Indicadores de pessoal', module: 'rh', rows: [], empty: false, note: 'Quadro de servidores, afastamentos e férias por setor ficam no próprio módulo de Gestão de Pessoal.' }
    ]
  };
}

router.get('/', ah(async (req, res) => res.json(await consolidado(req))));

router.get('/export.csv', ah(async (req, res) => {
  const d = await consolidado(req);
  const rows = [['Seção', 'Indicador', 'Valor', 'Detalhe']];
  d.kpis.forEach((k) => rows.push(['Indicadores', k.label, k.value, k.sub]));
  d.blocks.forEach((b) => b.rows.forEach((r) => rows.push([b.title, r.label, r.value, ''])));
  await audit.log(req, { action: 'Relatório exportado', module: 'analytics', detail: 'Visão consolidada (CSV) · período ' + (d.periodo === 'custom' ? d.desde + ' a ' + d.ate : d.periodo), kind: 'exportacao' });
  csv(res, `analytics_visao_consolidada_${today()}.csv`, rows);
}));

module.exports = router;
