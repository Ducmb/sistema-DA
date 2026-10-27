/**
 * Registro das rotas dos módulos setoriais. Cada módulo exige o próprio acesso (403 caso contrário).
 */
const { requireModule } = require('../middleware/auth');

function mount(api) {
  api.use('/painel', requireModule('dashboard'), require('./painel'));
  api.use('/pessoal', requireModule('rh'), require('./pessoal'));
  api.use('/compras', requireModule('compras'), require('./compras'));
  api.use('/almoxarifado', requireModule('almoxarifado'), require('./almoxarifado'));
  api.use('/patrimonio', requireModule('patrimonio'), require('./patrimonio'));
  api.use('/protocolo', requireModule('protocolo'), require('./protocolo'));
  api.use('/mocoes', requireModule('mocoes'), require('./mocoes'));
  api.use('/legislacoes', requireModule('legislacoes'), require('./legislacoes'));
  api.use('/notifications', requireModule('notificacoes'), require('./notifications'));
  api.use('/analytics', requireModule('analytics'), require('./analytics'));
  return api;
}

module.exports = { mount };
