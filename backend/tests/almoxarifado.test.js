const fs = require('fs');
const path = require('path');
const { db, login, api } = require('./helpers');
const E = require('../src/services/estoque');

afterAll(() => db.pool.end());
const fx = (f) => path.join(__dirname, 'fixtures', f);

describe('Regras (unidade)', () => {
  test('código formatado e dígitos', () => {
    expect(E.fmtCode('1.50.02.0018.0')).toBe('1 50 02 0018 0');
    expect(E.digits('1 50 02 0018 0')).toBe('1500200180');
  });
  test('carga semanal por dias ou sessões', () => {
    const p = { team: [{ active: true }, { active: true }, { active: false }], perSession: 3, sessionsPerWeek: 4, days: ['Seg', 'Qua'] };
    expect(E.summary({ ...p, calcBase: 'dias' }).total).toBe(12);
    expect(E.summary({ ...p, calcBase: 'sessoes' }).total).toBe(24);
  });
  test('sorteio prioriza a curva escolhida', () => {
    const items = [{ priority: 'Baixa', avgConsumption: 9, category: 'A' }, { priority: 'Alta', avgConsumption: 1, category: 'A' }, { priority: 'Alta', avgConsumption: 2, category: 'B' }];
    const r = E.sortear(items, { category: 'todos', method: 'alta', size: 2, weights: {} });
    expect(r.every((i) => i.priority === 'Alta')).toBe(true);
    expect(E.sortear(items, { category: 'A', method: 'balanceado', size: 5, weights: { alta: 60, media: 30, baixa: 10 } })).toHaveLength(2);
  });
});

describe('API do Almoxarifado', () => {
  let resp, func, compras;
  beforeAll(async () => { resp = await login('operador'); func = await login('almoxarifado'); compras = await login('compras'); });

  test('403 para perfil sem Almoxarifado', async () => {
    expect((await api(compras).get('/almoxarifado/materiais')).status).toBe(403);
  });

  test('resumo com estatísticas e críticos', async () => {
    const r = await api(resp).get('/almoxarifado/resumo');
    expect(r.body.stats.total).toBe(11);
    expect(r.body.stats.criticos).toBeGreaterThan(0);
    expect(r.body.workforce.total).toBe(12);
  });

  test('parâmetros: só o responsável salva; soma dos pesos = 100', async () => {
    const p = (await api(resp).get('/almoxarifado/params')).body;
    const body = { team: p.team.map((m) => ({ userId: m.userId, active: m.active })), days: ['Seg', 'Qua', 'Sex'], weights: { alta: 50, media: 30, baixa: 10 }, calcBase: 'dias', perSession: 3, sessionsPerWeek: 2, tolerancePct: 5, recountPct: 10 };
    expect((await api(func).put('/almoxarifado/params').send(body)).status).toBe(403);
    expect((await api(resp).put('/almoxarifado/params').send(body)).body.error).toMatch(/100%/);
    const ok = await api(resp).put('/almoxarifado/params').send({ ...body, weights: { alta: 60, media: 30, baixa: 10 } });
    expect(ok.status).toBe(200);
    expect(ok.body.summary.total).toBe(18);
  });

  test('escala → contagem pelo responsável do item → correção do saldo', async () => {
    const g = await api(resp).post('/almoxarifado/escala').send({ category: 'todos', method: 'alta', responsible: 'equipe', size: 4 });
    expect(g.status).toBe(201);
    expect(g.body.count).toBe(4);
    const { body } = await api(func).get('/almoxarifado/materiais');
    const meuId = (await db.query("SELECT id FROM users WHERE username='almoxarifado'")).rows[0].id;
    const mine = body.escala.items.find((i) => i.assigneeId === meuId);
    const other = body.escala.items.find((i) => i.assigneeId !== meuId);
    expect((await api(func).post('/almoxarifado/contagens').send({ materialId: other.materialId, contado: 1 })).status).toBe(403);
    const item = body.items.find((i) => i.id === mine.materialId);
    const c = await api(func).post('/almoxarifado/contagens').send({ materialId: mine.materialId, contado: item.stock + 10 });
    expect(c.body.status).toBe('divergente');
    expect((await api(compras).post(`/almoxarifado/contagens/${mine.materialId}/corrigir`)).status).toBe(403);
    expect((await api(resp).post(`/almoxarifado/contagens/${mine.materialId}/corrigir`)).status).toBe(200);
    const after = (await api(resp).get('/almoxarifado/materiais')).body.items.find((i) => i.id === mine.materialId);
    expect(after.stock).toBe(item.stock + 10);
    expect(after.count.status).toBe('corrigido');
  });

  test('upload de RME/BRM: aplica saldo, pendências e idempotência', async () => {
    const before = (await api(resp).get('/almoxarifado/materiais')).body.items.find((i) => i.digits === '1500200180').stock;
    const r = await api(resp).post('/almoxarifado/estoque/upload').field('tipo', 'BRM')
      .attach('files', fs.readFileSync(fx('brm-700-2026.pdf')), 'brm-700-2026.pdf')
      .attach('files', fs.readFileSync(fx('rme-1300-2026.pdf')), 'rme-1300-2026.pdf')
      .attach('files', fs.readFileSync(fx('outro.pdf')), 'outro.pdf');
    expect(r.status).toBe(200);
    expect(r.body.processados.map((d) => d.key)).toEqual(['BRM 700/2026']);
    expect(r.body.ignorados.map((x) => x.motivo)).toEqual(expect.arrayContaining(['RME 1300/2026 está na pasta de BRMs', 'Não é RME nem BRM']));
    const after = (await api(resp).get('/almoxarifado/materiais')).body.items.find((i) => i.digits === '1500200180').stock;
    expect(after).toBe(before + 30);
    const rme = await api(resp).post('/almoxarifado/estoque/upload').field('tipo', 'RME').attach('files', fs.readFileSync(fx('rme-1300-2026.pdf')), 'rme-1300-2026.pdf');
    expect(rme.body.processados[0].key).toBe('RME 1300/2026');
    const again = await api(resp).post('/almoxarifado/estoque/upload').attach('files', fs.readFileSync(fx('brm-700-2026.pdf')), 'copia.pdf');
    expect(again.body.ignorados[0].motivo).toBe('BRM 700/2026 já computado');
    const pend = await api(resp).get('/almoxarifado/estoque/pendentes');
    expect(pend.body.items.map((p) => p.code)).toContain('9 99 99 9999 9');
    const acc = await api(resp).post('/almoxarifado/estoque/pendentes').send({ decisions: [{ code: '9 99 99 9999 9', decision: 'aceitar', desc: 'ITEM NOVO DE TESTE', unit: 'UN', category: 'Papelaria', priority: 'Baixa', avg: 1 }] });
    expect(acc.body).toEqual({ cadastrados: 1, aplicados: 1, recusados: 0 });
    const novo = (await api(resp).get('/almoxarifado/materiais')).body.items.find((i) => i.digits === '9999999999');
    expect(novo.stock).toBe(5);
    const docs = await api(resp).get('/almoxarifado/estoque/documentos?tipo=BRM');
    expect(docs.body.items.some((d) => d.key === 'BRM 700/2026')).toBe(true);
  });

  test('sincronização pelo Drive sem configuração devolve 400', async () => {
    const r = await api(resp).post('/almoxarifado/estoque/sync');
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/Google Drive/);
  });

  test('novo material com código inválido ou duplicado', async () => {
    expect((await api(resp).post('/almoxarifado/materiais').send({ code: '123', name: 'X' })).status).toBe(400);
    expect((await api(resp).post('/almoxarifado/materiais').send({ code: '1 50 02 0018 0', name: 'PAPEL' })).status).toBe(409);
  });
});
