const zlib = require('zlib');
const { db, login, api } = require('./helpers');
const K = require('../src/services/chaves');

afterAll(() => db.pool.end());

/** PNG real (escala de cinza) com um traço — como o gerado pelo canvas de assinatura. */
function png(w = 400, h = 150) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.alloc((w + 1) * h, 255);
  for (let x = 20; x < w - 20; x++) { const y = Math.round(h / 2 + Math.sin(x / 15) * 30); raw[y * (w + 1) + 1 + x] = 0; raw[(y * (w + 1)) - (y > 0 ? 0 : 0)] = 0; }
  for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0;
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

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
    // tablet conectado: a janela na tela do tablet devolve o traço ao computador, que envia com dispositivo 'tablet'
    const t = await api(op).post('/chaves/assinaturas').send({ tipo: 'retirada', chaveId: chave.id, solicitante: 'Fulano de Tal', imagem: png(), dispositivo: 'tablet' });
    expect(t.body).toMatchObject({ status: 'assinada', dispositivo: 'tablet' });
    expect((await api(op).post('/chaves/assinaturas').send({ tipo: 'retirada', chaveId: chave.id, solicitante: 'Fulano de Tal', imagem: png(), dispositivo: 'celular' })).status).toBe(400);
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

  test('devolução assinada na estação tablet do mesmo usuário', async () => {
    const emp = (await api(op).get('/chaves/emprestimos')).body.items[0];
    const pedido = await api(op).post('/chaves/assinaturas').send({ tipo: 'devolucao', emprestimoId: emp.id, devolvidoPor: 'Fulano de Tal' });
    expect(pedido.body.status).toBe('pendente');
    // o tablet de outro usuário não vê nem assina o pedido
    expect((await api(pat).get('/chaves/assinaturas/pendente')).body.pedido).toBeNull();
    expect((await api(pat).post(`/chaves/assinaturas/${pedido.body.id}/assinar`).send({ imagem: png() })).status).toBe(403);
    // o tablet do mesmo usuário recebe o pedido com o resumo e assina
    const tab = (await api(op).get('/chaves/assinaturas/pendente')).body.pedido;
    expect(tab).toMatchObject({ id: pedido.body.id, tipo: 'devolucao', resumo: { local: 'Sala de Sessões', devolvidoPor: 'Fulano de Tal' } });
    expect((await api(op).post('/chaves/emprestimos/' + emp.id + '/devolucao').send({ devolvidoPor: 'Fulano de Tal', assinaturaId: pedido.body.id })).body.error).toMatch(/ainda não assinou/);
    expect((await api(op).post(`/chaves/assinaturas/${pedido.body.id}/assinar`).send({ imagem: png() })).status).toBe(200);
    expect((await api(op).post(`/chaves/assinaturas/${pedido.body.id}/assinar`).send({ imagem: png() })).status).toBe(409);
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
    const p = await api(op).post('/chaves/assinaturas').send({ tipo: 'retirada', chaveId: c2.id, solicitante: 'Ciclano Silva' });
    await db.query("UPDATE chaves_assinaturas SET expira_em = NOW() - INTERVAL '1 minute' WHERE id = $1", [p.body.id]);
    expect((await api(op).post(`/chaves/assinaturas/${p.body.id}/assinar`).send({ imagem: png() })).body.error).toMatch(/expirou/);
    const a = await api(op).post('/chaves/assinaturas').send({ tipo: 'retirada', chaveId: c2.id, solicitante: 'Ciclano Silva', imagem: png() });
    const r = await api(op).post('/chaves/emprestimos').send({ chaveId: c2.id, solicitante: 'Ciclano Silva', assinaturaId: a.body.id });
    await db.query("UPDATE chaves_emprestimos SET retirada_em = NOW() - INTERVAL '30 hours' WHERE id = $1", [r.body.id]);
    const al = await K.alerts();
    expect(al.find((x) => x.id === 'chave-atraso-' + r.body.id)).toMatchObject({ level: 'warning', module: 'chaves' });
    expect((await api(op).get('/chaves/emprestimos?situacao=atrasadas')).body.items).toHaveLength(1);
    expect((await api(op).patch(`/chaves/${c2.id}/ativa`).send({ ativa: false })).status).toBe(409);
  });
});
