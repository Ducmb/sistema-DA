/**
 * Compras & Licitações (módulo compras).
 */
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const C = require('../services/compras');
const catalogo = require('../services/catalogo');
const { ah, parse, idParam, notFound, badRequest, conflict, forbidden } = require('../lib/http');
const { csv } = require('../lib/csv');
const { today, year, fmtBR, brl } = require('../lib/dates');

const router = express.Router();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const money = z.coerce.number().min(0, 'Valor inválido.').max(1e12);
const anoOf = (req) => { const a = +req.query.ano; return a >= 2000 && a <= 2100 ? a : +(req.user.preferences.exercicio || year(today())); };

/* ---------------- Metadados ---------------- */
router.get('/meta', ah(async (req, res) => {
  const cfg = await config.snapshot();
  res.json({
    stages: C.STAGES, modos: C.MODOS, agents: await C.agents(), isChefia: C.isChefia(req.user), me: req.user.id,
    chefiaConfirma: cfg('compras.chefiaConfirma'), sugerirAgente: cfg('compras.sugerirAgente'), refazerJust: cfg('compras.refazerJust'), sla: cfg('compras.sla'),
    legal: C.legal(cfg)
  });
}));

/* ---------------- Controle de processos ---------------- */
async function procPayload(req) {
  const sla = await config.get('compras.sla');
  const [procs, agents] = await Promise.all([C.loadProcesses(), C.agents()]);
  const ls = C.loads(procs, agents, sla);
  const sug = C.suggestAgent(ls);
  return {
    items: procs.map((p) => ({ ...p, ...C.procInfo(p, sla), canEdit: C.canEdit(p, req.user) })),
    loads: ls, suggested: sug ? sug.agenteId : null, unassigned: procs.filter((p) => !p.agenteId).length
  };
}

router.get('/processos', ah(async (req, res) => res.json(await procPayload(req))));

const procSchema = z.object({
  interno: z.string().trim().min(1, 'Informe o nº do processo interno.').max(30),
  externo: z.string().trim().max(30).optional(),
  objeto: z.string().trim().min(3, 'Informe o objeto.').max(400),
  modo: z.enum(C.MODOS),
  setor: z.string().trim().min(1, 'Informe o setor requisitante.').max(160),
  valor: money.default(0)
});

async function getProc(id) {
  const [p] = await C.loadProcesses('WHERE p.id = $1', [id]);
  if (!p) throw notFound('Processo não encontrado.');
  return p;
}
async function checkAgent(agenteId) {
  if (agenteId == null) return null;
  const a = (await C.agents()).find((x) => x.id === agenteId);
  if (!a) throw badRequest('Agente de contratação inválido.');
  return a;
}

router.post('/processos', ah(async (req, res) => {
  const b = parse(procSchema.extend({ agenteId: z.number().int().positive('Selecione o agente de contratação.') }), req.body);
  const chefia = C.isChefia(req.user);
  if (!chefia && (await config.get('compras.chefiaConfirma'))) throw forbidden('A atribuição precisa ser confirmada pela chefia.');
  const ag = await checkAgent(b.agenteId);
  const dup = await db.query('SELECT 1 FROM compras_processos WHERE interno = $1', [b.interno]);
  if (dup.rows.length) throw conflict('Já existe processo com este número interno.');
  const id = await db.tx(async (c) => {
    const r = await c.query('INSERT INTO compras_processos (interno, externo, objeto, modo, setor, valor, agente_id, criado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [b.interno, b.externo || '—', b.objeto, b.modo, b.setor, b.valor, ag.id, req.user.id]);
    for (let i = 0; i < 24; i++) await c.query('INSERT INTO compras_etapas (processo_id, idx, status, since) VALUES ($1,$2,$3,$4)', [r.rows[0].id, i, 'pend', i === 0 ? today() : null]);
    return r.rows[0].id;
  });
  await audit.log(req, { action: 'Processo criado', module: 'compras', detail: `${b.interno} · ${b.modo} · ${ag.name}` });
  res.status(201).json(await getProc(id));
}));

router.put('/processos/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const p = await getProc(id);
  if (!C.canEdit(p, req.user)) throw forbidden('Somente o agente responsável e a chefia editam este processo.');
  const b = parse(procSchema, req.body);
  const dup = await db.query('SELECT 1 FROM compras_processos WHERE interno = $1 AND id <> $2', [b.interno, id]);
  if (dup.rows.length) throw conflict('Já existe processo com este número interno.');
  await db.query('UPDATE compras_processos SET interno=$1, externo=COALESCE($2, externo), objeto=$3, modo=$4, setor=$5, valor=$6, updated_at=NOW() WHERE id=$7',
    [b.interno, b.externo || null, b.objeto, b.modo, b.setor, b.valor, id]);
  await audit.log(req, { action: 'Processo editado', module: 'compras', detail: b.interno });
  res.json(await getProc(id));
}));

router.delete('/processos/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  if (!C.isChefia(req.user)) throw forbidden('Somente a chefia remove processos.');
  const p = await getProc(id);
  await db.query('DELETE FROM compras_processos WHERE id = $1', [id]);
  await audit.log(req, { action: 'Processo removido', module: 'compras', detail: p.interno + ' · ' + p.objeto, level: 'warning' });
  res.json({ success: true });
}));

router.put('/processos/:id/agente', ah(async (req, res) => {
  const id = idParam(req.params.id);
  if (!C.isChefia(req.user)) throw forbidden('Somente a chefia transfere processos.');
  const { agenteId } = parse(z.object({ agenteId: z.number().int().positive().nullable() }), req.body);
  const p = await getProc(id);
  if ((p.agenteId || null) === agenteId) throw badRequest('O processo já está com este agente.');
  const ag = await checkAgent(agenteId);
  await db.query('UPDATE compras_processos SET agente_id = $1, updated_at = NOW() WHERE id = $2', [agenteId, id]);
  await audit.log(req, { action: ag ? (p.agenteId ? 'Processo transferido' : 'Processo atribuído') : 'Processo retirado do agente', module: 'compras', detail: `${p.interno} · ${p.agente || 'Sem agente'} → ${ag ? ag.name : 'Sem agente'}` });
  res.json(await getProc(id));
}));

router.put('/processos/:id/etapas/:idx', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const idx = +req.params.idx;
  if (!(Number.isInteger(idx) && idx >= 0 && idx < 24)) throw badRequest('Etapa inválida.');
  const b = parse(z.object({ status: z.enum(['pend', 'ok', 'refazer', 'na']), justificativa: z.string().trim().max(1000).optional().default('') }), req.body);
  const p = await getProc(id);
  if (!C.canEdit(p, req.user)) throw forbidden(`Somente leitura: apenas ${p.agente || 'o agente responsável'} e a chefia podem marcar etapas.`);
  if (b.status === 'refazer' && !b.justificativa && (await config.get('compras.refazerJust'))) throw badRequest('A justificativa é obrigatória para "Refazer".');
  await db.tx(async (c) => {
    await c.query('UPDATE compras_etapas SET status=$1, data=$2, por=$3, justificativa=$4, since=NULL WHERE processo_id=$5 AND idx=$6',
      [b.status, today(), req.user.id, b.status === 'refazer' ? b.justificativa : null, id, idx]);
    // A primeira etapa pendente passa a contar o prazo a partir de hoje
    await c.query(`UPDATE compras_etapas SET since = $2 WHERE processo_id = $1 AND since IS NULL AND idx = (SELECT MIN(idx) FROM compras_etapas WHERE processo_id = $1 AND status = 'pend')`, [id, today()]);
    await c.query('UPDATE compras_processos SET updated_at = NOW() WHERE id = $1', [id]);
  });
  const LABEL = { pend: 'Pendente', ok: 'Concluída', refazer: 'Refazer', na: 'Não se aplica' };
  await audit.log(req, { action: b.status === 'refazer' ? 'Etapa marcada para refazer' : 'Etapa atualizada', module: 'compras', detail: `Processo ${p.interno} · ${C.STAGES[idx].label}: ${LABEL[b.status]}` + (b.justificativa && b.status === 'refazer' ? ' — ' + b.justificativa : ''), level: b.status === 'refazer' ? 'warning' : 'info' });
  const sla = await config.get('compras.sla');
  const np = await getProc(id);
  res.json({ ...np, ...C.procInfo(np, sla), canEdit: C.canEdit(np, req.user) });
}));

/* ---------------- Contratos ---------------- */
router.get('/contratos', ah(async (req, res) => {
  const ano = anoOf(req), cfg = await config.snapshot();
  const all = (await C.loadContracts()).filter((c) => C.inYear(c, ano));
  const items = all.map((c) => {
    const ci = C.contractInfo(c, ano, cfg);
    const prev = ano - 1;
    return { ...c, notas: undefined, hist: undefined, mensal: C.mensal(c, ano), faltantes: C.notasFaltantes(c, ano), info: ci,
      historico: c.hist[prev] ? { ano: prev, ...c.hist[prev], mensal: c.notas[prev] || null } : (c.notas[prev] ? { ano: prev, assinatura: null, inicio: null, fim: null, mensal: c.notas[prev] } : null) };
  });
  res.json({
    ano, items,
    kpis: { ativos: items.length, vencer: items.filter((x) => x.info.dias <= cfg('compras.avisoAzul')).length, saldoBaixo: items.filter((x) => x.info.saldoBaixo).length, empenhado: items.reduce((a, x) => a + x.empenhado, 0) },
    avisos: { azul: cfg('compras.avisoAzul'), amarelo: cfg('compras.avisoAmarelo'), vermelho: cfg('compras.avisoVermelho'), saldoMin: cfg('compras.saldoMin') }
  });
}));

const contratoSchema = z.object({
  contratada: z.string().trim().min(2, 'Informe contratada, nº do contrato, assinatura e final.').max(200),
  contrato: z.string().trim().min(1, 'Informe contratada, nº do contrato, assinatura e final.').max(30),
  processo: z.string().trim().max(30).optional().default(''),
  assinatura: z.string().regex(ISO, 'Informe contratada, nº do contrato, assinatura e final.'),
  fim: z.string().regex(ISO, 'Informe contratada, nº do contrato, assinatura e final.'),
  empenhado: money.default(0),
  aditamentos: z.coerce.number().int().min(0).max(99).default(0)
}).refine((b) => b.fim >= b.assinatura, { message: 'O final do contrato deve ser posterior à assinatura.', path: ['fim'] });

async function saveContrato(req, id) {
  const b = parse(contratoSchema, req.body);
  const dup = await db.query('SELECT 1 FROM contratos WHERE contrato = $1 AND lower(contratada) = lower($2) AND ($3::int IS NULL OR id <> $3)', [b.contrato, b.contratada, id || null]);
  if (dup.rows.length) throw conflict('Já existe contrato com este número para esta contratada.');
  const forn = await db.query('SELECT id FROM fornecedores WHERE lower(nome) = lower($1)', [b.contratada]);
  const fid = forn.rows[0] ? forn.rows[0].id : null;
  if (id) {
    const r = await db.query('UPDATE contratos SET contratada=$1, contrato=$2, processo=$3, assinatura=$4, fim=$5, empenhado=$6, aditamentos=$7, fornecedor_id=COALESCE($8, fornecedor_id), updated_at=NOW() WHERE id=$9 RETURNING id',
      [b.contratada, b.contrato, b.processo || null, b.assinatura, b.fim, b.empenhado, b.aditamentos, fid, id]);
    if (!r.rows.length) throw notFound('Contrato não encontrado.');
  } else {
    const r = await db.query('INSERT INTO contratos (contratada, contrato, processo, assinatura, fim, empenhado, aditamentos, fornecedor_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [b.contratada, b.contrato, b.processo || null, b.assinatura, b.fim, b.empenhado, b.aditamentos, fid]);
    id = r.rows[0].id;
    if (fid) await db.query("INSERT INTO fornecedor_eventos (fornecedor_id, data, tipo, titulo, detalhe) VALUES ($1,$2,'contrato',$3,$4)", [fid, b.assinatura, 'Contrato nº ' + b.contrato + ' assinado', 'Vigência até ' + fmtBR(b.fim)]);
  }
  await audit.log(req, { action: req.method === 'POST' ? 'Contrato cadastrado' : 'Contrato editado', module: 'compras', detail: b.contrato + ' · ' + b.contratada });
  return id;
}
router.post('/contratos', ah(async (req, res) => res.status(201).json({ id: await saveContrato(req) })));
router.put('/contratos/:id', ah(async (req, res) => res.json({ id: await saveContrato(req, idParam(req.params.id)) })));

router.put('/contratos/:id/notas/:ano/:mes', ah(async (req, res) => {
  const id = idParam(req.params.id), ano = +req.params.ano, mes = +req.params.mes;
  if (!(ano >= 2000 && ano <= 2100 && mes >= 0 && mes <= 11)) throw badRequest('Mês inválido.');
  const { valor } = parse(z.object({ valor: money }), req.body);
  const c = await db.query('SELECT contrato, contratada FROM contratos WHERE id = $1', [id]);
  if (!c.rows.length) throw notFound('Contrato não encontrado.');
  await db.query('INSERT INTO contrato_notas (contrato_id, ano, mes, valor) VALUES ($1,$2,$3,$4) ON CONFLICT (contrato_id, ano, mes) DO UPDATE SET valor = $4', [id, ano, mes, valor]);
  await audit.log(req, { action: 'Nota fiscal lançada', module: 'compras', detail: `Contrato ${c.rows[0].contrato} · ${String(mes + 1).padStart(2, '0')}/${ano}: ${brl(valor)}` });
  res.json({ success: true });
}));

/* ---------------- Despesas, verbinha e limites legais ---------------- */
router.get('/despesas', ah(async (req, res) => {
  const ano = anoOf(req), cfg = await config.snapshot();
  const all = await C.loadExpenses();
  const data = { expenses: all.expenses.filter((e) => year(e.dataEmpenho) === ano), verbinha: all.verbinha.filter((v) => year(v.data) === ano) };
  const seen = {}, groups = [];
  data.expenses.forEach((e) => {
    const a = C.accumulated(e, data, cfg, ano + '-12-31');
    if (!a || seen[a.chave]) return; seen[a.chave] = 1;
    groups.push({ ...a, descricao: e.descricao + (a.eng ? ' (engenharia)' : '') });
  });
  groups.sort((a, b) => b.pct - a.pct);
  const contracts = (await C.loadContracts()).filter((c) => C.inYear(c, ano));
  res.json({
    ano, legal: C.legal(cfg), tcnPrazo: cfg('compras.tcnPrazo'), groups,
    rows: data.expenses.map((e) => ({ ...e, acumulado: C.accumulated(e, data, cfg) })),
    verbinha: data.verbinha,
    contractOptions: contracts.map((c) => ({ value: c.id, label: c.contrato + ' — ' + c.contratada.split(' ')[0] }))
  });
}));

const despesaSchema = z.object({
  processo: z.string().trim().min(1, 'Informe processo, objeto, valor e a Classe ou o Grupo.').max(30),
  objeto: z.string().trim().min(1, 'Informe processo, objeto, valor e a Classe ou o Grupo.').max(300),
  descricao: z.string().trim().max(300).optional().default(''),
  catmat: z.string().trim().max(20).optional().default(''),
  classe: z.string().trim().max(10).optional().default(''),
  catser: z.string().trim().max(20).optional().default(''),
  grupo: z.string().trim().max(10).optional().default(''),
  modalidade: z.string().trim().max(40).optional().default('Dispensa'),
  empenhado: z.coerce.number().positive('Informe processo, objeto, valor e a Classe ou o Grupo.'),
  dataEmpenho: z.string().regex(ISO, 'Informe a data do empenho.'),
  ficha: z.string().trim().max(10).optional().default(''),
  sub: z.string().trim().max(10).optional().default('')
}).refine((b) => b.classe || b.grupo, { message: 'Informe processo, objeto, valor e a Classe ou o Grupo.', path: ['classe'] });

router.post('/despesas', ah(async (req, res) => {
  const b = parse(despesaSchema, req.body);
  const tcn = /dispensa/i.test(b.modalidade) ? '' : 'NA';
  const r = await db.query(
    `INSERT INTO despesas (processo, objeto, descricao, catmat, classe, catser, grupo, modalidade, empenhado, reserva, data, data_empenho, ficha, sub, tcn)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$10,$11,$12,$13) RETURNING id`,
    [b.processo, b.objeto, b.descricao || null, b.catmat || null, b.classe || null, b.catser || null, b.grupo || null, b.modalidade, b.empenhado, b.dataEmpenho, b.ficha || null, b.sub || null, tcn]);
  await audit.log(req, { action: 'Despesa incluída', module: 'compras', detail: b.processo + ' · ' + b.objeto });
  res.status(201).json({ id: r.rows[0].id });
}));

router.put('/despesas/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(despesaSchema, req.body);
  const r = await db.query(
    `UPDATE despesas SET processo=$1, objeto=$2, descricao=$3, catmat=$4, classe=$5, catser=$6, grupo=$7, modalidade=$8, empenhado=$9, data_empenho=$10, ficha=$11, sub=$12 WHERE id=$13 RETURNING id`,
    [b.processo, b.objeto, b.descricao || null, b.catmat || null, b.classe || null, b.catser || null, b.grupo || null, b.modalidade, b.empenhado, b.dataEmpenho, b.ficha || null, b.sub || null, id]);
  if (!r.rows.length) throw notFound('Despesa não encontrada.');
  await audit.log(req, { action: 'Despesa editada', module: 'compras', detail: b.processo + ' · ' + b.objeto });
  res.json({ id });
}));

router.patch('/despesas/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(z.object({ audesp: z.enum(['', 'Enviado', 'NA']).optional(), tcn: z.enum(['', 'Enviado', 'NA']).optional(), contratoId: z.number().int().positive().nullable().optional() }), req.body);
  const sets = [], p = [];
  if (b.audesp !== undefined) { p.push(b.audesp); sets.push('audesp = $' + p.length); }
  if (b.tcn !== undefined) { p.push(b.tcn); sets.push('tcn = $' + p.length); }
  if (b.contratoId !== undefined) { p.push(b.contratoId); sets.push('contrato_id = $' + p.length); }
  if (!sets.length) throw badRequest('Nada a alterar.');
  p.push(id);
  const r = await db.query(`UPDATE despesas SET ${sets.join(', ')} WHERE id = $${p.length} RETURNING processo, objeto`, p);
  if (!r.rows.length) throw notFound('Despesa não encontrada.');
  const what = b.audesp !== undefined ? 'AUDESP: ' + (b.audesp || 'Pendente') : b.tcn !== undefined ? 'TCN: ' + (b.tcn || 'Pendente') : 'Contrato vinculado';
  await audit.log(req, { action: 'Despesa atualizada', module: 'compras', detail: `${r.rows[0].processo} · ${what}` });
  res.json({ success: true });
}));

/* Limites legais: simulador de contratação direta e catálogo */
router.get('/limites', ah(async (req, res) => {
  const cfg = await config.snapshot();
  res.json({ legal: C.legal(cfg), catalogo: await catalogo.status(), itens: await catalogo.itens() });
}));

router.post('/limites/simular', ah(async (req, res) => {
  const b = parse(z.object({ itemId: z.number().int().positive(), valor: z.coerce.number().positive('Informe o valor da contratação.') }), req.body);
  const it = (await catalogo.itens()).find((x) => x.id === b.itemId);
  if (!it) throw notFound('Item do catálogo não encontrado.');
  const cfg = await config.snapshot();
  const all = await C.loadExpenses();
  const hoje = today(), ano = year(hoje);
  const data = { expenses: all.expenses.filter((e) => year(e.dataEmpenho) === ano), verbinha: all.verbinha.filter((v) => year(v.data) === ano) };
  // CATMAT acumula pela Classe; CATSER pelo Grupo (Decreto 12.807/2025)
  const key = it.catalogo === 'CATMAT' ? { classe: it.classe_cod, grupo: '' } : { classe: '', grupo: it.grupo_cod };
  const a = C.accumulated(key, data, cfg, hoje);
  const saldo = a.limite - a.total;
  const ok = b.valor <= saldo;
  res.json({ ok, chave: a.chave, acumulado: a.total, limite: a.limite, saldo, saldoApos: saldo - b.valor, eng: a.eng });
}));

router.post('/catalogo/sync', ah(async (req, res) => {
  if (!C.isChefia(req.user)) throw forbidden('Somente a chefia dispara a sincronização manual.');
  const r = await catalogo.sync(req.user.id);
  await audit.log(req, { action: 'Sincronização do catálogo', module: 'compras', detail: r.status, level: r.modo === 'api' ? 'info' : 'warning' });
  res.json(await catalogo.status());
}));

/* ---------------- Dotação orçamentária ---------------- */
router.get('/dotacoes', ah(async (req, res) => {
  const ano = anoOf(req);
  const { rows } = await db.query('SELECT * FROM dotacoes WHERE ano = $1', [ano]);
  const { expenses } = await C.loadExpenses();
  const items = rows.map((d) => {
    const x = { id: d.id, ano: d.ano, ficha: d.ficha, sub: d.sub, descricao: d.descricao, orcado: +d.orcado };
    return { ...x, info: C.dotacaoInfo(x, expenses) };
  }).sort((a, b) => b.info.pct - a.info.pct);
  res.json({ ano, items });
}));

const dotSchema = z.object({
  ficha: z.string().trim().min(1, 'Informe a ficha.').max(10),
  sub: z.string().trim().max(10).optional().default('—'),
  descricao: z.string().trim().max(300).optional().default(''),
  orcado: z.coerce.number().positive('Informe o valor orçado.'),
  ano: z.coerce.number().int().min(2000).max(2100)
});
async function saveDot(req, id) {
  const b = parse(dotSchema, req.body);
  const sub = b.sub || '—';
  const dup = await db.query('SELECT 1 FROM dotacoes WHERE ano=$1 AND ficha=$2 AND sub=$3 AND ($4::int IS NULL OR id <> $4)', [b.ano, b.ficha, sub, id || null]);
  if (dup.rows.length) throw conflict('Já existe dotação com esta Ficha/Sub no exercício.');
  if (id) {
    const r = await db.query('UPDATE dotacoes SET ficha=$1, sub=$2, descricao=$3, orcado=$4, ano=$5 WHERE id=$6 RETURNING id', [b.ficha, sub, b.descricao, b.orcado, b.ano, id]);
    if (!r.rows.length) throw notFound('Dotação não encontrada.');
  } else {
    id = (await db.query('INSERT INTO dotacoes (ficha, sub, descricao, orcado, ano) VALUES ($1,$2,$3,$4,$5) RETURNING id', [b.ficha, sub, b.descricao, b.orcado, b.ano])).rows[0].id;
  }
  await audit.log(req, { action: req.method === 'POST' ? 'Dotação cadastrada' : 'Dotação editada', module: 'compras', detail: `Ficha ${b.ficha} · Sub ${sub} · ${brl(b.orcado)} (${b.ano})` });
  return id;
}
router.post('/dotacoes', ah(async (req, res) => res.status(201).json({ id: await saveDot(req) })));
router.put('/dotacoes/:id', ah(async (req, res) => res.json({ id: await saveDot(req, idParam(req.params.id)) })));

/* ---------------- Fornecedores ---------------- */
const fornOf = (f) => ({ id: f.id, name: f.nome, cnpj: f.cnpj, contact: f.telefone || '', email: f.email, segments: f.segmentos || [], active: f.ativo, since: f.desde ? String(f.desde) : '' });

async function listFornecedores(q) {
  const p = [], where = [];
  if (q.status === 'inativos') where.push('NOT ativo'); else if (q.status !== 'todos') where.push('ativo');
  if (q.segmento && q.segmento !== 'todos') { p.push(q.segmento); where.push(`$${p.length} = ANY(segmentos)`); }
  if (q.q) { p.push('%' + String(q.q).toLowerCase() + '%'); where.push(`(lower(nome) LIKE $${p.length} OR cnpj LIKE $${p.length})`); }
  const { rows } = await db.query(`SELECT * FROM fornecedores ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY nome`, p);
  return rows.map(fornOf);
}

router.get('/fornecedores', ah(async (req, res) => {
  const { rows } = await db.query('SELECT DISTINCT unnest(segmentos) AS s FROM fornecedores ORDER BY 1');
  res.json({ items: await listFornecedores(req.query), segments: rows.map((r) => r.s) });
}));

router.get('/fornecedores/export.csv', ah(async (req, res) => {
  const list = await listFornecedores(req.query);
  await audit.log(req, { kind: 'exportacao', action: 'Exportação de fornecedores', module: 'compras', detail: list.length + ' fornecedor(es) · segmento ' + (req.query.segmento || 'todos') });
  csv(res, 'fornecedores_' + String(req.query.segmento || 'todos').toLowerCase().replace(/\s+/g, '-') + '.csv',
    [['Razão social', 'CNPJ', 'Segmento', 'E-mail', 'Telefone', 'Situação']].concat(list.map((s) => [s.name, s.cnpj, s.segments.join(', '), s.email, s.contact, s.active ? 'Ativo' : 'Inativo'])));
}));

const CNPJ_RE = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
const fornSchema = z.object({
  name: z.string().trim().min(2, 'Informe razão social e segmento.').max(200),
  cnpj: z.string().trim().regex(CNPJ_RE, 'CNPJ deve ter 14 dígitos.'),
  contact: z.string().trim().max(20).optional().default(''),
  email: z.string().trim().toLowerCase().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'E-mail inválido.').max(160),
  segments: z.array(z.string().trim().min(1).max(80)).min(1, 'Informe razão social e segmento.').max(20),
  since: z.string().trim().regex(/^(\d{4})?$/, 'Ano inválido.').optional().default('')
});

router.post('/fornecedores', ah(async (req, res) => {
  const b = parse(fornSchema, req.body);
  const dup = await db.query('SELECT 1 FROM fornecedores WHERE cnpj = $1', [b.cnpj]);
  if (dup.rows.length) throw conflict('Já existe fornecedor com este CNPJ.');
  const { rows } = await db.query('INSERT INTO fornecedores (nome, cnpj, telefone, email, segmentos, desde) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [b.name, b.cnpj, b.contact || null, b.email, [...new Set(b.segments)], b.since ? +b.since : null]);
  await db.query("INSERT INTO fornecedor_eventos (fornecedor_id, data, tipo, titulo, detalhe) VALUES ($1,$2,'cadastro','Cadastro homologado','Fornecedor incluído no cadastro')", [rows[0].id, today()]);
  await audit.log(req, { action: 'Fornecedor cadastrado', module: 'compras', detail: b.name + ' · ' + b.cnpj });
  res.status(201).json(fornOf(rows[0]));
}));

router.put('/fornecedores/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(fornSchema, req.body);
  const dup = await db.query('SELECT 1 FROM fornecedores WHERE cnpj = $1 AND id <> $2', [b.cnpj, id]);
  if (dup.rows.length) throw conflict('Já existe fornecedor com este CNPJ.');
  const { rows } = await db.query('UPDATE fornecedores SET nome=$1, cnpj=$2, telefone=$3, email=$4, segmentos=$5, desde=$6, updated_at=NOW() WHERE id=$7 RETURNING *',
    [b.name, b.cnpj, b.contact || null, b.email, [...new Set(b.segments)], b.since ? +b.since : null, id]);
  if (!rows.length) throw notFound('Fornecedor não encontrado.');
  await audit.log(req, { action: 'Fornecedor editado', module: 'compras', detail: b.name });
  res.json(fornOf(rows[0]));
}));

router.patch('/fornecedores/:id/ativo', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const { ativo } = parse(z.object({ ativo: z.boolean() }), req.body);
  const { rows } = await db.query('UPDATE fornecedores SET ativo = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [ativo, id]);
  if (!rows.length) throw notFound('Fornecedor não encontrado.');
  await db.query("INSERT INTO fornecedor_eventos (fornecedor_id, data, tipo, titulo, detalhe) VALUES ($1,$2,'situacao',$3,'Alteração de situação cadastral')", [id, today(), ativo ? 'Fornecedor reativado' : 'Fornecedor inativado']);
  await audit.log(req, { action: ativo ? 'Fornecedor reativado' : 'Fornecedor inativado', module: 'compras', detail: rows[0].nome, level: ativo ? 'info' : 'warning' });
  res.json(fornOf(rows[0]));
}));

router.get('/fornecedores/:id/historico', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const f = await db.query('SELECT * FROM fornecedores WHERE id = $1', [id]);
  if (!f.rows.length) throw notFound('Fornecedor não encontrado.');
  const { rows } = await db.query('SELECT * FROM fornecedor_eventos WHERE fornecedor_id = $1 ORDER BY data DESC, id DESC', [id]);
  const COLOR = { cadastro: 'success', cotacao: 'info', contrato: 'success', ocorrencia: 'warning', situacao: 'info' };
  const events = rows.map((e) => ({ id: e.id, title: e.titulo, detail: e.detalhe || '', date: e.data, tipo: e.tipo, level: e.tipo === 'situacao' && /inativ/.test(e.titulo) ? 'critical' : COLOR[e.tipo] }));
  res.json({
    supplier: fornOf(f.rows[0]), events,
    stats: { cotacoes: rows.filter((e) => e.tipo === 'cotacao').length, contratos: rows.filter((e) => e.tipo === 'contrato').length, ocorrencias: rows.filter((e) => e.tipo === 'ocorrencia').length }
  });
}));

module.exports = router;
