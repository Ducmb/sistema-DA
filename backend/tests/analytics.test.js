const { db, login, api } = require('./helpers');

afterAll(() => db.pool.end());

describe('Analytics', () => {
  test('Visualizador acessa a visão consolidada', async () => {
    const r = await api(await login('visualizador')).get('/analytics?periodo=ano');
    expect(r.status).toBe(200);
    expect(r.body.periodo).toBe('ano');
    expect(r.body.kpis).toHaveLength(6);
    expect(r.body.blocks.find((b) => b.title.startsWith('Processos ativos por setor')).rows.length).toBeGreaterThan(0);
  });

  test('exportação CSV auditada', async () => {
    const r = await api(await login('visualizador')).get('/analytics/export.csv');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    expect(r.text).toMatch(/Processos ativos/);
    const log = await db.query("SELECT 1 FROM audit_logs WHERE action = 'Relatório exportado'");
    expect(log.rows.length).toBe(1);
  });

  test('período customizado', async () => {
    const t = await login('visualizador');
    const r = await api(t).get('/analytics?periodo=custom&de=2026-01-01&ate=2026-12-31');
    expect(r.body).toMatchObject({ periodo: 'custom', desde: '2026-01-01', ate: '2026-12-31' });
    expect((await api(t).get('/analytics?periodo=custom&de=2026-12-31&ate=2026-01-01')).status).toBe(400);
    expect((await api(t).get('/analytics?periodo=custom')).body.error).toMatch(/datas/);
  });

  test('sem acesso ao módulo → 403', async () => {
    expect((await api(await login('operador')).get('/analytics')).status).toBe(403);
  });
});
