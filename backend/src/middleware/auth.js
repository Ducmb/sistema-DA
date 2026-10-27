const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../services/config');
const audit = require('../services/audit');
const { userAccess, MODULE_LABEL, primaryRole } = require('../services/access');

const TOUCH_MS = 15000;

/**
 * Valida o JWT, a sessão no servidor (revogação e inatividade) e carrega perfis/módulos.
 * 401 com code: 'expirada' quando a sessão caiu por inatividade.
 */
async function authenticate(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Faça login para continuar.', code: 'login' });
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
      return res.status(401).json({ error: 'Sessão expirada. Entre novamente.', code: 'expirada' });
    }
    const { rows } = await db.query(
      `SELECT s.id AS sid, s.last_seen_at, s.revoked_at, u.id, u.username, u.name, u.email, u.status, u.token_version,
              u.registration, u.position, u.hierarchy, u.department, u.preferences
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = $1 AND u.id = $2`, [payload.sid, payload.sub]);
    const r = rows[0];
    if (!r || r.revoked_at || r.status !== 'active' || r.token_version !== payload.tv) {
      return res.status(401).json({ error: 'Sessão encerrada. Entre novamente.', code: 'login' });
    }
    const idleMs = (await config.get('geral.sessaoMin')) * 60000;
    const idle = Date.now() - new Date(r.last_seen_at).getTime();
    if (idle > idleMs) {
      await db.query("UPDATE sessions SET revoked_at = NOW(), revoked_reason = 'inatividade' WHERE id = $1", [r.sid]);
      const acc0 = await userAccess(r.id);
      await audit.log(req, { action: 'Sessão expirada', module: 'auth', detail: 'Inatividade de ' + Math.round(idleMs / 60000) + ' min', actor: { id: r.id, name: r.name, roles: acc0.roles } });
      return res.status(401).json({ error: 'Sessão expirada por inatividade. Entre novamente.', code: 'expirada' });
    }
    // Chamadas automáticas (feed em tempo real) não contam como atividade do usuário
    if (idle > TOUCH_MS && req.get('X-Background') !== '1') await db.query('UPDATE sessions SET last_seen_at = NOW() WHERE id = $1', [r.sid]);
    const acc = await userAccess(r.id);
    req.user = {
      id: r.id, sid: r.sid, username: r.username, name: r.name, email: r.email,
      registration: r.registration, position: r.position, hierarchy: r.hierarchy, department: r.department,
      preferences: r.preferences || {}, roles: acc.roles, role: primaryRole(acc.roles), modules: acc.modules, isAdmin: acc.isAdmin
    };
    next();
  } catch (e) {
    next(e);
  }
}

const can = (user, mod) => !!user && user.modules.includes(mod);

/** Exige acesso a pelo menos um dos módulos; registra tentativa negada. */
const requireModule = (...mods) => async (req, res, next) => {
  if (mods.some((m) => can(req.user, m))) return next();
  await audit.log(req, { kind: 'negado', action: 'Acesso negado', module: mods[0], detail: 'Tentativa de acessar ' + (MODULE_LABEL[mods[0]] || mods[0]) + ' (' + req.method + ' ' + req.originalUrl.split('?')[0] + ')', level: 'warning' });
  res.status(403).json({ error: 'Acesso negado: seu perfil não tem permissão para ' + (MODULE_LABEL[mods[0]] || mods[0]) + '.' });
};

/** Somente perfil Administrativo. */
async function requireAdmin(req, res, next) {
  if (req.user && req.user.isAdmin) return next();
  await audit.log(req, { kind: 'negado', action: 'Acesso negado', module: 'auth', detail: 'Ação exclusiva do Administrativo (' + req.method + ' ' + req.originalUrl.split('?')[0] + ')', level: 'warning' });
  res.status(403).json({ error: 'Acesso negado: ação exclusiva do perfil Administrativo.' });
}

module.exports = { authenticate, requireModule, requireAdmin, can };
