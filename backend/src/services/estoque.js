/**
 * Almoxarifado — estoque por RME (saídas) e BRM (entradas), materiais, pendências, escala e contagens.
 * Portado de design/estoque.js e da Base Completa (AlmoxInventario).
 *
 * Garantias da atualização de estoque:
 *  - Idempotente: cada documento é identificado por (tipo, número); o mesmo documento nunca é computado duas vezes.
 *  - Transacional: cada documento é aplicado em uma transação.
 *  - RME baixa estoque usando a quantidade ATENDIDA (ou a REQUISITADA, se a atendida for zero); BRM soma a recebida.
 *  - Código não cadastrado não altera saldo: fica pendente até o cadastro do material (ou é recusado).
 */
const db = require('../db');
const config = require('./config');
const { parseText } = require('./estoqueParser');
const { today, addDays } = require('../lib/dates');

const digits = (c) => String(c || '').replace(/\D/g, '');
const fmtCode = (c) => { const d = digits(c); return d.length === 10 ? `${d[0]} ${d.slice(1, 3)} ${d.slice(3, 5)} ${d.slice(5, 9)} ${d[9]}` : String(c || '').trim(); };
const round3 = (n) => Math.round(n * 1000) / 1000;
const UNITS = ['UN', 'PCT', 'CX', 'GL', 'RL', 'RESMA', 'KG', 'L', 'M', 'PAR'];
const CATS = ['Papelaria', 'Higiene', 'Escritório', 'Manutenção', 'Copa e Cozinha'];
const PRIORIDADES = ['Alta', 'Média', 'Baixa'];

/** Extrai o texto de um PDF (buffer). */
async function pdfText(buf) {
  const pdf = require('pdf-parse/lib/pdf-parse.js');
  const r = await pdf(buf);
  return r.text || '';
}

/**
 * Aplica um documento já interpretado (saída de parseText). Retorna o resultado para o relatório.
 * meta: { arquivo, fonte, driveFileId, userId }
 */
async function applyDocument(doc, meta) {
  const key = doc.tipo + ' ' + doc.numero;
  if (!doc.numero) return { status: 'erro', arquivo: meta.arquivo, motivo: 'Número do documento não identificado no PDF' };
  if (!doc.valido) {
    return { status: 'erro', arquivo: meta.arquivo, motivo: key + (doc.codigosEncontrados ? `: ${doc.codigosEncontrados} código(s) encontrado(s), mas nenhuma quantidade/unidade reconhecida — envie o PDF para ajuste da leitura` : ': nenhum código de material encontrado no texto do PDF (pode ser PDF escaneado/imagem)') };
  }
  return db.tx(async (c) => {
    const ins = await c.query(
      `INSERT INTO estoque_documentos (tipo, numero, data_doc, arquivo, origem, nota_fiscal, status_doc, fonte, drive_file_id, processado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING id`,
      [doc.tipo, doc.numero, doc.data || null, meta.arquivo, (doc.tipo === 'RME' ? doc.setor : doc.fornecedor) || null, doc.notaFiscal || null, doc.status || null, meta.fonte || 'upload', meta.driveFileId || null, meta.userId || null]);
    if (!ins.rowCount) return { status: 'ignorado', arquivo: meta.arquivo, motivo: key + ' já computado' };
    const docId = ins.rows[0].id, sign = doc.tipo === 'RME' ? -1 : 1;
    const itens = [];
    for (const it of doc.itens) {
      const d = digits(it.code);
      const m = await c.query('SELECT id, codigo, saldo FROM materiais WHERE codigo_digitos = $1 FOR UPDATE', [d]);
      if (m.rows.length) {
        const antes = +m.rows[0].saldo, depois = round3(antes + sign * it.qtd);
        await c.query('UPDATE materiais SET saldo = $1, atualizado_em = NOW() WHERE id = $2', [depois, m.rows[0].id]);
        await c.query('INSERT INTO estoque_movimentos (material_id, documento_id, tipo, referencia, quantidade, saldo_apos, por) VALUES ($1,$2,$3,$4,$5,$6,$7)', [m.rows[0].id, docId, doc.tipo, key, sign * it.qtd, depois, meta.userId || null]);
        await c.query('INSERT INTO estoque_doc_itens (documento_id, codigo_digitos, descricao, quantidade, unidade, preco, material_id, aplicado, saldo_antes, saldo_depois) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9)',
          [docId, d, (it.desc || '').slice(0, 255), it.qtd, it.unit || null, it.preco || null, m.rows[0].id, antes, depois]);
        itens.push({ code: m.rows[0].codigo, desc: it.desc, qtd: it.qtd, unit: it.unit, aplicado: true, antes, depois });
      } else {
        await c.query('INSERT INTO estoque_doc_itens (documento_id, codigo_digitos, descricao, quantidade, unidade, preco) VALUES ($1,$2,$3,$4,$5,$6)', [docId, d, (it.desc || '').slice(0, 255), it.qtd, it.unit || null, it.preco || null]);
        itens.push({ code: fmtCode(d), desc: it.desc, qtd: it.qtd, unit: it.unit, aplicado: false });
      }
    }
    const notes = doc.naoLidos && doc.naoLidos.length ? `${key}: ${doc.naoLidos.length} item(ns) sem quantidade reconhecida (${doc.naoLidos.join(', ')}) — os demais foram computados` : null;
    return { status: 'processado', arquivo: meta.arquivo, id: docId, key, tipo: doc.tipo, numero: doc.numero, data: doc.data, origem: doc.tipo === 'RME' ? doc.setor : doc.fornecedor, notaFiscal: doc.notaFiscal, statusDoc: doc.status, itens, aviso: notes };
  });
}

/** Lê e aplica um PDF. tipoPasta (opcional) impede RME na pasta de BRM e vice-versa. */
async function processPdf(buf, meta) {
  let text;
  try { text = await pdfText(buf); } catch (e) { return { status: 'erro', arquivo: meta.arquivo, motivo: 'Falha na leitura do PDF' }; }
  const doc = parseText(text);
  if (!doc) return { status: 'ignorado', arquivo: meta.arquivo, motivo: 'Não é RME nem BRM' };
  if (meta.tipoPasta && doc.tipo !== meta.tipoPasta) return { status: 'ignorado', arquivo: meta.arquivo, motivo: `${doc.tipo} ${doc.numero} está na pasta de ${meta.tipoPasta}s` };
  return applyDocument(doc, meta);
}

/** Consolida resultados em relatório { processados, ignorados, erros, avisos }. */
function report(results, encontrados) {
  return {
    encontrados: encontrados == null ? results.length : encontrados,
    processados: results.filter((r) => r.status === 'processado'),
    ignorados: results.filter((r) => r.status === 'ignorado').map((r) => ({ arquivo: r.arquivo, motivo: r.motivo })),
    erros: results.filter((r) => r.status === 'erro').map((r) => ({ arquivo: r.arquivo, motivo: r.motivo }))
      .concat(results.filter((r) => r.aviso).map((r) => ({ arquivo: r.arquivo, motivo: r.aviso })))
  };
}

/* ---------------- Consultas ---------------- */
async function materiais() {
  const { rows } = await db.query(
    `SELECT m.*, mv.quantidade AS ult_qtd, mv.referencia AS ult_ref, mv.criado_em AS ult_em,
            ct.contado, ct.sistema, ct.diferenca, ct.status AS ct_status, ct.em AS ct_em, cu.name AS ct_por
       FROM materiais m
       LEFT JOIN LATERAL (SELECT * FROM estoque_movimentos x WHERE x.material_id = m.id ORDER BY criado_em DESC, id DESC LIMIT 1) mv ON TRUE
       LEFT JOIN LATERAL (SELECT * FROM almox_contagens y WHERE y.material_id = m.id ORDER BY em DESC, id DESC LIMIT 1) ct ON TRUE
       LEFT JOIN users cu ON cu.id = ct.por
      ORDER BY m.descricao`);
  return rows.map((m) => ({
    id: m.id, code: m.codigo, digits: m.codigo_digitos, name: m.descricao, unit: m.unidade, category: m.categoria, priority: m.prioridade,
    frequency: m.prioridade === 'Alta' ? 'Semanal' : m.prioridade === 'Média' ? 'Quinzenal' : 'Mensal',
    stock: +m.saldo, avgConsumption: +m.consumo_medio, verify: m.verificar,
    lastMove: m.ult_ref ? { qtd: +m.ult_qtd, doc: m.ult_ref, at: m.ult_em } : null,
    count: m.ct_status ? { counted: +m.contado, stock: +m.sistema, diff: +m.diferenca, status: m.ct_status, at: m.ct_em, by: m.ct_por } : null
  }));
}

async function documentos() {
  const [{ rows: ds }, { rows: its }] = await Promise.all([
    db.query('SELECT d.*, u.name AS por_nome FROM estoque_documentos d LEFT JOIN users u ON u.id = d.processado_por ORDER BY processado_em DESC, id DESC'),
    db.query('SELECT i.*, m.codigo FROM estoque_doc_itens i LEFT JOIN materiais m ON m.id = i.material_id ORDER BY id')
  ]);
  return ds.map((d) => ({
    id: d.id, key: d.tipo + ' ' + d.numero, tipo: d.tipo, numero: d.numero, data: d.data_doc, arquivo: d.arquivo, origem: d.origem || '', notaFiscal: d.nota_fiscal || '', statusDoc: d.status_doc || '',
    fonte: d.fonte, processadoEm: d.processado_em, por: d.por_nome || 'Rotina automática',
    itens: its.filter((i) => i.documento_id === d.id).map((i) => ({ code: i.codigo || fmtCode(i.codigo_digitos), desc: i.descricao || '', qtd: +i.quantidade, unit: i.unidade || '', aplicado: i.aplicado, descartado: i.descartado, antes: i.saldo_antes == null ? null : +i.saldo_antes, depois: i.saldo_depois == null ? null : +i.saldo_depois }))
  }));
}

/** Itens de documentos com código não cadastrado, agrupados por código (dados preferencialmente da BRM). */
async function pendentesAgrupados() {
  const { rows } = await db.query(
    `SELECT i.*, d.tipo, d.numero, d.data_doc, d.origem FROM estoque_doc_itens i JOIN estoque_documentos d ON d.id = i.documento_id
      WHERE NOT i.aplicado AND NOT i.descartado ORDER BY d.data_doc, i.id`);
  const g = {};
  rows.forEach((p) => {
    const x = g[p.codigo_digitos] || (g[p.codigo_digitos] = { code: fmtCode(p.codigo_digitos), desc: '', unit: '', fonte: '', fonteDoc: '', fornecedor: '', preco: null, movs: [] });
    const doc = p.tipo + ' ' + p.numero;
    x.movs.push({ doc, tipo: p.tipo, data: p.data_doc, qtd: +p.quantidade, unit: p.unidade || '' });
    if (p.tipo === 'BRM' && x.fonte !== 'BRM') Object.assign(x, { desc: p.descricao || x.desc, unit: p.unidade || x.unit, preco: p.preco == null ? null : +p.preco, fonte: 'BRM', fonteDoc: doc, fornecedor: p.origem || '' });
    else if (!x.fonte) Object.assign(x, { desc: p.descricao || '', unit: p.unidade || '', fonte: 'RME', fonteDoc: doc });
  });
  return Object.values(g).map((x) => ({ ...x, saldoPrevisto: round3(x.movs.reduce((a, m) => a + (m.tipo === 'RME' ? -m.qtd : m.qtd), 0)) }));
}

/** Cadastra material (com saldo inicial) e aplica movimentos pendentes do mesmo código. */
async function criarMaterial(c, it, userId) {
  const d = digits(it.code);
  const ins = await c.query(
    `INSERT INTO materiais (codigo, codigo_digitos, descricao, unidade, categoria, prioridade, saldo, consumo_medio)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (codigo_digitos) DO NOTHING RETURNING id`,
    [fmtCode(d), d, String(it.name).trim().toUpperCase(), it.unit || 'UN', it.category || 'Papelaria', it.priority || 'Baixa', +it.stock || 0, +it.avgConsumption || 0]);
  if (!ins.rowCount) return null;
  const id = ins.rows[0].id;
  let saldo = +it.stock || 0;
  if (saldo) await c.query("INSERT INTO estoque_movimentos (material_id, tipo, referencia, quantidade, saldo_apos, por) VALUES ($1,'Saldo inicial','Cadastro',$2,$2,$3)", [id, saldo, userId]);
  const { rows: pend } = await c.query(
    `SELECT i.id, i.quantidade, d.tipo, d.numero, d.id AS doc_id FROM estoque_doc_itens i JOIN estoque_documentos d ON d.id = i.documento_id
      WHERE i.codigo_digitos = $1 AND NOT i.aplicado AND NOT i.descartado ORDER BY d.data_doc, i.id`, [d]);
  for (const p of pend) {
    const antes = saldo; saldo = round3(saldo + (p.tipo === 'RME' ? -1 : 1) * +p.quantidade);
    await c.query('UPDATE estoque_doc_itens SET aplicado = TRUE, material_id = $1, saldo_antes = $2, saldo_depois = $3 WHERE id = $4', [id, antes, saldo, p.id]);
    await c.query('INSERT INTO estoque_movimentos (material_id, documento_id, tipo, referencia, quantidade, saldo_apos, por) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, p.doc_id, p.tipo, p.tipo + ' ' + p.numero, (p.tipo === 'RME' ? -1 : 1) * +p.quantidade, saldo, userId]);
  }
  await c.query('UPDATE materiais SET saldo = $1 WHERE id = $2', [saldo, id]);
  return { id, aplicados: pend.length, saldo };
}

/* ---------------- Escala de contagem ---------------- */
const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
async function params() {
  const { rows } = await db.query('SELECT p.*, u.name AS por_nome FROM almox_params p LEFT JOIN users u ON u.id = p.atualizado_por WHERE p.id = 1');
  const p = rows[0] || { equipe: [], dias: ['Seg', 'Qua'], pesos: { alta: 60, media: 30, baixa: 10 }, base_calculo: 'dias', atualizado_em: null, por_nome: null };
  const cfg = await config.snapshot();
  const ids = p.equipe.map((m) => m.userId);
  const { rows: us } = ids.length ? await db.query('SELECT id, name FROM users WHERE id = ANY($1)', [ids]) : { rows: [] };
  const team = p.equipe.map((m) => ({ ...m, name: (us.find((u) => u.id === m.userId) || {}).name })).filter((m) => m.name);
  return {
    team, days: p.dias, weights: p.pesos, calcBase: p.base_calculo,
    perSession: cfg('almox.itensSessao'), sessionsPerWeek: cfg('almox.sessoesSemana'), tolerancePct: cfg('almox.tolerancia'), recountPct: cfg('almox.recontagem'),
    method: cfg('almox.metodo'), lastSaved: p.atualizado_em ? { at: p.atualizado_em, by: p.por_nome } : null
  };
}
function summary(p) {
  const employees = p.team.filter((m) => m.active).length;
  const porDias = (p.calcBase || 'dias') === 'dias';
  const mult = porDias ? (p.days || []).length : +p.sessionsPerWeek || 0;
  const perPerson = (+p.perSession || 0) * mult;
  return { employees, perPerson, total: employees * perPerson, baseLabel: porDias ? `${(p.days || []).length} dia(s) de contagem` : `${+p.sessionsPerWeek || 0} sessão(ões) por semana` };
}
/** Segunda-feira da semana de uma data ISO. */
function weekStart(iso) {
  const d = new Date(iso + 'T12:00:00Z'); const w = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (w - 1));
  return d.toISOString().slice(0, 10);
}
const prKey = (p) => String(p || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Sorteia os itens da escala. method: alta|media|baixa|balanceado (balanceado usa os pesos por prioridade). */
function sortear(items, { category, method, size, weights }, rnd = Math.random) {
  let pool = items.filter((i) => !category || category === 'todos' || i.category === category);
  if (method !== 'balanceado') {
    const first = pool.filter((p) => prKey(p.priority) === method);
    const rest = pool.filter((p) => prKey(p.priority) !== method).sort((a, b) => b.avgConsumption - a.avgConsumption);
    return first.sort(() => rnd() - 0.5).concat(rest).slice(0, size);
  }
  // Sorteio ponderado sem reposição: peso do item = peso da curva / nº de itens da curva
  const W = { alta: +weights.alta || 0, media: +weights.media || 0, baixa: +weights.baixa || 0 };
  const cnt = {}; pool.forEach((p) => { const k = prKey(p.priority); cnt[k] = (cnt[k] || 0) + 1; });
  const out = [], left = pool.slice();
  while (out.length < size && left.length) {
    const ws = left.map((p) => { const k = prKey(p.priority); return (W[k] || 0) / cnt[k] || 0.0001; });
    let r = rnd() * ws.reduce((a, b) => a + b, 0), i = 0;
    while (i < ws.length - 1 && r > ws[i]) { r -= ws[i]; i++; }
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

async function escalaAtiva() {
  const { rows } = await db.query('SELECT e.*, u.name AS por_nome FROM almox_escalas e LEFT JOIN users u ON u.id = e.gerada_por WHERE ativa ORDER BY gerada_em DESC LIMIT 1');
  if (!rows.length) return null;
  const e = rows[0];
  const { rows: its } = await db.query('SELECT i.material_id, i.responsavel_id, u.name FROM almox_escala_itens i LEFT JOIN users u ON u.id = i.responsavel_id WHERE escala_id = $1', [e.id]);
  return { id: e.id, generatedAt: e.gerada_em, by: e.por_nome, category: e.categoria, method: e.metodo, weekStart: e.semana_inicio, items: its.map((i) => ({ materialId: i.material_id, assigneeId: i.responsavel_id, assignee: i.name || '—' })) };
}

/** Responsável pelo Serviço de Almoxarifado: Administrativo ou chefia/diretoria com acesso ao módulo. */
const isResponsavel = (u) => !!u && (u.isAdmin || (u.modules.includes('almoxarifado') && ['Chefia', 'Diretoria'].includes(u.hierarchy)));
const canFix = (u) => !!u && (u.isAdmin || u.roles.includes('Almoxarifado'));

/* ---------------- Alertas e calendário ---------------- */
async function alerts() {
  const cfg = await config.snapshot();
  const out = [];
  const items = await materiais();
  if (cfg('almox.alertaPainel') !== false) {
    items.filter((i) => i.avgConsumption > 0 && i.stock < i.avgConsumption * cfg('almox.critico')).forEach((i) => out.push({
      id: 'est-' + i.digits, module: 'almoxarifado', category: 'ALMOXARIFADO', level: 'critical', title: 'Estoque crítico — ' + i.name,
      description: `Saldo ${i.stock} ${i.unit} · consumo médio ${i.avgConsumption}/mês`, href: '/almoxarifado?view=estoque'
    }));
  }
  items.filter((i) => i.count && i.count.status === 'divergente').forEach((i) => out.push({
    id: 'cnt-' + i.digits + '-' + new Date(i.count.at).getTime(), module: 'almoxarifado', category: 'ALMOXARIFADO', level: 'warning', title: 'Corrigir estoque — ' + i.name,
    description: `Contado ${i.count.counted} · sistema ${i.count.stock} (${i.count.diff > 0 ? '+' : ''}${i.count.diff}) · ${i.count.by || ''}`, href: '/almoxarifado'
  }));
  const pend = await pendentesAgrupados();
  if (pend.length) out.push({ id: 'est-pend-' + pend.length, module: 'almoxarifado', category: 'ALMOXARIFADO', level: 'warning', title: pend.length + ' código(s) de material não cadastrado(s)', description: 'Movimentos de RME/BRM aguardando cadastro para entrar no saldo', href: '/almoxarifado?view=estoque' });
  return out;
}

async function calendarEvents() {
  const p = await params();
  const e = await escalaAtiva();
  const ev = [];
  const base = e ? e.weekStart : weekStart(today());
  [0, 7].forEach((offset) => {
    const ws = addDays(base, offset);
    const ds = p.days.map((d) => addDays(ws, DAYS.indexOf(d))).filter((x) => x >= addDays(today(), -7));
    if (ds.length) ev.push({ title: `Contagem por amostragem — semana de ${ws.split('-').reverse().join('/')}` + (offset === 0 && e ? ` (${e.items.length} itens)` : ''), start: ds[0], end: ds[ds.length - 1], level: 'info', href: '/almoxarifado' });
  });
  return ev;
}

module.exports = {
  UNITS, CATS, PRIORIDADES, DAYS, digits, fmtCode, pdfText, applyDocument, processPdf, report, materiais, documentos, pendentesAgrupados, criarMaterial,
  params, summary, sortear, weekStart, escalaAtiva, isResponsavel, canFix, alerts, calendarEvents, prKey
};
