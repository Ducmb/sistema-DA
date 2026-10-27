const { db, login, api } = require('./helpers');
const N = require('../src/services/notifications');
const config = require('../src/services/config');
const mailer = require('../src/services/mailer');

afterAll(() => db.pool.end());
const setCfg = async (k, v) => { await db.query('INSERT INTO system_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, JSON.stringify(v)]); config.invalidate(); };
const delCfg = async (k) => { await db.query('DELETE FROM system_config WHERE key = $1', [k]); config.invalidate(); };

describe('Regras (unidade)', () => {
  test('horário de silêncio atravessando a meia-noite', () => {
    const s = { on: true, inicio: '22:00', fim: '08:00' };
    expect(N.inQuiet(s, '23:10')).toBe(true);
    expect(N.inQuiet(s, '07:59')).toBe(true);
    expect(N.inQuiet(s, '12:00')).toBe(false);
    expect(N.inQuiet({ ...s, on: false }, '23:00')).toBe(false);
  });
  test('tipo da notificação', () => {
    expect(N.tipoOf({ id: 'pat-pend-1', level: 'warning' })).toBe('approval');
    expect(N.tipoOf({ id: 'x', level: 'critical' })).toBe('alert');
    expect(N.tipoOf({ id: 'x', level: 'info' })).toBe('reminder');
  });
});

describe('API de notificações', () => {
  let op, vis;
  beforeAll(async () => { op = await login('operador'); vis = await login('visualizador'); });

  test('Visualizador não acessa a central', async () => {
    expect((await api(vis).get('/notifications/summary')).status).toBe(403);
  });

  test('caixa de entrada só com módulos do usuário e gravidades configuradas', async () => {
    const r = (await api(op).get('/notifications')).body;
    expect(r.inbox.length).toBeGreaterThan(0);
    expect(r.inbox.every((n) => ['almoxarifado', 'mocoes', 'patrimonio', 'protocolo', 'rh', 'compras'].includes(n.module))).toBe(true);
    expect(r.inbox.some((n) => n.module === 'compras')).toBe(false);
    expect(r.inbox.some((n) => n.level === 'info')).toBe(false);
    const s = (await api(op).get('/notifications/summary')).body;
    expect(s.unread).toBeLessThanOrEqual(r.inbox.length);
  });

  test('ler, arquivar, restaurar, marcar todas e limpar', async () => {
    const { inbox } = (await api(op).get('/notifications')).body;
    const id = encodeURIComponent(inbox[0].id);
    await api(op).post(`/notifications/${id}/read`);
    let r = (await api(op).get('/notifications')).body;
    expect(r.inbox.find((n) => n.id === inbox[0].id).unread).toBe(false);
    await api(op).post(`/notifications/${id}/archive`);
    r = (await api(op).get('/notifications')).body;
    expect(r.archived.map((n) => n.id)).toContain(inbox[0].id);
    expect(r.inbox.map((n) => n.id)).not.toContain(inbox[0].id);
    await api(op).post(`/notifications/${id}/restore`);
    await api(op).post('/notifications/read-all');
    expect((await api(op).get('/notifications')).body.inbox.every((n) => !n.unread)).toBe(true);
    await api(op).post('/notifications/archive-all');
    expect((await api(op).get('/notifications')).body.inbox).toHaveLength(0);
    expect((await api(op).post('/notifications/nao-existe/read')).status).toBe(404);
  });

  test('preferências por usuário e canal desativado', async () => {
    const bad = await api(op).put('/notifications/preferences').send({ types: { alert: true }, tempoReal: true, email: true, silencio: { on: true, inicio: '25:00', fim: '08:00' } });
    expect(bad.status).toBe(400);
    const ok = await api(op).put('/notifications/preferences').send({ types: { alert: false, approval: true, update: true, reminder: false }, tempoReal: false, email: true, silencio: { on: false, inicio: '22:00', fim: '08:00' } });
    expect(ok.body.types.alert).toBe(false);
    expect((await api(op).get('/notifications/summary')).body.unread).toBe(0);
    await setCfg('notif.sistema', false);
    expect((await api(op).get('/notifications')).body.disabled).toBe(true);
    await delCfg('notif.sistema');
  });

  test('resumo diário por e-mail só com o canal habilitado', async () => {
    expect(await N.sendDigests()).toBe(0);
    await setCfg('notif.email', true);
    const before = mailer.outbox.length;
    const n = await N.sendDigests();
    expect(n).toBeGreaterThan(0);
    expect(mailer.outbox.length).toBe(before + n);
    expect(mailer.outbox[mailer.outbox.length - 1].subject).toMatch(/notificação/);
    expect(await N.sendDigests()).toBe(0);
    await delCfg('notif.email');
  });
});
