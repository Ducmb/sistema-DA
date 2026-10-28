const { app, request, db, login, api } = require('./helpers');
const { computeModules, DEFAULT_ACCESS } = require('../src/services/access');

afterAll(() => db.pool.end());

describe('Cálculo de acesso', () => {
  test('soma de perfis e overrides; auditoria/config nunca por override', () => {
    const m = computeModules(['Compras', 'Patrimônio'], { protocolo: true, mocoes: false, auditoria: true }, DEFAULT_ACCESS);
    expect(m).toEqual(expect.arrayContaining(['compras', 'patrimonio', 'protocolo', 'dashboard']));
    expect(m).not.toContain('mocoes');
    expect(m).not.toContain('auditoria');
  });
  test('Visualizador vê só Analytics e Perfil', () => {
    expect(computeModules(['Visualizador'], {}, DEFAULT_ACCESS).sort()).toEqual(['analytics', 'perfil']);
  });
});

describe('RBAC no servidor', () => {
  let admin, visual;
  beforeAll(async () => { admin = await login('admin'); visual = await login('visualizador'); });

  test('perfil sem permissão recebe 403 e o evento é auditado', async () => {
    const r = await api(visual).get('/audit');
    expect(r.status).toBe(403);
    const { rows } = await db.query("SELECT 1 FROM audit_logs WHERE action = 'Acesso negado' AND user_name = 'Carlos Eduardo Costa'");
    expect(rows.length).toBeGreaterThan(0);
    expect((await api(visual).get('/config')).status).toBe(403);
    expect((await api(visual).get('/users')).status).toBe(403);
  });

  test('admin cria servidor com vários perfis e convite', async () => {
    const r = await api(admin).post('/users').send({ name: 'Fernanda Souza Lima', email: 'fernanda.lima@camara.local', department: 'Diretoria Administrativa', hierarchy: 'Funcionário', roles: ['Compras', 'Patrimônio'] });
    expect(r.status).toBe(201);
    expect(r.body.roles).toEqual(['Compras', 'Patrimônio']);
    expect(r.body.modules).toEqual(expect.arrayContaining(['compras', 'patrimonio', 'mocoes']));
    expect(r.body.convite_pendente).toBe(true);
    const dup = await api(admin).post('/users').send({ name: 'Outra', email: 'fernanda.lima@camara.local', department: 'X', roles: ['Compras'] });
    expect(dup.status).toBe(409);
  });

  test('permissão individual é salva na hora e vale no servidor', async () => {
    const { rows } = await db.query("SELECT id FROM users WHERE username = 'gerencia'");
    const id = rows[0].id;
    await db.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    const tg = await login('gerencia');
    expect((await api(tg).get('/users')).status).toBe(403);
    const r = await api(admin).put(`/users/${id}/access/rh`).send({ allowed: true });
    expect(r.status).toBe(200);
    expect(r.body.modules).toContain('rh');
    expect((await api(tg).get('/users')).status).toBe(200);
    const hist = await api(admin).get('/users/history');
    expect(hist.body[0].action).toBe('Acesso Concedido');
    // Gerenciamento com rh não pode alterar permissões (somente Administrativo)
    expect((await api(tg).put(`/users/${id}/access/compras`).send({ allowed: true })).status).toBe(403);
    await api(admin).delete(`/users/${id}/access/rh`);
  });

  test('não remove o último administrador', async () => {
    const { rows } = await db.query("SELECT id FROM users WHERE username = 'admin'");
    const r = await api(admin).put(`/users/${rows[0].id}/roles`).send({ roles: ['Compras'] });
    expect(r.status).toBe(400);
  });

  test('matriz perfil × módulo afeta o acesso', async () => {
    const t = await login('patrimonio');
    expect((await api(t).get('/users')).status).toBe(403);
    let r = await api(admin).put('/config/access').send({ role: 'Patrimônio', module: 'rh', on: true });
    expect(r.status).toBe(200);
    expect(r.body.matrix['Patrimônio']).toContain('rh');
    expect((await api(t).get('/users')).status).toBe(200);
    expect((await api(admin).put('/config/access').send({ role: 'Administrativo', module: 'rh', on: false })).status).toBe(400);
    expect((await api(admin).put('/config/access').send({ role: 'Compras', module: 'auditoria', on: true })).status).toBe(400);
    r = await api(admin).post('/config/access/reset');
    expect(r.body.matrix['Patrimônio']).not.toContain('rh');
  });
});

describe('Configurações', () => {
  let admin;
  beforeAll(async () => { admin = await login('admin'); });

  test('valida limites e audita alteração', async () => {
    expect((await api(admin).put('/config/values/geral.sessaoMin').send({ value: 1 })).status).toBe(400);
    const r = await api(admin).put('/config/values/compras.sla').send({ value: 7 });
    expect(r.status).toBe(200);
    expect(r.body.values['compras.sla']).toBe(7);
    expect(r.body.changed).toContain('compras.sla');
    const { rows } = await db.query("SELECT detail FROM audit_logs WHERE action = 'Configuração alterada' ORDER BY id DESC LIMIT 1");
    expect(rows[0].detail).toContain('5 dias úteis → 7 dias úteis');
    const reset = await api(admin).post('/config/reset/compras');
    expect(reset.body.values['compras.sla']).toBe(5);
  });

  test('centros de custo: código automático, duplicidade e arquivamento', async () => {
    const r = await api(admin).post('/cost-centers').send({ nome: 'Ouvidoria', tipo: 'padrao' });
    expect(r.status).toBe(201);
    expect(r.body.codigo).toBe('CC-011');
    expect((await api(admin).post('/cost-centers').send({ nome: 'ouvidoria', tipo: 'padrao' })).status).toBe(409);
    const a = await api(admin).patch(`/cost-centers/${r.body.id}/active`).send({ ativo: false });
    expect(a.body.ativo).toBe(false);
    const list = await api(admin).get('/cost-centers?situacao=ativos');
    expect(list.body.items.some((c) => c.nome === 'Ouvidoria')).toBe(false);
  });

  test('log de auditoria filtra e exporta CSV', async () => {
    await request(app).post('/api/auth/login').send({ username: 'tentativa', password: 'x' });
    const r = await api(admin).get('/audit?q=Falha de login&period=todos');
    expect(r.status).toBe(200);
    expect(r.body.kpis.falhas).toBeGreaterThan(0);
    const csv = await api(admin).get('/audit/export.csv?period=todos');
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('"Data/hora";');
  });
});
