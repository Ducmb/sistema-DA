/**
 * Registro das rotas dos módulos setoriais. Cada módulo exige o próprio acesso (403 caso contrário).
 */
const { requireModule } = require('../middleware/auth');

function mount(api) {
  api.use('/pessoal', requireModule('rh'), require('./pessoal'));
  api.use('/compras', requireModule('compras'), require('./compras'));
  api.use('/almoxarifado', requireModule('almoxarifado'), require('./almoxarifado'));
  api.use('/patrimonio', requireModule('patrimonio'), require('./patrimonio'));
  api.use('/protocolo', requireModule('protocolo'), require('./protocolo'));
  api.use('/mocoes', requireModule('mocoes'), require('./mocoes'));
  api.use('/legislacoes', requireModule('legislacoes'), require('./legislacoes'));
  return api;
}

module.exports = { mount };
