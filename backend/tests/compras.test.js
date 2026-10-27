const { db, login, api } = require('./helpers');
const C = require('../src/services/compras');

afterAll(() => db.pool.end());

const cfg = (o = {}) => (k) => ({ 'compras.avisoAzul': 120, 'compras.avisoAmarelo': 60, 'compras.avisoVermelho': 30, 'compras.saldoMin': 20, 'compras.limCompras': 65492.11, 'compras.limEng': 130984.2, 'compras.fonteLimites': 'Decreto', 'compras.limAtencao': 80, ...o })[k];

describe('Regras (unidade)', () => {
  test('procInfo: etapa atual, % e atraso por dias úteis', () => {
    const stages = Array.from({ length: 24 }, (_, i) => (i < 6 ? { s: 'ok' } : { s: 'pend' }));
    stages[6].since = '2026-10-13'; // seg; hoje (fixo) = 2026-10-27 → 10 dias úteis
    const i = C.procInfo({ stages }, 5);
    expect(i.currentLabel).toBe('Inicial');
    expect(i.fase).toBe('externa');
    expect(i.pct).toBe(25);
    expect(i.delay).toBe(10);
    expect(i.atrasado).toBe(true);
  });

  test('contractInfo: níveis de aviso e saldo baixo', () => {
    const base = { empenhado: 1000, assinatura: '2026-01-10', notas: { 2026: [100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0, 0] } };
    expect(C.contractInfo({ ...base, fim: '2026-11-20' }, 2026, cfg()).level).toBe('critical');
    expect(C.contractInfo({ ...base, fim: '2026-12-20' }, 2026, cfg()).level).toBe('warning');
    expect(C.contractInfo({ ...base, fim: '2027-02-20' }, 2026, cfg()).level).toBe('info');
    expect(C.contractInfo({ ...base, fim: '2027-06-20' }, 2026, cfg()).level).toBe('ok');
    const ci = C.contractInfo({ ...base, fim: '2027-06-20' }, 2026, cfg());
    expect(ci.saldo).toBe(100);
    expect(ci.saldoBaixo).toBe(true);
  });

  test('notasFaltantes: ciclo mensal a partir da assinatura', () => {
    const c = { assinatura: '2026-01-10', fim: '2026-12-31', notas: { 2026: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0] } };
    // set/2026 vence 10/10 (já passou); out vence 10/11 (ainda não)
    expect(C.notasFaltantes(c, 2026)).toEqual([8]);
  });

  test('acumulado por Classe soma despesas e verbinha até a data', () => {
    const data = {
      expenses: [{ classe: '7510', empenhado: 40000, dataEmpenho: '2026-03-01' }, { classe: '7510', empenhado: 20000, dataEmpenho: '2026-05-01' }, { classe: '9999', empenhado: 5, dataEmpenho: '2026-01-01' }],
      verbinha: [{ classe: '7510', data: '2026-02-01', valor: 1000 }]
    };
    const a = C.accumulated({ classe: '7510', dataEmpenho: '2026-04-01' }, data, cfg());
    expect(a.total).toBe(41000);
    const b = C.accumulated({ grupo: '542', dataEmpenho: '2026-04-01' }, data, cfg());
    expect(b.eng).toBe(true);
    expect(b.limite).toBe(130984.2);
  });
});

describe('API de Compras', () => {
  let chefia, agente, almox;
  beforeAll(async () => { chefia = await login('compras'); agente = await login('paulo.reis'); almox = await login('operador'); });

  test('perfil sem Compras recebe 403', async () => {
    expect((await api(almox).get('/compras/processos')).status).toBe(403);
  });

  test('lista processos com carga por agente e sugestão', async () => {
    const r = await api(chefia).get('/compras/processos');
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(12);
    expect(r.body.loads.map((l) => l.agente)).toEqual(expect.arrayContaining(['Marina Duarte', 'Paulo Reis']));
    expect(r.body.suggested).toBeTruthy();
  });

  test('somente responsável ou chefia marcam etapas; refazer exige justificativa', async () => {
    const list = (await api(chefia).get('/compras/processos')).body.items;
    const alheio = list.find((p) => p.agente === 'Marina Duarte');
    const proprio = list.find((p) => p.agente === 'Paulo Reis') || alheio;
    expect((await api(agente).put(`/compras/processos/${alheio.id}/etapas/0`).send({ status: 'ok' })).status).toBe(403);
    expect((await api(chefia).put(`/compras/processos/${proprio.id}/etapas/${proprio.current}`).send({ status: 'refazer' })).status).toBe(400);
    const r = await api(chefia).put(`/compras/processos/${proprio.id}/etapas/${proprio.current}`).send({ status: 'refazer', justificativa: 'Apenas 2 cotações válidas' });
    expect(r.status).toBe(200);
    expect(r.body.refazer).toBe(true);
    const alerts = await C.alerts();
    expect(alerts.some((a) => a.id.startsWith('lic-ref-' + proprio.id))).toBe(true);
  });

  test('novo processo exige chefia (atribuição confirmada) e cria 24 etapas', async () => {
    const meta = (await api(chefia).get('/compras/meta')).body;
    const ag = meta.agents[0];
    const body = { interno: '9999/2026', objeto: 'Aquisição de cadeiras', modo: 'Dispensa', setor: 'Diretoria Administrativa', valor: 1500, agenteId: ag.id };
    expect((await api(agente).post('/compras/processos').send(body)).status).toBe(403);
    const r = await api(chefia).post('/compras/processos').send(body);
    expect(r.status).toBe(201);
    expect(r.body.stages).toHaveLength(24);
    expect(r.body.stages[0].since).toBeTruthy();
    expect((await api(chefia).post('/compras/processos').send(body)).status).toBe(409);
    const t = await api(chefia).put(`/compras/processos/${r.body.id}/agente`).send({ agenteId: null });
    expect(t.body.agenteId).toBeNull();
    expect((await api(chefia).delete('/compras/processos/' + r.body.id)).status).toBe(200);
  });

  test('contratos do exercício com avisos e lançamento de nota', async () => {
    const r = await api(chefia).get('/compras/contratos?ano=2026');
    expect(r.body.items.length).toBeGreaterThan(5);
    const c = r.body.items.find((x) => x.contrato === '31/2023');
    expect(c.historico.ano).toBe(2025);
    expect(c.faltantes).toEqual([]);
    await api(chefia).put(`/compras/contratos/${c.id}/notas/2026/8`).send({ valor: 0 });
    const r1 = await api(chefia).get('/compras/contratos?ano=2026');
    expect(r1.body.items.find((x) => x.id === c.id).faltantes).toEqual([8]); // set/26 vencia em 15/10
    expect((await api(chefia).put(`/compras/contratos/${c.id}/notas/2026/8`).send({ valor: 4201 })).status).toBe(200);
    const r2 = await api(chefia).get('/compras/contratos?ano=2026');
    expect(r2.body.items.find((x) => x.id === c.id).faltantes).toEqual([]);
  });

  test('despesas: acumulado, TCN e simulação de contratação direta', async () => {
    const r = await api(chefia).get('/compras/despesas?ano=2026');
    expect(r.body.groups.length).toBeGreaterThan(0);
    const inv = await api(chefia).post('/compras/despesas').send({ processo: '1', objeto: 'X', empenhado: 10, dataEmpenho: '2026-10-01' });
    expect(inv.status).toBe(400);
    const lim = await api(chefia).get('/compras/limites');
    const papel = lim.body.itens.find((i) => i.codigo === '279383');
    const ok = await api(chefia).post('/compras/limites/simular').send({ itemId: papel.id, valor: 1000 });
    expect(ok.body.chave).toBe('CATMAT classe 7510');
    expect(ok.body.ok).toBe(true);
    const nok = await api(chefia).post('/compras/limites/simular').send({ itemId: papel.id, valor: 70000 });
    expect(nok.body.ok).toBe(false);
  });

  test('dotação: saldo calculado a partir das despesas da Ficha/Sub', async () => {
    const r = await api(chefia).get('/compras/dotacoes?ano=2026');
    const d = r.body.items[0];
    expect(d.info.empenhado).toBeGreaterThan(0);
    expect(d.info.saldo).toBeCloseTo(d.orcado - d.info.empenhado);
  });

  test('fornecedores: CNPJ único, inativar e exportar', async () => {
    const r = await api(chefia).post('/compras/fornecedores').send({ name: 'Nova Ltda', cnpj: '12.345.678/0001-90', email: 'a@b.com', segments: ['Tecnologia'] });
    expect(r.status).toBe(409);
    const list = (await api(chefia).get('/compras/fornecedores?status=ativos&segmento=Tecnologia')).body.items;
    expect(list.every((s) => s.active && s.segments.includes('Tecnologia'))).toBe(true);
    const off = await api(chefia).patch(`/compras/fornecedores/${list[0].id}/ativo`).send({ ativo: false });
    expect(off.body.active).toBe(false);
    const h = await api(chefia).get(`/compras/fornecedores/${list[0].id}/historico`);
    expect(h.body.events[0].title).toBe('Fornecedor inativado');
    const csv = await api(chefia).get('/compras/fornecedores/export.csv?status=todos');
    expect(csv.text).toContain('Razão social');
  });
});
