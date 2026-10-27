/**
 * Painel de Controle (módulo dashboard): indicadores consolidados e feed de alertas em tempo real.
 * Cada bloco só aparece com dados de módulos a que o usuário tem acesso.
 */
const express = require('express');
const db = require('../db');
const config = require('../services/config');
const feed = require('../services/feed');
const C = require('../services/compras');
const E = require('../services/estoque');
const { ah } = require('../lib/http');
const { today, addDays, year, fmtBR } = require('../lib/dates');

const router = express.Router();
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CAT = { protocolo: 'PROTOCOLO', rh: 'PESSOAL', mocoes: 'MOÇÕES', almoxarifado: 'ALMOXARIFADO', patrimonio: 'PATRIMÔNIO', compras: 'COMPRAS' };

router.get('/', ah(async (req, res) => {
  const u = req.user, has = (m) => u.modules.includes(m);
  const cfg = await config.snapshot();
  const a = +req.query.ano;
  const ano = a >= 2000 && a <= 2100 ? a : +(u.preferences.exercicio || year(today()));
  const hoje = today();
  const out = { ano, perfil: u.role, sections: { audit: has('almoxarifado'), capacity: true, agents: has('compras'), legislative: has('protocolo') && (u.isAdmin || u.roles.includes('Gerenciamento')), alerts: true } };

  // ---- Processos do exercício (Compras + Protocolo) e termos aguardando assinatura ----
  const procs = has('compras') ? (await C.loadProcesses()).filter((p) => year(new Date(p.createdAt).toISOString().slice(0, 10)) === ano) : [];
  const infos = procs.map((p) => C.procInfo(p, cfg('compras.sla')));
  const prot = has('protocolo') ? (await db.query('SELECT progresso FROM protocolo_processos WHERE EXTRACT(YEAR FROM created_at) = $1', [ano])).rows : [];
  const termos = has('patrimonio') ? +(await db.query("SELECT COUNT(*) FROM patrimonio_transferencias WHERE status = 'Pendente'")).rows[0].count : 0;
  const assinatura = infos.filter((i) => !i.concluido && /Presidente|Homologação/.test(i.currentLabel)).length + termos;
  const total = infos.length + prot.length;
  const concl = infos.filter((i) => i.concluido).length + prot.filter((p) => p.progresso >= 100).length;
  const andamento = Math.max(0, total - concl - Math.min(assinatura, total - concl));
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0) + '%';
  out.cards = [
    { key: 'concluidos', label: 'Processos Concluídos', value: pct(concl), sub: `${concl} de ${total} processos no exercício` },
    { key: 'andamento', label: 'Em Andamento', value: pct(andamento), sub: `${andamento} processos ativos nos subsetores` },
    { key: 'assinatura', label: 'Aguardando Assinatura', value: pct(Math.min(assinatura, total)), badge: assinatura + ' pendente' + (assinatura === 1 ? '' : 's') }
  ];

  // ---- Fluxo de processos: movimentações por mês (etapas concluídas + documentos protocolados) ----
  const meses = [];
  const ref = year(hoje) === ano ? +hoje.slice(5, 7) : 12;
  for (let m = Math.max(1, ref - 6); m <= ref; m++) meses.push(m);
  const counts = Object.fromEntries(meses.map((m) => [m, 0]));
  if (has('compras')) (await db.query("SELECT EXTRACT(MONTH FROM data)::int AS m, COUNT(*)::int AS n FROM compras_etapas WHERE status = 'ok' AND data IS NOT NULL AND EXTRACT(YEAR FROM data) = $1 GROUP BY 1", [ano])).rows.forEach((r) => { if (r.m in counts) counts[r.m] += r.n; });
  if (has('protocolo')) (await db.query('SELECT EXTRACT(MONTH FROM data)::int AS m, COUNT(*)::int AS n FROM protocolo_documentos WHERE EXTRACT(YEAR FROM data) = $1 GROUP BY 1', [ano])).rows.forEach((r) => { if (r.m in counts) counts[r.m] += r.n; });
  const serie = meses.map((m) => ({ mes: MESES[m - 1], valor: counts[m] }));
  const last = serie[serie.length - 1], prev = serie[serie.length - 2];
  out.fluxo = { serie, variacao: prev && prev.valor ? Math.round(((last.valor - prev.valor) / prev.valor) * 1000) / 10 : null, visivel: has('compras') || has('protocolo') };

  // ---- Auditoria de almoxarifado: contagens da semana ----
  if (has('almoxarifado')) {
    const ws = E.weekStart(hoje), esc = await E.escalaAtiva();
    const { rows } = await db.query("SELECT (em AT TIME ZONE 'America/Sao_Paulo')::date::text AS d, COUNT(DISTINCT material_id)::int AS n FROM almox_contagens WHERE em >= $1::date GROUP BY 1", [ws]);
    const dias = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const by = Object.fromEntries(rows.map((r) => [r.d, r.n]));
    const mx = Math.max(1, ...dias.map((d) => by[d] || 0));
    const contados = esc ? +(await db.query('SELECT COUNT(DISTINCT material_id) FROM almox_contagens WHERE em >= $1::date AND material_id = ANY($2)', [ws, esc.items.map((i) => i.materialId)])).rows[0].count : 0;
    out.auditoria = { contados, total: esc ? esc.items.length : 0, colunas: dias.map((d, i) => ({ dia: fmtBR(d), n: by[d] || 0, pct: Math.round(((by[d] || 0) / mx) * 100), alt: i % 2 === 1 })) };
  }

  // ---- Capacidade operacional: demandas ativas por setor acessível ----
  const cap = [];
  if (has('compras')) cap.push({ label: 'Compras & Licitações', n: infos.filter((i) => !i.concluido).length });
  if (has('rh')) cap.push({ label: 'Gestão de Pessoal', n: +(await db.query("SELECT COUNT(*) FROM rh_ausencias WHERE status = 'Pendente' OR (status = 'Aprovado' AND fim >= $1)", [hoje])).rows[0].count });
  if (has('protocolo')) cap.push({ label: 'Protocolo', n: +(await db.query("SELECT (SELECT COUNT(*) FROM protocolo_documentos WHERE status IN ('Registrado', 'Em Processamento')) + (SELECT COUNT(*) FROM protocolo_processos WHERE progresso < 100) AS n")).rows[0].n });
  if (has('patrimonio')) cap.push({ label: 'Patrimônio', n: +(await db.query("SELECT COUNT(*) FROM patrimonio_transferencias WHERE status IN ('Pendente', 'Verificar transferência')")).rows[0].count });
  const maxCap = Math.max(0, ...cap.map((c) => c.n));
  out.capacidade = cap.map((c) => ({ label: c.label, value: c.n + ' demanda' + (c.n === 1 ? '' : 's'), destaque: c.n > 0 && c.n === maxCap }));

  // ---- Carga por agente de contratação ----
  if (has('compras')) {
    const ls = C.loads(await C.loadProcesses(), await C.agents(), cfg('compras.sla'));
    const mx = Math.max(1, ...ls.map((l) => l.ativos));
    out.agentes = ls.map((l) => ({ agente: l.agente, ativos: l.ativos, atrasados: l.atrasados, pct: Math.round((l.ativos / mx) * 100) }));
  }

  // ---- Metas legislativas: documentos por fase do fluxo do Protocolo ----
  if (out.sections.legislative) {
    const { rows } = await db.query('SELECT status, COUNT(*)::int AS n FROM protocolo_documentos WHERE EXTRACT(YEAR FROM data) = $1 GROUP BY 1', [ano]);
    const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
    const F = [['Autuação', 'Registrado'], ['Análise', 'Em Processamento'], ['Parecer', 'Finalizado'], ['Arquivamento', 'Arquivado']];
    const mx = Math.max(1, ...F.map(([, s]) => by[s] || 0));
    out.metas = F.map(([nome, s]) => ({ nome, n: by[s] || 0, pct: Math.round(((by[s] || 0) / mx) * 100) }));
  }

  // ---- Feed: alertas dos módulos + prazos vencidos/urgentes do calendário ----
  const alerts = await feed.alerts(u.modules);
  const ids = new Set(alerts.map((x) => x.id));
  const crit = await feed.critical(u.modules);
  crit.rows.filter((r) => r.module !== 'compras' && (r.bucket === 'vencido' || r.bucket === 'urgente')).forEach((r) => {
    const id = 'cal-' + r.module + '-' + r.date + '-' + r.title.slice(0, 60);
    if (ids.has(id)) return; ids.add(id);
    alerts.push({ id, module: r.module, category: CAT[r.module] || r.moduleLabel.toUpperCase(), level: r.bucket === 'vencido' || r.level === 'critical' ? 'critical' : 'warning', title: r.title, description: (r.bucket === 'vencido' ? 'Venceu em ' : 'Até ') + fmtBR(r.date) + ' · ' + r.moduleLabel, href: r.href });
  });
  out.alertas = alerts;
  out.feed = { autoDismiss: cfg('painel.autoDismiss'), opacidade: cfg('painel.opacidade'), agrupar: cfg('painel.agrupar'), refresh: cfg('painel.refresh') };
  res.json(out);
}));

module.exports = router;
