const { db, login, api } = require('./helpers');

afterAll(() => db.pool.end());

describe('API do Protocolo', () => {
  let admin, ger, compras;
  beforeAll(async () => { admin = await login('admin'); ger = await login('gerencia'); compras = await login('compras'); });

  test('403 sem acesso ao módulo', async () => {
    expect((await api(compras).get('/protocolo/documentos')).status).toBe(403);
  });

  test('protocolar documento com numeração anual e prazo', async () => {
    const r = await api(ger).post('/protocolo/documentos').send({ assunto: 'Ofício da Prefeitura', interessado: 'Prefeitura Municipal', setor: 'Diretoria Administrativa', prazo: '2026-11-10', prazoDesc: '' });
    expect(r.status).toBe(201);
    expect(r.body.protocolo).toBe('PRT-2026-006');
    expect(r.body.status).toBe('Registrado');
    const list = await api(ger).get('/protocolo/documentos?q=prefeitura');
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ prazo: '2026-11-10', prazoDesc: 'Prazo de resposta' });
    expect((await api(ger).post('/protocolo/documentos').send({ assunto: '', interessado: 'X' })).body.error).toMatch(/assunto/);
  });

  test('fluxo de documento avança e volta; limites', async () => {
    const { items } = (await api(ger).get('/protocolo/documentos?status=Arquivado')).body;
    expect((await api(ger).post(`/protocolo/documentos/${items[0].id}/etapa`).send({ dir: 1 })).status).toBe(400);
    expect((await api(ger).post(`/protocolo/documentos/${items[0].id}/etapa`).send({ dir: -1 })).body.status).toBe('Finalizado');
  });

  test('processo: criação, progresso limitado a 0–100, edição remove prazo', async () => {
    const p = await api(ger).post('/protocolo/processos').send({ titulo: 'Revisão do regimento', prioridade: 'Alta', prazo: '2026-12-01' });
    expect(p.body.codigo).toBe('PROC-005');
    expect((await api(ger).post(`/protocolo/processos/${p.body.id}/progresso`).send({ delta: -10 })).body.progresso).toBe(0);
    expect((await api(ger).post(`/protocolo/processos/${p.body.id}/progresso`).send({ delta: 10 })).body.progresso).toBe(10);
    await api(ger).put(`/protocolo/processos/${p.body.id}`).send({ titulo: 'Revisão do regimento interno', prioridade: 'Alta', prazo: '' });
    const procs = (await api(ger).get('/protocolo/processos')).body;
    expect(procs.find((x) => x.id === p.body.id)).toMatchObject({ prazo: '', descricao: 'Sem descrição.' });
  });

  test('prazos: cadastro, conclusão e níveis', async () => {
    const docs = (await api(ger).get('/protocolo/documentos')).body.items;
    expect((await api(ger).post('/protocolo/prazos').send({ refTipo: 'documento', refId: docs[0].id, descricao: '', vencimento: '2026-10-29' })).status).toBe(400);
    const z = await api(ger).post('/protocolo/prazos').send({ refTipo: 'documento', refId: docs[0].id, descricao: 'Despacho', vencimento: '2026-10-29' });
    expect(z.status).toBe(201);
    const cal = await api(ger).get('/protocolo/calendario');
    const ev = cal.body.events.find((e) => e.ref === z.body.id);
    expect(ev.level).toBe('warning');
    expect(cal.body.events.find((e) => e.title.includes('Parecer jurídico')).level).toBe('critical');
    expect((await api(ger).post(`/protocolo/prazos/${z.body.id}/concluir`)).status).toBe(200);
    expect((await api(ger).post(`/protocolo/prazos/${z.body.id}/concluir`)).status).toBe(404);
  });

  test('calendário integrado respeita os módulos do usuário', async () => {
    const g = await api(ger).get('/protocolo/calendario');
    expect(g.body.modules.map((m) => m.key)).toEqual(['protocolo']);
    const a = await api(admin).get('/protocolo/calendario');
    expect(a.body.modules.map((m) => m.key)).toEqual(expect.arrayContaining(['compras', 'rh', 'almoxarifado', 'patrimonio']));
    expect(a.body.events.some((e) => e.module === 'rh')).toBe(true);
    const c = await api(admin).get('/protocolo/prazos-criticos');
    expect(c.body.rows[0].bucket).toBe('vencido');
    expect(c.body.janelaUrgente).toBe(7);
  });
});
