(function(){
if (window.__sectorsLoaded) return; window.__sectorsLoaded = true;
// Centros de custo: fonte única de setores/requisitantes de todo o sistema.
var KEY = 'DA_centros_custo_v1', OLD = 'DA_sectors';
var SEED = [
  ['CC-001', 'Diretoria Administrativa'], ['CC-002', 'Serviço de Licitações e Contratos'], ['CC-003', 'Serviço de Almoxarifado e Patrimônio'],
  ['CC-004', 'Presidência'], ['CC-005', 'Secretaria Legislativa'], ['CC-006', 'Procuradoria Jurídica'], ['CC-007', 'Controle Interno'], ['CC-008', 'Comunicação Social'], ['CC-009', 'Tecnologia da Informação'], ['CC-010', 'Gestão de Pessoal']
];
var PAT_SEED = [['PAT-001', 'Almoxarifado Central'], ['PAT-002', 'Sala de Sessões'], ['PAT-003', 'Protocolo'], ['PAT-004', 'Diretoria Administrativa'], ['PAT-005', 'Plenário'], ['PAT-006', 'Gabinetes dos Vereadores'], ['PAT-007', 'Recepção']];
function withPat(list) { list.forEach(function (c) { if (!c.tipo) c.tipo = 'padrao'; }); if (!list.some(function (c) { return c.tipo === 'patrimonio'; })) PAT_SEED.forEach(function (x) { list.push({ id: x[0], codigo: x[0], nome: x[1], ativo: true, tipo: 'patrimonio' }); }); return list; }
function load() {
  try { var s = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(s) && s.length) return withPat(s); } catch (e) {}
  var list = SEED.map(function (x) { return { id: x[0], codigo: x[0], nome: x[1], ativo: true, tipo: 'padrao' }; });
  try { var old = JSON.parse(localStorage.getItem(OLD)); if (Array.isArray(old)) old.forEach(function (n) { if (n && !list.some(function (c) { return c.nome === n; })) list.push({ id: 'CC-' + String(list.length + 1).padStart(3, '0'), codigo: 'CC-' + String(list.length + 1).padStart(3, '0'), nome: n, ativo: true }); }); } catch (e) {}
  return withPat(list);
}
function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  var names = list.filter(function (c) { return c.ativo && c.tipo !== 'patrimonio'; }).map(function (c) { return c.nome; });
  window.dispatchEvent(new CustomEvent('sectorschange', { detail: { sectors: names } }));
  window.dispatchEvent(new CustomEvent('costcenterschange'));
}
function nextCode(list, tipo) { var pre = tipo === 'patrimonio' ? 'PAT-' : 'CC-'; var n0 = list.filter(function (c) { return String(c.codigo).indexOf(pre) === 0; }).reduce(function (m, c) { var k = parseInt(String(c.codigo).replace(/\D/g, ''), 10); return isFinite(k) && k > m ? k : m; }, 0) + 1; return pre + String(n0).padStart(3, '0'); }
function nextCodeOld(list) { var n = list.reduce(function (m, c) { var k = parseInt(String(c.codigo).replace(/\D/g, ''), 10); return isFinite(k) && k > m ? k : m; }, 0) + 1; return 'CC-' + String(n).padStart(3, '0'); }
window.DACostCenters = {
  all: load,
  active: function (tipo) { return load().filter(function (c) { return c.ativo && (!tipo || (c.tipo || 'padrao') === tipo); }); },
  patrimonio: function () { return load().filter(function (c) { return c.ativo && c.tipo === 'patrimonio'; }).map(function (c) { return c.nome; }); },
  nextCode: function (tipo) { return nextCode(load(), tipo); },
  add: function (codigo, nome, tipo) {
    var list = load(); tipo = tipo === 'patrimonio' ? 'patrimonio' : 'padrao'; nome = String(nome || '').trim(); codigo = String(codigo || '').trim().toUpperCase() || nextCode(list.filter(function (c) { return (c.tipo || 'padrao') === tipo; }), tipo);
    if (!nome) return { ok: false, msg: 'Informe o nome do centro de custo.' };
    if (list.some(function (c) { return c.nome.toLowerCase() === nome.toLowerCase() && (c.tipo || 'padrao') === tipo; })) return { ok: false, msg: 'Já existe um centro de custo com esse nome nesse tipo.' };
    if (list.some(function (c) { return c.codigo === codigo; })) return { ok: false, msg: 'Código já utilizado.' };
    list.push({ id: codigo + '-' + Date.now(), codigo: codigo, nome: nome, ativo: true, tipo: tipo }); save(list); return { ok: true };
  },
  update: function (id, codigo, nome, tipo) {
    var list = load(); var c = list.find(function (x) { return x.id === id; }); if (!c) return { ok: false, msg: 'Não encontrado.' };
    nome = String(nome || '').trim(); codigo = String(codigo || '').trim().toUpperCase();
    if (!nome || !codigo) return { ok: false, msg: 'Informe código e nome.' };
    tipo = tipo === 'patrimonio' ? 'patrimonio' : (tipo === 'padrao' ? 'padrao' : (c.tipo || 'padrao'));
    if (list.some(function (x) { return x.id !== id && (x.codigo === codigo || (x.nome.toLowerCase() === nome.toLowerCase() && (x.tipo || 'padrao') === tipo)); })) return { ok: false, msg: 'Código ou nome já utilizado.' };
    c.codigo = codigo; c.nome = nome; c.tipo = tipo; save(list); return { ok: true };
  },
  setActive: function (id, on) { var list = load(); var c = list.find(function (x) { return x.id === id; }); if (c) { c.ativo = !!on; save(list); } },
  label: function (nome) { var c = load().find(function (x) { return x.nome === nome; }); return c ? c.codigo + ' · ' + c.nome : nome; }
};
window.DASectors = {
  get: function () { return load().filter(function (c) { return c.ativo && c.tipo !== 'patrimonio'; }).map(function (c) { return c.nome; }); },
  add: function (name) { window.DACostCenters.add('', name); return window.DASectors.get(); }
};
})();
