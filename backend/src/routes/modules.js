/**
 * Registro das rotas dos módulos setoriais. Cada módulo exige o próprio acesso (403 caso contrário).
 */
const { requireModule } = require('../middleware/auth');

function mount(api) {
  api.use('/pessoal', requireModule('rh'), require('./pessoal'));
  api.use('/compras', requireModule('compras'), require('./compras'));
  api.use('/almoxarifado', requireModule('almoxarifado'), require('./almoxarifado'));
  return api;
}

module.exports = { mount };
