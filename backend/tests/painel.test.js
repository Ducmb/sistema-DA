const { db, login, api } = require('./helpers');

afterAll(() => db.pool.end());

describe('Painel de Controle', () => {
  test('admin vê todos os blocos com dados reais', async () => {
    const r = await api(await login('admin')).get('/painel?ano=2026');
    expect(r.status).toBe(200);
    expect(r.body.cards).toHaveLength(3);
    expect(r.body.sections).toMatchObject({ audit: true, agents: true, legislative: true });
    expect(r.body.fluxo.serie.length).toBeGreaterThan(1);
    expect(r.body.agentes.length).toBeGreaterThan(0);
    expect(r.body.metas.map((m) => m.nome)).toEqual(['Autuação', 'Análise', 'Parecer', 'Arquivamento']);
    expect(r.body.alertas.some((a) => a.module === 'compras')).toBe(true);
    expect(r.body.alertas.some((a) => a.id.startsWith('cal-protocolo'))).toBe(true);
    expect(new Set(r.body.alertas.map((a) => a.id)).size).toBe(r.body.alertas.length);
  });

  test('perfil setorial só recebe dados dos próprios módulos', async () => {
    const r = await api(await login('operador')).get('/painel');
    expect(r.body.sections).toMatchObject({ audit: true, agents: false, legislative: false });
    expect(r.body.agentes).toBeUndefined();
    expect(r.body.alertas.every((a) => ['almoxarifado', 'mocoes'].includes(a.module))).toBe(true);
    expect(r.body.capacidade.map((c) => c.label)).not.toContain('Compras & Licitações');
  });

  test('sem acesso ao painel → 403', async () => {
    expect((await api(await login('visualizador')).get('/painel')).status).toBe(403);
  });
});
