const { db, login, api, app, request } = require('./helpers');

const tab = (token) => {
  const wrap = (m) => (url) => { const r = request(app)[m]('/api/tablet' + url); return token ? r.set('Authorization', 'Tablet ' + token) : r; };
  return { get: wrap('get'), post: wrap('post') };
};
const K = require('../src/services/chaves');
const { png } = require('./fixtures/png');

afterAll(() => db.pool.end());

describe('Controle de Chaves', () => {
  let op, pat, compras, chave;
  beforeAll(async () => {
    op = await login('operador'); pat = await login('patrimonio'); compras = await login('compras');
    chave = (await api(op).get('/chaves')).body.find((c) => c.codigo === 'CH-001');
  });

  test('módulo: Almoxarifado e Patrimônio acessam; Compras não (403)', async () => {
    expect(chave).toMatchObject({ local: 'Sala de Sessões', emprestimo: null });
    expect((await api(pat).get('/chaves')).status).toBe(200);
    expect((await api(compras).get('/chaves')).status).toBe(403);
  });

  test('validação da imagem da assinatura', () => {
    expect(K.imagemInvalida(png())).toBeNull();
    expect(K.imagemInvalida('data:image/png;base64,AAAA')).toMatch(/inválida/);
    expect(K.imagemInvalida('data:image/svg+xml;base64,PHN2Zz4=')).toMatch(/inválida/);
    expect(K.imagemInvalida(png(20, 10))).toMatch(/inválida/);
  });

  test('retirada com assinatura na tela: resumo vem do servidor, código de verificação e uso único', async () => {
    const a = await api(op).post('/chaves/assinaturas').send({ tipo: 'retirada', chaveId: chave.id, solicitante: 'Fulano de Tal', solicitanteDoc: 'MAT-123', imagem: png() });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ status: 'assinada', dispositivo: 'tela', resumo: { local: 'Sala de Sessões', chave: 'CH-001', solicitante: 'Fulano de Tal', responsavel: 'Ana Beatriz Silva' } });
    expect(a.body.codigo).toMatch(/^[0-9A-F]{16}$/);
    expect((await api(op).post('/chaves/assinaturas').send({ tipo: 'retirada', chaveId: chave.id, solicitante: 'Fulano de Tal', imagem: png(), dispositivo: 'tablet' })).status).toBe(400);
    // assinatura de outra pessoa não serve
    expect((await api(op).post('/chaves/emprestimos').send({ chaveId: chave.id, solicitante: 'Outra Pessoa', solicitanteDoc: 'MAT-123', assinaturaId: a.body.id })).body.error).toMatch(/não corresponde/);
    const r = await api(op).post('/chaves/emprestimos').send({ chaveId: chave.id, solicitante: 'Fulano de Tal', solicitanteDoc: 'MAT-123', assinaturaId: a.body.id });
    expect(r.status).toBe(201);
    // não reutiliza a assinatura, e a chave não pode sair duas vezes
    expect((await api(op).post('/chaves/emprestimos').send({ chaveId: chave.id, solicitante: 'Fulano de Tal', solicitanteDoc: 'MAT-123', assinaturaId: a.body.id })).status).toBe(409);
    expect((await api(op).post('/chaves/assinaturas').send({ tipo: 'retirada', chaveId: chave.id, solicitante: 'Beltrano', imagem: png() })).status).toBe(409);
    const lista = (await api(op).get('/chaves/emprestimos')).body;
    expect(lista.items[0]).toMatchObject({ local: 'Sala de Sessões', solicitante: 'Fulano de Tal', entreguePor: 'Ana Beatriz Silva', situacao: 'Em uso' });
    expect(lista.kpis.abertos).toBe(1);
  });

  let tabletToken, tabletId;
  test('pareamento do tablet: código de uso único troca por token; sem token → 401', async () => {
    const t = await api(op).post('/chaves/tablets').send({ nome: 'Tablet da Portaria' });
    expect(t.status).toBe(201);
    expect(t.body).toMatchObject({ nome: 'Tablet da Portaria', pareado: false });
    expect(t.body.codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    tabletId = t.body.id;
    expect((await tab().get('/pedido')).status).toBe(401);
    expect((await tab('tab_' + 'x'.repeat(43)).get('/pedido')).status).toBe(401);
    expect((await tab().post('/parear').send({ codigo: 'AAAA-AAAA' })).body.error).toMatch(/inválido/);
    const p = await tab().post('/parear').send({ codigo: t.body.codigo.toLowerCase().replace('-', ' ') });
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ nome: 'Tablet da Portaria' });
    tabletToken = p.body.token;
    expect((await tab().post('/parear').send({ codigo: t.body.codigo })).status).toBe(400); // uso único
    const { rows } = await db.query('SELECT token_hash FROM chaves_tablets WHERE id = $1', [tabletId]);
    expect(rows[0].token_hash).not.toContain(tabletToken); // guardado só como hash
    expect((await api(op).get('/chaves/tablets')).body.find((x) => x.id === tabletId)).toMatchObject({ pareado: true, online: true });
    expect((await tab(tabletToken).get('/pedido')).body).toEqual({ tablet: { nome: 'Tablet da Portaria' }, pedido: null });
    // o token do tablet não abre o resto do sistema
    expect((await request(app).get('/api/chaves').set('Authorization', 'Tablet ' + tabletToken)).status).toBe(401);
    const log = await db.query("SELECT 1 FROM audit_logs WHERE action = 'Tablet de assinatura pareado'");
    expect(log.rows.length).toBe(1);
  });

  test('devolução assinada no tablet pareado, que recebe o pedido automaticamente', async () => {
    const emp = (await api(op).get('/chaves/emprestimos')).body.items[0];
    expect((await api(op).post('/chaves/assinaturas').send({ tipo: 'devolucao', emprestimoId: emp.id, devolvidoPor: 'Fulano de Tal' })).body.error).toMatch(/Escolha o tablet/);
    const pedido = await api(op).post('/chaves/assinaturas').send({ tipo: 'devolucao', emprestimoId: emp.id, devolvidoPor: 'Fulano de Tal', tabletId });
    expect(pedido.body.status).toBe('pendente');
    // o tablet recebe o pedido com o resumo
    const recebido = (await tab(tabletToken).get('/pedido')).body.pedido;
    expect(recebido).toMatchObject({ id: pedido.body.id, tipo: 'devolucao', resumo: { local: 'Sala de Sessões', devolvidoPor: 'Fulano de Tal' } });
    // outro usuário não consulta o pedido
    expect((await api(pat).get('/chaves/assinaturas/' + pedido.body.id)).status).toBe(403);
    expect((await api(op).post('/chaves/emprestimos/' + emp.id + '/devolucao').send({ devolvidoPor: 'Fulano de Tal', assinaturaId: pedido.body.id })).body.error).toMatch(/ainda não assinou/);
    expect((await tab(tabletToken).post(`/pedido/${pedido.body.id}/assinar`).send({ imagem: png() })).status).toBe(200);
    expect((await tab(tabletToken).post(`/pedido/${pedido.body.id}/assinar`).send({ imagem: png() })).status).toBe(409);
    expect((await api(op).get('/chaves/assinaturas/' + pedido.body.id)).body).toMatchObject({ status: 'assinada', dispositivo: 'tablet' });
    const d = await api(op).post('/chaves/emprestimos/' + emp.id + '/devolucao').send({ devolvidoPor: 'Fulano de Tal', assinaturaId: pedido.body.id });
    expect(d.status).toBe(200);
    const termo = (await api(op).get('/chaves/emprestimos/' + emp.id)).body;
    expect(termo).toMatchObject({ situacao: 'Devolvida', devolvidoPor: 'Fulano de Tal', recebidoPor: 'Ana Beatriz Silva' });
    expect(termo.assinaturaRetirada.imagem).toMatch(/^data:image\/png;base64,/);
    expect(termo.assinaturaDevolucao).toMatchObject({ dispositivo: 'tablet' });
    // integridade: o hash confere com o conteúdo, a imagem e a data/hora registrados
    const { rows } = await db.query('SELECT resumo, imagem, assinada_em, hash FROM chaves_assinaturas WHERE id = $1', [pedido.body.id]);
    expect(K.hashOf(rows[0].resumo, rows[0].imagem, new Date(rows[0].assinada_em).toISOString())).toBe(rows[0].hash);
    const log = await db.query("SELECT 1 FROM audit_logs WHERE action = 'Leitura de dados pessoais' AND detail LIKE 'Termo de chave%'");
    expect(log.rows.length).toBe(1);
  });

  test('pedido de assinatura expirado é recusado; alerta de chave não devolvida', async () => {
    const c2 = (await api(op).get('/chaves')).body.find((c) => c.codigo === 'CH-002');
    const p = await api(op).post('/chaves/assinaturas').send({ tipo: 'retirada', chaveId: c2.id, solicitante: 'Ciclano Silva', tabletId });
    await db.query("UPDATE chaves_assinaturas SET expira_em = NOW() - INTERVAL '1 minute' WHERE id = $1", [p.body.id]);
    expect((await tab(tabletToken).get('/pedido')).body.pedido).toBeNull();
    expect((await tab(tabletToken).post(`/pedido/${p.body.id}/assinar`).send({ imagem: png() })).body.error).toMatch(/expirou/);
    const a = await api(op).post('/chaves/assinaturas').send({ tipo: 'retirada', chaveId: c2.id, solicitante: 'Ciclano Silva', imagem: png() });
    const r = await api(op).post('/chaves/emprestimos').send({ chaveId: c2.id, solicitante: 'Ciclano Silva', assinaturaId: a.body.id });
    await db.query("UPDATE chaves_emprestimos SET retirada_em = NOW() - INTERVAL '30 hours' WHERE id = $1", [r.body.id]);
    const al = await K.alerts();
    expect(al.find((x) => x.id === 'chave-atraso-' + r.body.id)).toMatchObject({ level: 'warning', module: 'chaves' });
    expect((await api(op).get('/chaves/emprestimos?situacao=atrasadas')).body.items).toHaveLength(1);
    expect((await api(op).patch(`/chaves/${c2.id}/ativa`).send({ ativa: false })).status).toBe(409);
  });

  test('novo código desconecta o aparelho; remover o tablet revoga o token', async () => {
    const n = await api(op).post(`/chaves/tablets/${tabletId}/codigo`);
    expect(n.body.codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect((await tab(tabletToken).get('/pedido')).status).toBe(401);
    const novo = (await tab().post('/parear').send({ codigo: n.body.codigo })).body.token;
    expect((await tab(novo).get('/pedido')).status).toBe(200);
    expect((await api(op).delete('/chaves/tablets/' + tabletId)).status).toBe(200);
    expect((await tab(novo).get('/pedido')).status).toBe(401);
    expect((await api(op).get('/chaves/tablets')).body.find((x) => x.id === tabletId)).toBeUndefined();
  });
});
