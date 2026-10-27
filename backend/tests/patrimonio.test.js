const { db, login, api } = require('./helpers');
const P = require('../src/services/patrimonio');

afterAll(() => db.pool.end());

describe('API de Patrimônio', () => {
  let pat, admin, compras;
  beforeAll(async () => { pat = await login('patrimonio'); admin = await login('admin'); compras = await login('compras'); });

  test('403 sem acesso ao módulo', async () => {
    expect((await api(compras).get('/patrimonio/transferencias')).status).toBe(403);
  });

  test('lista com etapas e pendência do usuário logado', async () => {
    const r = await api(pat).get('/patrimonio/transferencias');
    expect(r.status).toBe(200);
    expect(r.body.items.length).toBeGreaterThanOrEqual(5);
    expect(r.body.myPending.code).toBe('DA-PAT-00452');
    const rec = r.body.items.find((t) => t.status === 'Recusado');
    expect(rec.next).toBeNull();
    expect(rec.prev).toBeNull();
  });

  test('validações de nova transferência e bloqueio duplo', async () => {
    const base = { code: 'da-pat-09001', description: 'Monitor LG 24"', fromUser: 'Almoxarifado Central', toUser: 'Plenário', date: '2026-10-20' };
    expect((await api(pat).post('/patrimonio/transferencias').send({ ...base, toUser: 'almoxarifado central' })).body.error).toMatch(/diferente/);
    expect((await api(pat).post('/patrimonio/transferencias').send({ ...base, toCc: 'Cozinha' })).body.error).toMatch(/Patrimônio/);
    const ok = await api(pat).post('/patrimonio/transferencias').send(base);
    expect(ok.status).toBe(201);
    expect(ok.body.code).toBe('DA-PAT-09001');
    expect((await api(pat).post('/patrimonio/transferencias').send(base)).status).toBe(409);
    // centros resolvidos pelo nome do setor
    const t = (await P.transferencias()).find((x) => x.code === 'DA-PAT-09001');
    expect(t.fromCc).toBe('Almoxarifado Central');
    expect(t.toCc).toBe('Plenário');
    // avança e volta etapas
    expect((await api(pat).post(`/patrimonio/transferencias/${t.id}/etapa`).send({ dir: -1 })).status).toBe(400);
    expect((await api(pat).post(`/patrimonio/transferencias/${t.id}/etapa`).send({ dir: 1 })).body.status).toBe('Verificar transferência');
  });

  test('somente o destinatário assina; depois vai para Verificar', async () => {
    const { items } = (await api(pat).get('/patrimonio/transferencias')).body;
    const mine = items.find((t) => t.code === 'DA-PAT-00452');
    expect((await api(admin).post(`/patrimonio/transferencias/${mine.id}/assinar`)).status).toBe(403);
    const s = await api(pat).post(`/patrimonio/transferencias/${mine.id}/assinar`);
    expect(s.body.status).toBe('Verificar transferência');
    expect((await api(pat).post(`/patrimonio/transferencias/${mine.id}/recusar`)).status).toBe(409);
    const log = await db.query("SELECT 1 FROM audit_logs WHERE action = 'Termo de responsabilidade assinado'");
    expect(log.rows.length).toBe(1);
  });

  test('termos do mês: centros com movimentação, órfãs e emissão', async () => {
    const r = await api(pat).get('/patrimonio/termos?mes=2026-07');
    expect(r.body.rows.map((x) => x.nome).sort()).toEqual(['Almoxarifado Central', 'Diretoria Administrativa', 'Sala de Sessões']);
    expect(r.body.rows.find((x) => x.nome === 'Diretoria Administrativa').emitido).toBe('2026-07-05');
    expect(r.body.pendentes).toBe(2);
    const alm = r.body.rows.find((x) => x.nome === 'Almoxarifado Central');
    expect((await api(pat).put(`/patrimonio/termos/${alm.id}/2026-07`)).status).toBe(200);
    expect((await api(pat).get('/patrimonio/termos?mes=2026-07')).body.pendentes).toBe(1);
    expect((await api(pat).delete(`/patrimonio/termos/${alm.id}/2026-07`)).status).toBe(200);
    const jun = await api(pat).get('/patrimonio/termos?mes=2026-06');
    expect(jun.body.orphans.map((o) => o.code)).toContain('DA-PAT-00501');
  });

  test('alertas e calendário', async () => {
    await api(pat).post('/patrimonio/transferencias').send({ code: 'DA-PAT-09002', description: 'Cadeira', fromUser: 'Recepção', toUser: 'Maria Clara Gomes', date: '2026-10-01' });
    const a = await P.alerts();
    expect(a.find((x) => x.title.includes('DA-PAT-09002')).level).toBe('warning');
    const ev = await P.calendarEvents();
    expect(ev.find((x) => x.title.includes('DA-PAT-09002')).level).toBe('critical');
  });
});
