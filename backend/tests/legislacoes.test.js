const fs = require('fs');
const path = require('path');
const { db, login, api } = require('./helpers');

afterAll(() => db.pool.end());
const pdf = fs.readFileSync(path.join(__dirname, 'fixtures', 'outro.pdf'));

describe('API de Legislações', () => {
  let admin, ger, op;
  beforeAll(async () => { admin = await login('admin'); ger = await login('gerencia'); op = await login('operador'); });

  test('consulta liberada; edição só para Administrativo (padrão)', async () => {
    const r = await api(op).get('/legislacoes');
    expect(r.status).toBe(200);
    expect(r.body.canEdit).toBe(false);
    expect(r.body.items.filter((n) => n.numero !== 'P-SEC')).toHaveLength(6);
    expect((await api(op).patch(`/legislacoes/${r.body.items[0].id}/ativa`).send({ ativa: false })).status).toBe(403);
    expect((await api(ger).post('/legislacoes').field('tipo', 'Portaria').field('numero', 'X').field('ementa', 'Y')).status).toBe(403);
  });

  test('cadastro com PDF validado pelo conteúdo, leitura e remoção', async () => {
    const fake = await api(admin).post('/legislacoes').field('tipo', 'Portaria').field('numero', 'Portaria DA nº 02/2026').field('ementa', 'Teste').attach('pdf', Buffer.from('não é pdf'), 'falso.pdf');
    expect(fake.body.error).toBe('Selecione um arquivo PDF.');
    expect((await api(admin).post('/legislacoes').field('tipo', 'Portaria').field('numero', 'P').field('ementa', 'E').field('link', 'ftp://x')).body.error).toMatch(/http/);
    const r = await api(admin).post('/legislacoes').field('tipo', 'Portaria').field('numero', 'Portaria DA nº 02/2026').field('ementa', 'Regras de uso de veículos.').field('data', '2026-10-20').attach('pdf', pdf, 'portaria-02.pdf');
    expect(r.status).toBe(201);
    expect(r.body.pdfNome).toBe('portaria-02.pdf');
    const file = await api(op).get(`/legislacoes/${r.body.id}/pdf`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    const sem = await api(admin).put(`/legislacoes/${r.body.id}`).field('tipo', 'Portaria').field('numero', 'Portaria DA nº 02/2026').field('ementa', 'Regras de uso de veículos.').field('removerPdf', 'true');
    expect(sem.body.pdfNome).toBe('');
    expect((await api(op).get(`/legislacoes/${r.body.id}/pdf`)).status).toBe(404);
  });

  test('inativar e configuração de editores', async () => {
    const { items } = (await api(admin).get('/legislacoes')).body;
    const r = await api(admin).patch(`/legislacoes/${items[0].id}/ativa`).send({ ativa: false });
    expect(r.body.ativa).toBe(false);
    await db.query("INSERT INTO system_config (key, value) VALUES ('leg.editores', '\"Administrativo e Gerenciamento\"') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value");
    require('../src/services/config').invalidate();
    expect((await api(ger).get('/legislacoes')).body.canEdit).toBe(true);
    await db.query("DELETE FROM system_config WHERE key = 'leg.editores'");
    require('../src/services/config').invalidate();
  });
});
