/**
 * Almoxarifado (módulo almoxarifado): contagem por amostragem, parametrização, base completa e atualização de estoque.
 */
const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const db = require('../db');
const audit = require('../services/audit');
const config = require('../services/config');
const E = require('../services/estoque');
const drive = require('../jobs/estoqueSync');
const { ah, parse, idParam, notFound, badRequest, conflict, forbidden } = require('../lib/http');
const { today } = require('../lib/dates');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 200 },
  fileFilter: (req, f, cb) => cb(null, /\.pdf$/i.test(f.originalname) || f.mimetype === 'application/pdf')
});
const nf = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/* ---------------- Visão geral (Contagem) ---------------- */
router.get('/resumo', ah(async (req, res) => {
  const cfg = await config.snapshot();
  const [items, p] = await Promise.all([E.materiais(), E.params()]);
  const crit = items.filter((i) => i.avgConsumption > 0 && i.stock < i.avgConsumption * cfg('almox.critico')).length;
  const sumStock = items.reduce((t, i) => t + i.stock, 0), sumCons = items.reduce((t, i) => t + i.avgConsumption, 0);
  const cnt = (k) => items.filter((i) => E.prKey(i.priority) === k).length;
  const cats = [...new Set(items.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  res.json({
    stats: { total: items.length, giro: sumStock ? sumCons / sumStock : 0, criticos: crit, criticoMeses: cfg('almox.critico') },
    workforce: { ...E.summary(p), perSession: p.perSession },
    categories: cats.map((c) => ({ value: c, count: items.filter((i) => i.category === c).length })),
    methods: { alta: cnt('alta'), media: cnt('media'), baixa: cnt('baixa'), total: items.length },
    defaultMethod: p.method,
    team: p.team.filter((m) => m.active).map((m) => ({ id: m.userId, name: m.name })),
    isResponsavel: E.isResponsavel(req.user)
  });
}));

/* ---------------- Base completa ---------------- */
router.get('/materiais', ah(async (req, res) => {
  const [items, escala] = await Promise.all([E.materiais(), E.escalaAtiva()]);
  res.json({ items, escala, me: req.user.id, isResponsavel: E.isResponsavel(req.user), canFix: E.canFix(req.user), pageSize: await config.get('almox.pageBase'), units: E.UNITS, categories: E.CATS });
}));

const materialSchema = z.object({
  code: z.string().refine((v) => E.digits(v).length === 10, 'O código deve ter 10 dígitos, no formato 1 50 02 0018 0.'),
  name: z.string().trim().min(2, 'Informe a descrição do material.').max(255),
  unit: z.string().trim().min(1).max(10).default('UN'),
  category: z.string().trim().min(1).max(60).default('Papelaria'),
  priority: z.enum(E.PRIORIDADES).default('Baixa'),
  stock: z.coerce.number().min(0, 'O estoque inicial não pode ser negativo.').default(0),
  avgConsumption: z.coerce.number().min(0).default(0)
});

router.post('/materiais', ah(async (req, res) => {
  const b = parse(materialSchema, req.body);
  const r = await db.tx((c) => E.criarMaterial(c, b, req.user.id));
  if (!r) throw conflict('Já existe um item com este código.');
  await audit.log(req, { action: 'Material cadastrado', module: 'almoxarifado', detail: E.fmtCode(b.code) + ' · ' + b.name.toUpperCase() + (r.aplicados ? ` · ${r.aplicados} movimento(s) pendente(s) aplicado(s)` : '') });
  res.status(201).json(r);
}));

router.put('/materiais/:id', ah(async (req, res) => {
  const id = idParam(req.params.id);
  const b = parse(materialSchema.omit({ code: true, stock: true }), req.body);
  const { rows } = await db.query('UPDATE materiais SET descricao=$1, unidade=$2, categoria=$3, prioridade=$4, consumo_medio=$5, atualizado_em=NOW() WHERE id=$6 RETURNING codigo',
    [b.name.toUpperCase(), b.unit, b.category, b.priority, b.avgConsumption, id]);
  if (!rows.length) throw notFound('Material não encontrado.');
  await audit.log(req, { action: 'Material editado', module: 'almoxarifado', detail: rows[0].codigo + ' · ' + b.name.toUpperCase() });
  res.json({ success: true });
}));

/* ---------------- Parametrização (responsável) ---------------- */
router.get('/params', ah(async (req, res) => {
  const p = await E.params();
  const { rows } = await db.query(
    `SELECT DISTINCT u.id, u.name FROM users u JOIN user_roles r ON r.user_id = u.id
      WHERE u.situacao = 'Ativo' AND r.role IN ('Almoxarifado', 'Administrativo', 'Patrimônio') ORDER BY u.name`);
  res.json({ ...p, summary: E.summary(p), candidates: rows, isResponsavel: E.isResponsavel(req.user), days: p.days, allDays: E.DAYS });
}));

router.put('/params', ah(async (req, res) => {
  if (!E.isResponsavel(req.user)) throw forbidden('Área restrita ao responsável pelo Serviço de Almoxarifado e Patrimônio.');
  const b = parse(z.object({
    team: z.array(z.object({ userId: z.number().int().positive(), active: z.boolean() })).max(50),
    days: z.array(z.enum(E.DAYS)).max(5),
    weights: z.object({ alta: z.number().int().min(0).max(100), media: z.number().int().min(0).max(100), baixa: z.number().int().min(0).max(100) }),
    calcBase: z.enum(['dias', 'sessoes']),
    perSession: z.coerce.number().int().min(1).max(50),
    sessionsPerWeek: z.coerce.number().int().min(1).max(5),
    tolerancePct: z.coerce.number().min(0).max(100),
    recountPct: z.coerce.number().min(0).max(100)
  }), req.body);
  const sum = b.weights.alta + b.weights.media + b.weights.baixa;
  if (sum !== 100) throw badRequest(`A soma dos pesos da Curva ABC deve ser 100% (atual: ${sum}%).`);
  if (!b.team.some((m) => m.active)) throw badRequest('Mantenha ao menos um servidor ativo na equipe.');
  if (b.calcBase === 'dias' && !b.days.length) throw badRequest('Selecione ao menos um dia de contagem.');
  if (b.recountPct < b.tolerancePct) throw badRequest('O limite de recontagem deve ser maior ou igual à tolerância.');
  const ids = [...new Set(b.team.map((m) => m.userId))];
  const { rows } = await db.query('SELECT id FROM users WHERE id = ANY($1)', [ids]);
  if (rows.length !== ids.length) throw badRequest('Servidor inválido na equipe.');
  const days = E.DAYS.filter((d) => b.days.includes(d));
  await db.tx(async (c) => {
    await c.query(
      `INSERT INTO almox_params (id, equipe, dias, pesos, base_calculo, atualizado_em, atualizado_por) VALUES (1,$1,$2,$3,$4,NOW(),$5)
       ON CONFLICT (id) DO UPDATE SET equipe=$1, dias=$2, pesos=$3, base_calculo=$4, atualizado_em=NOW(), atualizado_por=$5`,
      [JSON.stringify(b.team), JSON.stringify(days), JSON.stringify(b.weights), b.calcBase, req.user.id]);
    for (const [k, v] of [['almox.itensSessao', b.perSession], ['almox.sessoesSemana', b.sessionsPerWeek], ['almox.tolerancia', b.tolerancePct], ['almox.recontagem', b.recountPct]]) {
      await c.query('INSERT INTO system_config (key, value, updated_by) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW(), updated_by=$3', [k, JSON.stringify(v), req.user.id]);
    }
  });
  config.invalidate();
  const p = await E.params();
  const s = E.summary(p);
  await audit.log(req, { action: 'Parâmetros do almoxarifado alterados', module: 'almoxarifado', detail: `Equipe ativa: ${s.employees} · ${p.perSession} itens/sessão · ${s.baseLabel} · carga semanal ${s.total}` });
  res.json({ ...p, summary: s });
}));

router.post('/params/reset', ah(async (req, res) => {
  if (!E.isResponsavel(req.user)) throw forbidden('Área restrita ao responsável pelo Serviço de Almoxarifado e Patrimônio.');
  await db.query("UPDATE almox_params SET dias='[\"Seg\",\"Qua\"]', pesos='{\"alta\":60,\"media\":30,\"baixa\":10}', base_calculo='dias', atualizado_em=NOW(), atualizado_por=$1", [req.user.id]);
  await db.query("DELETE FROM system_config WHERE key IN ('almox.itensSessao','almox.sessoesSemana','almox.tolerancia','almox.recontagem')");
  config.invalidate();
  await audit.log(req, { action: 'Parâmetros do almoxarifado restaurados', module: 'almoxarifado', detail: 'Padrão do sistema', level: 'warning' });
  const p = await E.params();
  res.json({ ...p, summary: E.summary(p) });
}));

/* ---------------- Escala da semana ---------------- */
router.post('/escala', ah(async (req, res) => {
  const b = parse(z.object({ category: z.string().max(60).default('todos'), method: z.enum(['alta', 'media', 'baixa', 'balanceado']), responsible: z.union([z.literal('equipe'), z.number().int().positive()]), size: z.number().int().min(1).max(500) }), req.body);
  const p = await E.params();
  const s = E.summary(p);
  const team = p.team.filter((m) => m.active);
  if (!team.length) throw badRequest('Nenhum servidor ativo na equipe da escala.');
  if (b.responsible !== 'equipe' && !team.some((m) => m.userId === b.responsible)) throw badRequest('Responsável fora da equipe ativa.');
  const size = Math.min(b.size, Math.max(1, s.total));
  const picked = E.sortear(await E.materiais(), { category: b.category, method: b.method, size, weights: p.weights });
  if (!picked.length) throw badRequest('Nenhum item elegível para a categoria escolhida.');
  const people = b.responsible === 'equipe' ? team : team.filter((m) => m.userId === b.responsible);
  const id = await db.tx(async (c) => {
    await c.query('UPDATE almox_escalas SET ativa = FALSE WHERE ativa');
    const r = await c.query('INSERT INTO almox_escalas (gerada_por, categoria, metodo, semana_inicio) VALUES ($1,$2,$3,$4) RETURNING id', [req.user.id, b.category, b.method, E.weekStart(today())]);
    for (let i = 0; i < picked.length; i++) await c.query('INSERT INTO almox_escala_itens (escala_id, material_id, responsavel_id) VALUES ($1,$2,$3)', [r.rows[0].id, picked[i].id, people[i % people.length].userId]);
    return r.rows[0].id;
  });
  const names = [...new Set(people.slice(0, picked.length).map((m) => m.name))];
  await audit.log(req, { action: 'Escala de contagem gerada', module: 'almoxarifado', detail: `${picked.length} itens · ${names.join(', ')}` });
  res.status(201).json({ id, count: picked.length, people: names, escala: await E.escalaAtiva() });
}));

router.delete('/escala', ah(async (req, res) => {
  await db.query('UPDATE almox_escalas SET ativa = FALSE WHERE ativa');
  await audit.log(req, { action: 'Escala de contagem limpa', module: 'almoxarifado', detail: 'Escala da semana encerrada' });
  res.json({ success: true });
}));

/* ---------------- Contagens ---------------- */
router.post('/contagens', ah(async (req, res) => {
  const b = parse(z.object({ materialId: z.number().int().positive(), contado: z.coerce.number().min(0, 'Quantidade inválida.') }), req.body);
  const e = await E.escalaAtiva();
  const it = e && e.items.find((i) => i.materialId === b.materialId);
  if (!it) throw badRequest('Item fora da escala da semana.');
  if (it.assigneeId !== req.user.id && !E.isResponsavel(req.user)) throw forbidden(`Somente ${it.assignee} conta este item.`);
  const { rows } = await db.query('SELECT codigo, descricao, saldo FROM materiais WHERE id = $1', [b.materialId]);
  if (!rows.length) throw notFound('Material não encontrado.');
  const m = rows[0], stock = +m.saldo, diff = Math.round((b.contado - stock) * 1000) / 1000;
  const tol = await config.get('almox.tolerancia');
  const status = diff === 0 ? 'ok' : (stock > 0 && (Math.abs(diff) / stock) * 100 <= tol ? 'tolerancia' : 'divergente');
  await db.query('INSERT INTO almox_contagens (material_id, escala_id, contado, sistema, diferenca, status, por) VALUES ($1,$2,$3,$4,$5,$6,$7)', [b.materialId, e.id, b.contado, stock, diff, status, req.user.id]);
  if (status === 'ok') await db.query('UPDATE materiais SET verificar = FALSE WHERE id = $1', [b.materialId]);
  await audit.log(req, { action: status === 'divergente' ? 'Divergência de contagem' : 'Contagem conferida', module: 'almoxarifado', detail: `${m.codigo} · ${m.descricao} · contado ${nf(b.contado)} / sistema ${nf(stock)}`, level: status === 'divergente' ? 'warning' : 'info' });
  res.status(201).json({ status, diff, stock });
}));

router.post('/contagens/:materialId/corrigir', ah(async (req, res) => {
  if (!E.canFix(req.user)) throw forbidden('Somente o Almoxarifado ou o Administrativo corrigem o saldo.');
  const mid = idParam(req.params.materialId);
  const out = await db.tx(async (c) => {
    const { rows } = await c.query("SELECT * FROM almox_contagens WHERE material_id = $1 ORDER BY em DESC, id DESC LIMIT 1 FOR UPDATE", [mid]);
    const k = rows[0];
    if (!k || k.status !== 'divergente') throw badRequest('Não há divergência pendente para este item.');
    const m = (await c.query('SELECT codigo, descricao, saldo FROM materiais WHERE id = $1 FOR UPDATE', [mid])).rows[0];
    const delta = Math.round((+k.contado - +m.saldo) * 1000) / 1000;
    await c.query('UPDATE materiais SET saldo = $1, verificar = FALSE, atualizado_em = NOW() WHERE id = $2', [k.contado, mid]);
    await c.query("INSERT INTO estoque_movimentos (material_id, tipo, referencia, quantidade, saldo_apos, por) VALUES ($1,'Contagem','Ajuste por contagem',$2,$3,$4)", [mid, delta, k.contado, req.user.id]);
    await c.query("UPDATE almox_contagens SET status = 'corrigido', corrigido_por = $1, corrigido_em = NOW() WHERE id = $2", [req.user.id, k.id]);
    return { m, k };
  });
  await audit.log(req, { action: 'Estoque corrigido pela contagem', module: 'almoxarifado', detail: `${out.m.codigo} · ${nf(out.m.saldo)} → ${nf(out.k.contado)}`, level: 'warning' });
  res.json({ success: true });
}));

/* ---------------- Atualização de estoque (RME/BRM) ---------------- */
router.get('/estoque', ah(async (req, res) => {
  const [{ rows: last }, { rows: cnt }, pend] = await Promise.all([
    db.query("SELECT MAX(processado_em) AS last FROM estoque_documentos"),
    db.query('SELECT COUNT(*)::int n FROM estoque_documentos'),
    E.pendentesAgrupados()
  ]);
  let files = null, driveError = null;
  if (drive.configured()) { try { files = await drive.arquivos(); } catch (e) { driveError = 'Não foi possível listar a pasta do Google Drive.'; } }
  res.json({ lastSync: last[0].last, docsCount: cnt[0].n, pendentes: pend.length, drive: { configured: drive.configured(), files, error: driveError }, pageDocs: await config.get('almox.pageDocs'), confirmarNovos: await config.get('almox.confirmarNovos') });
}));

router.get('/estoque/documentos', ah(async (req, res) => {
  const tipo = ['RME', 'BRM'].includes(req.query.tipo) ? req.query.tipo : null;
  const q = String(req.query.q || '').trim().toLowerCase();
  const all = await E.documentos();
  const fl = all.filter((d) => (!tipo || d.tipo === tipo) && (!q || [d.key, d.tipo, d.origem, d.notaFiscal, d.statusDoc, d.data].concat(d.itens.map((i) => i.code + ' ' + i.desc)).join(' ').toLowerCase().includes(q)));
  const ps = await config.get('almox.pageDocs');
  const page = Math.max(0, +req.query.page || 0);
  res.json({ total: all.length, filtered: fl.length, page, pageSize: ps, items: fl.slice(page * ps, page * ps + ps) });
}));

/** Nomes de arquivos já computados (para marcar a pasta local como Computado/Novo). */
router.get('/estoque/arquivos-computados', ah(async (req, res) => {
  const { rows } = await db.query('SELECT arquivo FROM estoque_documentos');
  res.json(rows.map((r) => r.arquivo));
}));

router.post('/estoque/upload', upload.array('files', 200), ah(async (req, res) => {
  const tipo = ['RME', 'BRM'].includes(req.body.tipo) ? req.body.tipo : null;
  const files = req.files || [];
  if (!files.length) throw badRequest('Nenhum PDF enviado.');
  const results = [];
  for (const f of files) {
    const nome = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const { rows } = await db.query('SELECT 1 FROM estoque_documentos WHERE arquivo = $1', [nome]);
    if (rows.length) { results.push({ status: 'ignorado', arquivo: nome, motivo: 'Arquivo já computado' }); continue; }
    results.push(await E.processPdf(f.buffer, { arquivo: nome, fonte: 'upload', userId: req.user.id, tipoPasta: tipo }));
  }
  const rep = E.report(results);
  await audit.log(req, { action: 'Atualização de estoque', module: 'almoxarifado', detail: `${rep.processados.length} documento(s) computado(s): ${rep.processados.map((d) => d.key).join(', ') || 'nenhum novo'}` });
  res.json(rep);
}));

router.post('/estoque/sync', ah(async (req, res) => {
  res.json(await drive.run({ userId: req.user.id, req }));
}));

router.get('/estoque/pendentes', ah(async (req, res) => res.json({ items: await E.pendentesAgrupados(), units: E.UNITS, categories: E.CATS })));

router.post('/estoque/pendentes', ah(async (req, res) => {
  const b = parse(z.object({ decisions: z.array(z.object({
    code: z.string(), decision: z.enum(['aceitar', 'recusar']),
    desc: z.string().trim().max(255).optional().default(''), unit: z.string().trim().max(10).optional().default('UN'),
    category: z.string().trim().max(60).optional().default('Papelaria'), priority: z.enum(E.PRIORIDADES).optional().default('Baixa'), avg: z.coerce.number().min(0).optional().default(0)
  })).min(1) }), req.body);
  const bad = b.decisions.find((d) => d.decision === 'aceitar' && !d.desc);
  if (bad) throw badRequest('Informe a descrição de ' + bad.code);
  let ok = 0, aplicados = 0, rej = 0;
  await db.tx(async (c) => {
    for (const d of b.decisions) {
      if (d.decision === 'aceitar') {
        const r = await E.criarMaterial(c, { code: d.code, name: d.desc, unit: d.unit, category: d.category, priority: d.priority, stock: 0, avgConsumption: d.avg }, req.user.id);
        if (r) { ok++; aplicados += r.aplicados; }
      } else {
        const r = await c.query("UPDATE estoque_doc_itens SET descartado = TRUE, motivo_descarte = 'Recusado no cadastro' WHERE codigo_digitos = $1 AND NOT aplicado AND NOT descartado", [E.digits(d.code)]);
        if (r.rowCount) rej++;
      }
    }
  });
  if (ok) await audit.log(req, { action: 'Itens novos cadastrados', module: 'almoxarifado', detail: `${ok} material(is) · ${aplicados} movimento(s) aplicado(s)` });
  b.decisions.filter((d) => d.decision === 'recusar').forEach((d) => audit.log(req, { action: 'Item novo recusado', module: 'almoxarifado', detail: E.fmtCode(d.code) + ' · movimentos não computados', level: 'warning' }));
  res.json({ cadastrados: ok, aplicados, recusados: rej });
}));

module.exports = router;
