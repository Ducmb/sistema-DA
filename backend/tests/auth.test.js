const { app, db, request, login, api } = require('./helpers');
const mailer = require('../src/services/mailer');

afterAll(() => db.pool.end());

describe('Autenticação', () => {
  test('login válido devolve token, perfis e módulos', async () => {
    const r = await request(app).post('/api/auth/login').send({ username: 'admin', password: '123456' });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user.roles).toEqual(['Administrativo']);
    expect(r.body.user.modules).toContain('configuracoes');
    expect(r.body.user).not.toHaveProperty('password_hash');
  });

  test('aceita e-mail institucional no lugar do usuário', async () => {
    const r = await request(app).post('/api/auth/login').send({ username: 'ana.silva@camara.local', password: 'senha123' });
    expect(r.status).toBe(200);
  });

  test('senha errada informa tentativas restantes e bloqueia após o limite', async () => {
    for (let i = 1; i <= 4; i++) {
      const r = await request(app).post('/api/auth/login').send({ username: 'patrimonio', password: 'errada' });
      expect(r.status).toBe(401);
      expect(r.body.error).toContain(`${5 - i} tentativa(s) restante(s)`);
    }
    const r5 = await request(app).post('/api/auth/login').send({ username: 'patrimonio', password: 'errada' });
    expect(r5.body.error).toMatch(/bloqueada por 15 min/);
    const r6 = await request(app).post('/api/auth/login').send({ username: 'patrimonio', password: 'teste2026' });
    expect(r6.status).toBe(423);
    await db.query("DELETE FROM login_attempts WHERE username_key = 'patrimonio'");
  });

  test('usuário inexistente recebe a mesma mensagem genérica', async () => {
    const r = await request(app).post('/api/auth/login').send({ username: 'naoexiste', password: 'x' });
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/Usuário ou senha inválidos/);
  });

  test('rotas protegidas exigem token', async () => {
    const r = await request(app).get('/api/auth/me');
    expect(r.status).toBe(401);
  });

  test('logout revoga a sessão', async () => {
    const t = await login('visualizador');
    expect((await api(t).post('/auth/logout')).status).toBe(200);
    expect((await api(t).get('/auth/me')).status).toBe(401);
  });

  test('sessão expira por inatividade', async () => {
    const t = await login('gerencia');
    await db.query("UPDATE sessions SET last_seen_at = NOW() - INTERVAL '31 minutes' WHERE user_id = (SELECT id FROM users WHERE username = 'gerencia')");
    const r = await api(t).get('/auth/me');
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('expirada');
  });
});

describe('Recuperação e troca de senha', () => {
  test('forgot-password responde igual para e-mail inexistente', async () => {
    const r = await request(app).post('/api/auth/forgot-password').send({ email: 'ninguem@camara.local' });
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
  });

  test('fluxo completo de redefinição com token de uso único', async () => {
    mailer.outbox.length = 0;
    await request(app).post('/api/auth/forgot-password').send({ email: 'joao.costa@camara.local' });
    const msg = mailer.outbox.find((m) => m.to === 'joao.costa@camara.local');
    const token = /token=([0-9a-f]{64})/.exec(msg.text)[1];
    const { rows } = await db.query('SELECT token_hash FROM password_resets ORDER BY id DESC LIMIT 1');
    expect(rows[0].token_hash).not.toBe(token); // só o hash é salvo
    const fraca = await request(app).post('/api/auth/reset-password').send({ token, password: 'abc' });
    expect(fraca.status).toBe(400);
    const ok = await request(app).post('/api/auth/reset-password').send({ token, password: 'NovaSenha#2026' });
    expect(ok.status).toBe(200);
    const reuse = await request(app).post('/api/auth/reset-password').send({ token, password: 'OutraSenha#2026' });
    expect(reuse.status).toBe(400);
    await login('almoxarifado', 'NovaSenha#2026');
  });

  test('token expirado é recusado', async () => {
    mailer.outbox.length = 0;
    await request(app).post('/api/auth/forgot-password').send({ email: 'maria.gomes@camara.local' });
    const token = /token=([0-9a-f]{64})/.exec(mailer.outbox[0].text)[1];
    await db.query("UPDATE password_resets SET expires_at = NOW() - INTERVAL '1 minute' WHERE used_at IS NULL");
    const r = await request(app).post('/api/auth/reset-password').send({ token, password: 'NovaSenha#2026' });
    expect(r.status).toBe(400);
  });

  test('troca de senha exige a atual e encerra outras sessões', async () => {
    const t1 = await login('silvia.prado');
    const t2 = await login('silvia.prado');
    const bad = await api(t1).put('/auth/password').send({ currentPassword: 'x', newPassword: 'Forte#Senha1' });
    expect(bad.status).toBe(400);
    const r = await api(t1).put('/auth/password').send({ currentPassword: 'teste2026', newPassword: 'Forte#Senha1' });
    expect(r.status).toBe(200);
    expect((await api(t2).get('/auth/me')).status).toBe(401);
    expect((await api(r.body.token).get('/auth/me')).status).toBe(200);
  });
});

describe('Meus Dados', () => {
  test('atualiza contato e barra dados funcionais', async () => {
    const t = await login('operador');
    const ok = await api(t).put('/profile').send({ phone: '(14) 99999-0000', personalEmail: 'ana@email.com', birthday: '1988-11-02' });
    expect(ok.status).toBe(200);
    expect(ok.body.phone).toBe('(14) 99999-0000');
    const bloqueado = await api(t).put('/profile').send({ name: 'Outro Nome', phone: '(14) 99999-0000', personalEmail: '', birthday: '' });
    expect(bloqueado.status).toBe(403);
    const invalido = await api(t).put('/profile').send({ phone: '123', personalEmail: '', birthday: '' });
    expect(invalido.status).toBe(400);
  });
});
