/**
 * Patrimônio: transferências (Pendente → Verificar transferência → Realizado | Recusado)
 * e termos de responsabilidade por centro de custo de patrimônio e mês (portado de PatrimonioModule).
 */
const db = require('../db');
const config = require('./config');
const { today, addBiz, bizDays, fmtBR } = require('../lib/dates');

const STAGES = ['Pendente', 'Verificar transferência', 'Realizado'];
const STATUS = STAGES.concat(['Recusado']);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mesLabel = (ym) => MESES[+ym.slice(5, 7) - 1] + ' de ' + ym.slice(0, 4);

const rowOf = (r) => ({
  id: r.id, code: r.code, description: r.description, fromUser: r.from_user, toUser: r.to_user, toUserId: r.to_user_id,
  fromCcId: r.from_cc_id, toCcId: r.to_cc_id, fromCc: r.from_cc || '', toCc: r.to_cc || '', fromCcCodigo: r.from_cc_codigo || '', toCcCodigo: r.to_cc_codigo || '',
  date: r.data, status: r.status, signedAt: r.assinado_em, signedBy: r.assinado_por_nome || null
});

async function transferencias(client = db) {
  const { rows } = await client.query(
    `SELECT t.*, f.nome AS from_cc, f.codigo AS from_cc_codigo, d.nome AS to_cc, d.codigo AS to_cc_codigo, u.name AS assinado_por_nome
     FROM patrimonio_transferencias t
     LEFT JOIN cost_centers f ON f.id = t.from_cc_id LEFT JOIN cost_centers d ON d.id = t.to_cc_id
     LEFT JOIN users u ON u.id = t.assinado_por
     ORDER BY t.data DESC, t.id DESC`);
  return rows.map(rowOf);
}

/** Etapa seguinte/anterior permitida (Recusado é final, sem movimentação). */
function stageInfo(status) {
  const i = STAGES.indexOf(status);
  return { index: i, prev: i > 0 ? STAGES[i - 1] : null, next: i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null };
}

/** Termos do mês: centros de custo de patrimônio ativos com entrada/saída de bens (exceto recusadas). */
async function termos(ym, client = db) {
  const [list, { rows: ccs }, { rows: em }] = await Promise.all([
    transferencias(client),
    client.query("SELECT id, codigo, nome FROM cost_centers WHERE tipo = 'patrimonio' AND ativo ORDER BY codigo"),
    client.query('SELECT t.cost_center_id, t.emitido_em, u.name FROM patrimonio_termos t LEFT JOIN users u ON u.id = t.emitido_por WHERE ym = $1', [ym])
  ]);
  const emit = new Map(em.map((e) => [e.cost_center_id, e]));
  const inMonth = list.filter((t) => t.date.slice(0, 7) === ym && t.status !== 'Recusado');
  const rows = ccs.map((cc) => {
    const movs = [];
    inMonth.forEach((t) => {
      if (t.fromCcId === cc.id) movs.push({ dir: 'Saída', code: t.code, description: t.description, other: 'para ' + (t.toCc || t.toUser), date: t.date, status: t.status });
      if (t.toCcId === cc.id) movs.push({ dir: 'Entrada', code: t.code, description: t.description, other: 'de ' + (t.fromCc || t.fromUser), date: t.date, status: t.status });
    });
    const e = emit.get(cc.id);
    return { id: cc.id, codigo: cc.codigo, nome: cc.nome, movs, emitido: e ? e.emitido_em : null, emitidoPor: e ? e.name : null };
  }).filter((r) => r.movs.length);
  const orphans = inMonth.filter((t) => !t.fromCcId || !t.toCcId);
  return { ym, mes: mesLabel(ym), rows, orphans, movimentos: inMonth.length, pendentes: rows.filter((r) => !r.emitido).length };
}

/** Mês padrão da aba de termos: o mais recente com transferência (como no protótipo). */
async function ultimoMes() {
  const { rows } = await db.query("SELECT to_char(MAX(data), 'YYYY-MM') AS ym FROM patrimonio_transferencias");
  return rows[0].ym || today().slice(0, 7);
}

/** Alertas: termos não assinados no prazo e termos de responsabilidade a emitir no mês corrente. */
async function alerts() {
  const cfg = await config.snapshot();
  if (!cfg('patrim.alertaPendente')) return [];
  const prazo = cfg('patrim.prazoTermo'), out = [];
  const list = await transferencias();
  list.filter((t) => t.status === 'Pendente').forEach((t) => {
    const d = bizDays(t.date), venc = addBiz(t.date, prazo);
    out.push({ id: 'pat-pend-' + t.id, module: 'patrimonio', category: 'PATRIMÔNIO', level: d > prazo ? 'warning' : 'info',
      title: (d > prazo ? 'Termo não assinado no prazo — ' : 'Transferência pendente — ') + t.code,
      description: t.description + ' · para ' + t.toUser + ' · assinar até ' + fmtBR(venc), href: '/patrimonio?transf=' + t.id });
  });
  const tm = await termos(today().slice(0, 7));
  if (tm.pendentes) out.push({ id: 'pat-termos-' + tm.ym, module: 'patrimonio', category: 'PATRIMÔNIO', level: 'warning', title: tm.pendentes + ' termo(s) de responsabilidade a emitir', description: 'Centros de custo com movimentação em ' + tm.mes, href: '/patrimonio?view=termos' });
  return out;
}

/** Calendário integrado: prazo de assinatura dos termos pendentes. */
async function calendarEvents() {
  const cfg = await config.snapshot();
  const prazo = cfg('patrim.prazoTermo'), hoje = today();
  return (await transferencias()).filter((t) => t.status === 'Pendente').map((t) => {
    const due = addBiz(t.date, prazo);
    return { title: 'Assinatura do termo — ' + t.code + ' (' + t.description + ')', start: due, end: due, level: due < hoje ? 'critical' : bizDays(hoje, due) <= 2 ? 'warning' : 'info', deadline: true, href: '/patrimonio?transf=' + t.id };
  });
}

module.exports = { STAGES, STATUS, transferencias, stageInfo, termos, ultimoMes, mesLabel, alerts, calendarEvents };
