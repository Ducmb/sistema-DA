const { db, login, api } = require('./helpers');

afterAll(() => db.pool.end());

describe('Gestão de Pessoal', () => {
  let admin;
  beforeAll(async () => { admin = await login('admin'); });

  test('lista servidores e registra leitura LGPD', async () => {
    const r = await api(admin).get('/pessoal/servidores');
    expect(r.status).toBe(200);
    expect(r.body.find((s) => s.name === 'Ana Silva Santos').hasAccess).toBe(false);
    const { rows } = await db.query("SELECT 1 FROM audit_logs WHERE action = 'Leitura de dados pessoais'");
    expect(rows.length).toBeGreaterThan(0);
  });

  test('cadastra e edita servidor; matrícula única', async () => {
    const r = await api(admin).post('/pessoal/servidores').send({ name: 'Fábio Nunes', registration: '2026-777', position: 'Contador', department: 'Diretoria Administrativa', situacao: 'Ativo' });
    expect(r.status).toBe(201);
    expect((await api(admin).post('/pessoal/servidores').send({ name: 'Outro', registration: '2026-777' })).status).toBe(409);
    const e = await api(admin).put('/pessoal/servidores/' + r.body.id).send({ ...r.body, situacao: 'Afastado' });
    expect(e.body).toEqual(expect.objectContaining({ situacao: 'Afastado' }));
  });

  test('conceder acesso exige e-mail e envia convite', async () => {
    const list = (await api(admin).get('/pessoal/servidores')).body;
    const s = list.find((x) => x.name === 'Fábio Nunes');
    expect((await api(admin).put(`/users/${s.id}/roles`).send({ roles: ['Visualizador'] })).status).toBe(400);
    await api(admin).put('/pessoal/servidores/' + s.id).send({ ...s, email: 'fabio.nunes@camara.local' });
    const g = await api(admin).put(`/users/${s.id}/roles`).send({ roles: ['Visualizador'] });
    expect(g.status).toBe(200);
    expect(g.body.convite_pendente).toBe(true);
  });

  test('férias: regras de período, antecedência e sobreposição', async () => {
    const list = (await api(admin).get('/pessoal/servidores')).body;
    const ana = list.find((x) => x.name === 'Ana Silva Santos');
    const base = { userId: ana.id, type: 'Férias', notes: '' };
    expect((await api(admin).post('/pessoal/ausencias').send({ ...base, start: '2027-01-10', end: '2027-01-05' })).status).toBe(400);
    expect((await api(admin).post('/pessoal/ausencias').send({ ...base, start: '2027-01-01', end: '2027-02-15' })).body.error).toMatch(/30 dias/);
    expect((await api(admin).post('/pessoal/ausencias').send({ ...base, start: '2026-11-01', end: '2026-11-10' })).body.error).toMatch(/antecedência/);
    const ok = await api(admin).post('/pessoal/ausencias').send({ ...base, start: '2027-01-04', end: '2027-01-18' });
    expect(ok.status).toBe(201);
    expect(ok.body.days).toBe(15);
    expect((await api(admin).post('/pessoal/ausencias').send({ ...base, start: '2027-01-10', end: '2027-01-12' })).status).toBe(409);
    const ap = await api(admin).patch(`/pessoal/ausencias/${ok.body.id}/status`).send({ status: 'Aprovado' });
    expect(ap.body.status).toBe('Aprovado');
    expect((await api(admin).patch(`/pessoal/ausencias/${ok.body.id}/status`).send({ status: 'Recusado' })).status).toBe(400);
  });

  test('perfis sem rh recebem 403', async () => {
    const t = await login('compras');
    expect((await api(t).get('/pessoal/servidores')).status).toBe(403);
  });

  test('indicadores calculados', async () => {
    const r = await api(admin).get('/pessoal/indicadores');
    expect(r.body.kpis).toHaveLength(4);
    expect(r.body.sectorHeadcount.length).toBeGreaterThan(0);
  });
});
