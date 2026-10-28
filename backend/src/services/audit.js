/**
 * Registro central de auditoria. Nunca lança: falha de log não derruba a requisição.
 */
const db = require('../db');
const config = require('./config');

const device = (ua) => (/Mobi|Android|iPhone/i.test(ua || '') ? 'Celular' : 'Navegador');

/**
 * @param {object} req  requisição (usa req.user, IP e User-Agent) — pode ser null em rotinas
 * @param {object} e    { action, module, detail, level, targetUserId, changes, actor }
 */
async function log(req, e, client = db) {
  try {
    const u = e.actor || (req && req.user) || null;
    const ua = req ? req.get('User-Agent') || '' : '';
    // Configurações de quais eventos registrar
    if (e.kind === 'login' && (await config.get('audit.logins')) === false) return;
    if (e.kind === 'negado' && (await config.get('audit.negados')) === false) return;
    if (e.kind === 'exportacao' && (await config.get('audit.exportacoes')) === false) return;
    await client.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, module, detail, level, device, ip, user_agent, target_user_id, changes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [u ? u.id || null : null, u ? u.name : (e.userName || 'desconhecido'), u ? (u.roles || []).join(', ') || u.role || '—' : '—',
        e.action, e.module, String(e.detail || '').slice(0, 2000), e.level || 'info', req ? device(ua) : 'Servidor',
        req ? req.ip : null, ua ? ua.slice(0, 500) : null, e.targetUserId || null, e.changes ? JSON.stringify(e.changes) : null]
    );
  } catch (err) {
    console.error('[audit] falha ao registrar:', err.message);
  }
}

/** Leitura de dados pessoais (LGPD/RNF03): sempre registrada, não pode ser desligada. */
async function logPersonalRead(req, detail, targetUserId) {
  await log(req, { action: 'Leitura de dados pessoais', module: 'rh', detail, targetUserId });
}

module.exports = { log, logPersonalRead };
