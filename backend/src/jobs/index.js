/**
 * Rotinas agendadas (node-cron, fuso de Brasília).
 */
const cron = require('node-cron');
const db = require('../db');
const config = require('../services/config');
const catalogo = require('../services/catalogo');
const estoqueSync = require('./estoqueSync');

async function purgeAudit() {
  const dias = await config.get('audit.retencaoDias');
  const r = await db.query('DELETE FROM audit_logs WHERE ts < NOW() - make_interval(days => $1)', [dias]);
  if (r.rowCount) console.log(`[jobs] auditoria: ${r.rowCount} registro(s) além da retenção removido(s)`);
  await db.query("DELETE FROM sessions WHERE revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days'");
  await db.query("DELETE FROM password_resets WHERE expires_at < NOW() - INTERVAL '30 days'");
}

const tasks = [];
function schedule() {
  const opt = { timezone: 'America/Sao_Paulo' };
  tasks.push(cron.schedule('30 3 * * *', () => purgeAudit().catch((e) => console.error('[jobs] limpeza:', e.message)), opt));
  // Catálogo compras.gov.br (CATMAT/CATSER) — diário às 03h
  tasks.push(cron.schedule('0 3 * * *', () => catalogo.sync().catch((e) => console.error('[jobs] catálogo:', e.message)), opt));
  // Pastas de RME/BRM no Google Drive — intervalo de Configurações › Almoxarifado
  let lastDrive = 0, running = false;
  tasks.push(cron.schedule('* * * * *', async () => {
    if (running || !estoqueSync.configured()) return;
    const every = (await config.get('almox.intervalo')) * 60000;
    if (Date.now() - lastDrive < every) return;
    running = true; lastDrive = Date.now();
    try { await estoqueSync.run(); } catch (e) { console.error('[jobs] estoque:', e.message); } finally { running = false; }
  }, opt));
}

module.exports = { schedule, purgeAudit, tasks };
