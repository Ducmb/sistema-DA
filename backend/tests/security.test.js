const { db, login, api, request, app } = require('./helpers');
const pw = require('../src/services/passwords');

afterAll(() => db.pool.end());

describe('Revisão de segurança', () => {
  test('login leva o mesmo tempo para usuário inexistente, convite pendente e senha errada', async () => {
    const bcrypt = require('bcryptjs');
    expect(bcrypt.getRounds(pw.DUMMY_HASH)).toBe(bcrypt.getRounds(await pw.hash('x')));
    expect(await pw.compare('qualquer', pw.UNUSABLE)).toBe(false);
    const r = await request(app).post('/api/auth/login').send({ username: 'nao.existe', password: 'x' });
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/Usuário ou senha inválidos/);
  });

  test('servidor com acesso a Gestão de Pessoal não altera os próprios dados funcionais', async () => {
    const admin = await login('admin');
    const opId = (await db.query("SELECT id FROM users WHERE username = 'operador'")).rows[0].id;
    await api(admin).put(`/users/${opId}/access/rh`).send({ allowed: true });
    const op = await login('operador');
    const me = (await api(op).get('/pessoal/servidores')).body.find((s) => s.id === opId);
    const body = { name: me.name + ' X', registration: me.registration, position: me.position, department: me.department, situacao: me.situacao, email: me.email };
    const r = await api(op).put(`/pessoal/servidores/${opId}`).send(body);
    expect(r.status).toBe(403);
    expect((await db.query("SELECT 1 FROM audit_logs WHERE action = 'Alteração bloqueada' AND module = 'rh'")).rows.length).toBe(1);
    // nem desliga um administrador
    const adm = (await api(op).get('/pessoal/servidores')).body.find((s) => s.name === 'Dr. Roberto Alencar');
    const d = await api(op).put(`/pessoal/servidores/${adm.id}`).send({ name: adm.name, registration: adm.registration, position: adm.position, department: adm.department, situacao: 'Desligado', email: adm.email });
    expect(d.status).toBe(403);
    // afastamento de quem não é administrador continua permitido
    const ana = (await api(op).get('/pessoal/servidores')).body.find((s) => s.name === 'João Pedro Costa');
    const a = await api(op).put(`/pessoal/servidores/${ana.id}`).send({ name: ana.name, registration: ana.registration, position: ana.position, department: ana.department, situacao: 'Afastado', email: ana.email });
    expect(a.status).toBe(200);
    await api(admin).put(`/pessoal/servidores/${ana.id}`).send({ name: ana.name, registration: ana.registration, position: ana.position, department: ana.department, situacao: ana.situacao, email: ana.email });
    await api(admin).delete(`/users/${opId}/access/rh`);
  });

  test('transferência de patrimônio para servidor só avança com a assinatura dele', async () => {
    const pat = await login('patrimonio');
    const c = await api(pat).post('/patrimonio/transferencias').send({ code: 'DA-PAT-77001', description: 'Monitor', fromUser: 'Recepção', toUser: 'Patricia de Souza', date: '2026-10-27' });
    expect((await api(pat).post(`/patrimonio/transferencias/${c.body.id}/etapa`).send({ dir: 1 })).status).toBe(403);
    // Patricia de Souza não tem o módulo Patrimônio; simula a assinatura dela pelo banco
    await db.query("UPDATE patrimonio_transferencias SET status = 'Verificar transferência', assinado_em = NOW(), assinado_por = to_user_id WHERE id = $1", [c.body.id]);
    const edit = await api(pat).put(`/patrimonio/transferencias/${c.body.id}`).send({ code: 'DA-PAT-77001', description: 'Monitor', fromUser: 'Recepção', toUser: 'Outra pessoa', date: '2026-10-27' });
    expect(edit.status).toBe(409);
    const cc = await api(pat).put(`/patrimonio/transferencias/${c.body.id}`).send({ code: 'DA-PAT-77001', description: 'Monitor', fromUser: 'Recepção', toUser: 'Patricia de Souza', date: '2026-10-27', toCc: 'Diretoria Administrativa' });
    expect(cc.status).toBe(200);
    await api(pat).post(`/patrimonio/transferencias/${c.body.id}/etapa`).send({ dir: -1 });
    const t = (await db.query('SELECT status, assinado_em FROM patrimonio_transferencias WHERE id = $1', [c.body.id])).rows[0];
    expect(t).toEqual({ status: 'Pendente', assinado_em: null });
  });

  test('upload limitado a 25 arquivos por remessa', async () => {
    const op = await login('operador');
    let req = api(op).post('/almoxarifado/estoque/upload');
    for (let i = 0; i < 26; i++) req = req.attach('files', Buffer.from('%PDF-1.4'), `f${i}.pdf`);
    const r = await req;
    expect(r.status).toBe(400);
  });

  test('log de auditoria não pode ser alterado e leitura de dados pessoais é sempre registrada', async () => {
    await expect(db.query("UPDATE audit_logs SET detail = 'adulterado'")).rejects.toThrow(/somente de inclusão/);
    const admin = await login('admin');
    const before = (await db.query("SELECT COUNT(*)::int n FROM audit_logs WHERE action = 'Leitura de dados pessoais'")).rows[0].n;
    await api(admin).get('/pessoal/servidores');
    const after = (await db.query("SELECT COUNT(*)::int n FROM audit_logs WHERE action = 'Leitura de dados pessoais'")).rows[0].n;
    expect(after).toBe(before + 1);
  });

  test('PDF de legislação servido com CSP sandbox', async () => {
    const admin = await login('admin');
    const pdf = require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'outro.pdf'));
    const n = await api(admin).post('/legislacoes').field('tipo', 'Portaria').field('numero', 'P-SEC').field('ementa', 'E').attach('pdf', pdf, 'p.pdf');
    const r = await api(admin).get(`/legislacoes/${n.body.id}/pdf`);
    expect(r.headers['content-security-policy']).toMatch(/sandbox/);
  });
});
