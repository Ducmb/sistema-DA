/**
 * Central de Notificações (portado de NotificationsModule): os alertas reais dos módulos
 * acessíveis ao usuário viram notificações com estado próprio (lida, arquivada).
 * Configurações › Notificações define canais e gravidades; o usuário escolhe os tipos.
 */
const db = require('../db');
const config = require('./config');
const feed = require('./feed');
const mailer = require('./mailer');
const access = require('./access');

const TYPES = [
  { id: 'alert', label: 'Alertas Críticos', description: 'Estoque baixo, prazos vencidos, erros', default: true },
  { id: 'approval', label: 'Aprovações Pendentes', description: 'Itens aguardando sua aprovação ou assinatura', default: true },
  { id: 'update', label: 'Atualizações', description: 'Mudanças de status e conclusões', default: true },
  { id: 'reminder', label: 'Lembretes', description: 'Próximas ações e prazos', default: false }
];
const DEFAULT_PREFS = { types: Object.fromEntries(TYPES.map((t) => [t.id, t.default])), tempoReal: true, email: true, silencio: { on: true, inicio: '22:00', fim: '08:00' } };
const APPROVAL = /^(pat-pend|rh-parada|band-ret)/;

const tipoOf = (a) => (APPROVAL.test(a.id) ? 'approval' : a.level === 'info' ? 'reminder' : 'alert');
const prefsOf = (u) => {
  const p = (u.preferences && u.preferences.notificacoes) || {};
  return { ...DEFAULT_PREFS, ...p, types: { ...DEFAULT_PREFS.types, ...(p.types || {}) }, silencio: { ...DEFAULT_PREFS.silencio, ...(p.silencio || {}) } };
};

/** Hora atual (HH:MM) em Brasília. */
const nowHM = () => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
function inQuiet(s, hm = nowHM()) {
  if (!s.on) return false;
  return s.inicio <= s.fim ? hm >= s.inicio && hm < s.fim : hm >= s.inicio || hm < s.fim;
}

/** Alertas atuais permitidos pelas gravidades configuradas, já registrados no estado do usuário. */
async function current(userId, modules) {
  const cfg = await config.snapshot();
  if (!cfg('notif.sistema')) return { disabled: true, live: [] };
  const allow = { critical: cfg('notif.critico'), warning: cfg('notif.atencao'), info: cfg('notif.info') };
  const alerts = (await feed.alerts(modules)).filter((a) => allow[a.level] !== false);
  const seen = new Set();
  const live = alerts.filter((a) => (seen.has(a.id) ? false : seen.add(a.id)));
  if (live.length) {
    const cols = ['notif_id', 'module', 'level', 'tipo', 'title', 'message', 'href'];
    const vals = [], params = [userId];
    live.forEach((a, i) => {
      const b = i * cols.length + 2;
      vals.push('($1,' + cols.map((_, k) => '$' + (b + k)).join(',') + ')');
      params.push(a.id.slice(0, 120), a.module || '', a.level, tipoOf(a), String(a.title).slice(0, 300), String(a.description || '').slice(0, 500), a.href || '');
    });
    await db.query(`INSERT INTO notification_state (user_id, ${cols.join(', ')}) VALUES ${vals.join(', ')}
      ON CONFLICT (user_id, notif_id) DO UPDATE SET level = EXCLUDED.level, tipo = EXCLUDED.tipo, title = EXCLUDED.title, message = EXCLUDED.message, href = EXCLUDED.href`, params);
  }
  return { disabled: false, live: live.map((a) => a.id.slice(0, 120)) };
}

const itemOf = (r) => ({ id: r.notif_id, module: r.module, level: r.level, tipo: r.tipo, title: r.title, message: r.message, href: r.href, firstSeen: r.first_seen, unread: !r.read_at, archivedAt: r.archived_at });

async function list(user) {
  const prefs = prefsOf(user);
  const { disabled, live } = await current(user.id, user.modules);
  const { rows } = await db.query('SELECT * FROM notification_state WHERE user_id = $1 AND (notif_id = ANY($2) OR archived_at IS NOT NULL) ORDER BY first_seen DESC, notif_id', [user.id, live]);
  const order = { critical: 0, warning: 1, info: 2 };
  const inbox = rows.filter((r) => !r.archived_at && prefs.types[r.tipo] !== false).map(itemOf)
    .sort((a, b) => (b.unread - a.unread) || order[a.level] - order[b.level] || new Date(b.firstSeen) - new Date(a.firstSeen));
  const archived = rows.filter((r) => r.archived_at).map(itemOf).sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
  return { disabled, inbox, archived, types: TYPES.map(({ id, label, description }) => ({ id, label, description, enabled: prefs.types[id] !== false })), prefs, emailHabilitado: await config.get('notif.email'), resumoHora: await config.get('notif.resumoHora') };
}

/** Contador do sino: não lidas; no horário de silêncio, só as críticas. */
async function summary(user) {
  const prefs = prefsOf(user);
  if (!prefs.tempoReal) return { unread: 0, critical: 0 };
  const { inbox } = await list(user);
  const unread = inbox.filter((n) => n.unread);
  const critical = unread.filter((n) => n.level === 'critical').length;
  return { unread: inQuiet(prefs.silencio) ? critical : unread.length, critical };
}

/** Resumo diário por e-mail (Configurações › Notificações: canal e horário). */
async function sendDigests() {
  if (!(await config.get('notif.email'))) return 0;
  const { rows: users } = await db.query("SELECT id, name, email, preferences FROM users WHERE status = 'active' AND email IS NOT NULL AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = users.id)");
  let sent = 0;
  for (const u of users) {
    const prefs = prefsOf(u);
    if (!prefs.email) continue;
    const acc = await access.userAccess(u.id);
    if (!acc.modules.includes('notificacoes')) continue;
    const { inbox } = await list({ ...u, modules: acc.modules });
    const novas = (await db.query('SELECT notif_id FROM notification_state WHERE user_id = $1 AND emailed_at IS NULL AND read_at IS NULL AND archived_at IS NULL', [u.id])).rows.map((r) => r.notif_id);
    const items = inbox.filter((n) => novas.includes(n.id));
    if (!items.length) continue;
    const text = `Olá, ${u.name}.\n\nVocê tem ${items.length} notificação(ões) nova(s) no Sistema DA:\n\n` +
      items.map((n) => `• [${n.level === 'critical' ? 'CRÍTICO' : n.level === 'warning' ? 'ATENÇÃO' : 'INFO'}] ${n.title}${n.message ? ' — ' + n.message : ''}`).join('\n') +
      `\n\nAcesse: ${(process.env.APP_URL || '').replace(/\/$/, '')}/notificacoes\n`;
    await mailer.send({ to: u.email, subject: `Sistema DA — ${items.length} notificação(ões) nova(s)`, text });
    await db.query('UPDATE notification_state SET emailed_at = NOW() WHERE user_id = $1 AND notif_id = ANY($2)', [u.id, items.map((n) => n.id)]);
    sent++;
  }
  return sent;
}

module.exports = { TYPES, DEFAULT_PREFS, tipoOf, prefsOf, inQuiet, nowHM, current, list, summary, sendDigests };
