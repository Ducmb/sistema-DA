const { db, login, api } = require('./helpers');
const M = require('../src/services/mocoes');
const feed = require('../src/services/feed');

afterAll(() => db.pool.end());
const verId = async (nome) => (await db.query('SELECT id FROM vereadores WHERE nome = $1', [nome])).rows[0].id;

describe('Regras (unidade)', () => {
  test('legislatura de 4 anos', () => {
    expect(M.legislatura('2026-10-27')).toBe('2025-2028');
    expect(M.legislatura('2029-01-01')).toBe('2029-2032');
  });
  test('situação do empréstimo de bandeiras', () => {
    const h = '2026-10-27';
    expect(M.bandeiraStatus({ retirado: false, retirada: '2026-10-20' }, h)).toBe('naoRetirado');
    expect(M.bandeiraStatus({ retirado: false, retirada: '2026-10-30' }, h)).toBe('aguardando');
    expect(M.bandeiraStatus({ retirado: true, devolucao: '2026-10-26', conformidade: '' }, h)).toBe('atrasado');
    expect(M.bandeiraStatus({ retirado: true, devolucao: '2026-10-28', conformidade: '' }, h)).toBe('emprestado');
    expect(M.bandeiraStatus({ retirado: true, conformidade: 'Não' }, h)).toBe('pendencia');
  });
});

describe('API de Moções & Homenagens', () => {
  let op, pat;
  beforeAll(async () => { op = await login('operador'); pat = await login('patrimonio'); });

  test('403 sem acesso ao módulo', async () => {
    expect((await api(pat).get('/mocoes/mocoes')).status).toBe(403);
  });

  test('moção recebe número sequencial no ano e assunto padronizado', async () => {
    const r = await api(op).post('/mocoes/mocoes').send({ tipo: 'Aplauso', vereadorId: await verId('Fernando Souza'), assunto: 'Time de vôlei campeão', data: '2026-10-27', sessao: '' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ numero: '041/2026', assunto: 'Moção de Aplauso - Time de vôlei campeão', sessao: '' });
    expect((await api(op).post('/mocoes/mocoes').send({ tipo: 'Aplauso', vereadorId: await verId('Fernando Souza'), assunto: '', data: '2026-10-27' })).body.error).toBe('Preencha assunto e data.');
    expect((await api(op).get('/mocoes/mocoes?q=vôlei')).body).toHaveLength(1);
  });

  test('cota de homenagens por vereador na legislatura', async () => {
    const helena = await verId('Helena Duarte');
    const g = (await api(op).get('/mocoes/galeria')).body;
    expect(g.cota).toBe(2);
    expect(g.vereadores.find((v) => v.id === helena)).toMatchObject({ usadas: 1, cotaAtingida: false });
    const r = await api(op).post('/mocoes/galeria').send({ vereadorId: helena, homenageado: 'Associação de Moradores' });
    expect(r.body.quadro).toBe('Q-017');
    const bloq = await api(op).post('/mocoes/galeria').send({ vereadorId: helena, homenageado: 'Outro' });
    expect(bloq.status).toBe(409);
    expect(bloq.body.error).toMatch(/cota/);
  });

  test('entregas: a agendar e alerta de item encomendado', async () => {
    const list = (await api(op).get('/mocoes/entregas')).body;
    expect(list).toHaveLength(10);
    const pend = await M.pendingItems();
    expect(pend.length).toBe(4);
    const a = await M.alerts();
    expect(a.some((x) => x.id.startsWith('hom-enc-') && x.title.includes('Miguel Zaidan'))).toBe(true);
    expect(a.some((x) => x.title.includes('RAFAEL MOIA'))).toBe(true);
  });

  test('bandeiras: validações, retirada, devolução e leitura auditada', async () => {
    const base = { entidade: 'Escola X', documento: '123', solicitacao: '2026-10-27', itens: ['bauru'], retirado: false, retirada: '2026-10-30', devolucao: '2026-11-02' };
    expect((await api(op).post('/mocoes/bandeiras').send(base)).body.error).toMatch(/CPF/);
    expect((await api(op).post('/mocoes/bandeiras').send({ ...base, documento: '', itens: [] })).body.error).toMatch(/ao menos um item/);
    expect((await api(op).post('/mocoes/bandeiras').send({ ...base, documento: '', retirado: true, retirada: '2026-11-01' })).body.error).toMatch(/futura/);
    const r = await api(op).post('/mocoes/bandeiras').send({ ...base, documento: '123.456.789-09' });
    expect(r.status).toBe(201);
    expect((await api(op).post(`/mocoes/bandeiras/${r.body.id}/retirada`)).status).toBe(200);
    expect((await api(op).post(`/mocoes/bandeiras/${r.body.id}/retirada`)).status).toBe(409);
    const list = (await api(op).get('/mocoes/bandeiras')).body;
    const x = list.find((b) => b.id === r.body.id);
    expect(x).toMatchObject({ situacao: 'emprestado', retirada: '2026-10-27', documento: '12345678909' });
    const log = await db.query("SELECT 1 FROM audit_logs WHERE detail LIKE 'Empréstimos de bandeiras%'");
    expect(log.rows.length).toBeGreaterThan(0);
    expect(list.find((b) => b.entidade.includes('Ayrton')).situacao).toBe('emprestado');
  });

  test('eventos no calendário integrado e "a agendar" nos prazos críticos', async () => {
    const admin = await login('admin');
    const cal = (await api(admin).get('/protocolo/calendario')).body;
    expect(cal.modules.find((m) => m.key === 'mocoes').count).toBeGreaterThan(5);
    const crit = await feed.critical(['mocoes']);
    expect(crit.rows.filter((r) => r.bucket === 'agendar')).toHaveLength(4);
  });
});
