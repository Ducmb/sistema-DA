(function(){
if (window.DACalendar) return;
var KEY = 'DA_calendar_feed';
function CFG(k, d) { try { var c = JSON.parse(localStorage.getItem('DA_config_v1')); if (c && c.values && c.values[k] !== undefined && c.values[k] !== '') return c.values[k]; } catch (e) {} return d; }
function today() { return new Date().toISOString().slice(0, 10); }
function addDays(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function br2iso(s) { var p = String(s || '').split('/'); return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : s; }
var MODULES = [
  { key: 'protocolo', label: 'Protocolo', color: '#1C543A', href: 'ProtocoloModule.dc.html' },
  { key: 'compras', label: 'Compras & Licitações', color: '#2563EB', href: 'ComprasModule.dc.html' },
  { key: 'rh', label: 'Gestão de Pessoal', color: '#B45309', href: 'RHModule.dc.html' },
  { key: 'mocoes', label: 'Moções & Homenagens', color: '#7C3AED', href: 'MocoesHomenagens.dc.html' },
  { key: 'almoxarifado', label: 'Almoxarifado', color: '#0F766E', href: 'AlmoxarifadoAmostragem.dc.html' },
  { key: 'patrimonio', label: 'Patrimônio', color: '#6B7280', href: 'PatrimonioModule.dc.html' }
];
// Dados reais de cada módulo (cadastro inicial); substituídos pelo que o módulo publicar ao ser usado.
var RH_SEED = [['Ana Silva Santos', 'Férias', '14/09/2026', '28/09/2026', 'Aprovado'], ['Carlos Mendes Oliveira', 'Licença Médica', '21/09/2026', '28/09/2026', 'Pendente'], ['João Pedro Costa', 'Férias', '01/10/2026', '15/10/2026', 'Aprovado'], ['Maria Clara Gomes', 'Férias', '12/10/2026', '26/10/2026', 'Pendente']];
var MOC_SEED = [['040/2026', 'Moção de Aplauso - Req. 274/2026', '14/07/2026', 'Aprovada'], ['039/2026', 'Moção de Pesar - Servidor Público', '14/07/2026', 'Aprovada'], ['038/2026', 'Moção de Congratulação - Escola Municipal', '27/10/2026', 'Em Análise'], ['037/2026', 'Moção de Apoio - Campanha de Saúde', '07/07/2026', 'Aprovada'], ['036/2026', 'Moção de Repúdio - Ato de Vandalismo', '30/06/2026', 'Arquivada']];
function DEFAULTS_RH() { var s = null; try { s = JSON.parse(localStorage.getItem('DA_rh_ferias_v1')); } catch (e) {} var l = Array.isArray(s) ? s.filter(function (v) { return v.status !== 'Recusado'; }).map(function (v) { return [v.employee, v.type, v.startDate, v.endDate, v.status]; }) : RH_SEED; return l.map(function (v) { return { title: v[1] + ' — ' + v[0] + (v[4] === 'Pendente' ? ' (pendente)' : ''), start: br2iso(v[2]), end: br2iso(v[3]), level: v[4] === 'Pendente' ? 'warning' : 'info', deadline: v[4] === 'Pendente', href: 'RHModule.dc.html' }; }); }
var DEFAULTS = {
  protocolo: [],
  compras: [],
  rh: (function () { var s = null; try { s = JSON.parse(localStorage.getItem('DA_rh_ferias_v1')); } catch (e) {} return Array.isArray(s) ? s.filter(function (v) { return v.status !== 'Recusado'; }).map(function (v) { return [v.employee, v.type, v.startDate, v.endDate, v.status]; }) : RH_SEED; })().map(function (v) { return { title: v[1] + ' — ' + v[0] + (v[4] === 'Pendente' ? ' (pendente)' : ''), start: br2iso(v[2]), end: br2iso(v[3]), level: v[4] === 'Pendente' ? 'warning' : 'info', href: 'RHModule.dc.html' }; }),
  mocoes: MOC_SEED.map(function (v) { return { title: 'Sessão — moção ' + v[0] + ' · ' + v[1], start: br2iso(v[2]), end: br2iso(v[2]), level: v[3] === 'Em Análise' ? 'warning' : 'info', deadline: v[3] === 'Em Análise', href: 'MocoesHomenagens.dc.html' }; }),
  almoxarifado: [
    { title: 'Contagem por amostragem — semana 39', start: '2026-09-21', end: '2026-09-23', level: 'info' },
    { title: 'Contagem por amostragem — semana 40', start: '2026-09-28', end: '2026-09-30', level: 'info' }
  ],
  patrimonio: [
    { title: 'Inventário anual de bens — início', start: '2026-10-19', end: '2026-10-30', level: 'warning' }
  ]
};
var BAND_SEED = [
    { id: 'B1', solicitacao: '2026-05-25', retirado: 'Sim', entidade: 'Igreja ADBrasBauru Cong-Tangarás', documento: '45.030.566/0001-02', telefone: '(14) 99143-3817', retirada: '2026-08-14', devolucao: '2026-08-18', conformidade: 'Sim', protocolo: '1633/2026', itens: { bauru: true, sp: true, brasil: true, mastros: true, suporte: true }, obs: '' },
    { id: 'B2', solicitacao: '2026-09-03', retirado: 'Sim', entidade: 'Agro Sem Limites 2026', documento: '', telefone: '', retirada: '2026-09-03', devolucao: '2026-09-08', conformidade: 'Sim', protocolo: '2882/2026', itens: { bauru: true, sp: true, brasil: true, mastros: true, suporte: true }, obs: '' },
    { id: 'B3', solicitacao: '2026-10-16', retirado: 'Sim', entidade: 'Assembleia de Deus Ministério Santo Fogo', documento: '798.733.408-15', telefone: '(14) 98804-5019', retirada: '2026-10-16', devolucao: '2026-10-19', conformidade: 'Sim', protocolo: '2627/2026', itens: { bauru: true, sp: false, brasil: false, mastros: true, suporte: true }, obs: '' }
  ];
function bandeiras() {
  var list = null; try { list = JSON.parse(localStorage.getItem('DA_bandeiras_v1')); } catch (e) {}
  if (!Array.isArray(list)) list = BAND_SEED;
  var hoje = today(), aviso = +CFG('mocoes.bandAmarelo', 1), vermelho = CFG('mocoes.bandVermelho', true) !== false, out = [], href = 'MocoesHomenagens.dc.html?tab=bandeiras';
  list.forEach(function (r) {
    if (r.retirado !== 'Sim' && r.retirada) out.push({ title: 'Retirada agendada de bandeiras — ' + r.entidade, start: r.retirada, end: r.retirada, level: r.retirada < hoje ? 'critical' : 'info', deadline: true, auto: true, href: href });
    if (r.retirado === 'Sim' && !r.conformidade && r.devolucao) {
      var lv = r.devolucao < hoje ? (vermelho ? 'critical' : 'warning') : (r.devolucao <= addDays(hoje, aviso) ? 'warning' : 'info');
      out.push({ title: 'Devolução prevista de bandeiras — ' + r.entidade, start: r.devolucao, end: r.devolucao, level: lv, deadline: true, auto: true, href: href });
    }
  });
  return out;
}
function read() {
  var s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  var out = {};
  MODULES.forEach(function (m) { out[m.key] = ((s && Array.isArray(s[m.key])) ? s[m.key] : DEFAULTS[m.key]).filter(function (e) { return !e.auto; }); });
  out.rh = DEFAULTS_RH();
  if (s && Array.isArray(s.compras)) out.compras = out.compras.filter(function (e) { return !/^LIC-/.test(e.title || ''); });
  var extra = (window.DALic && window.DALic.calendarEvents) ? window.DALic.calendarEvents() : {};
  Object.keys(extra).forEach(function (k) { if (out[k]) out[k] = out[k].concat(extra[k]); });
  out.mocoes = out.mocoes.concat(bandeiras());
  return out;
}
function critical(extra) {
  var hoje = today(), j7 = addDays(hoje, +CFG('painel.janelaUrgente', 7)), j30 = addDays(hoje, +CFG('painel.janelaProxima', 30));
  var feed = read(), rows = [];
  MODULES.forEach(function (m) { (feed[m.key] || []).concat(m.key === 'protocolo' ? (extra || []) : []).forEach(function (e) {
    if (!e.start) return;
    var end = e.end || e.start, bucket = null;
    if (e.deadline && end < hoje) bucket = 'vencido';
    else if (e.start >= hoje && e.start <= j7) bucket = 'urgente';
    else if (e.start > j7 && e.start <= j30) bucket = 'proximo';
    if (!bucket) return;
    rows.push({ title: e.title, date: e.deadline && end < hoje ? end : e.start, bucket: bucket, level: e.level, module: m.key, moduleLabel: m.label, color: m.color, href: e.href || m.href, own: !!e.own, ref: e.ref || '' });
  }); });
  var order = { vencido: 0, urgente: 1, proximo: 2 };
  rows.sort(function (a, b) { return order[a.bucket] - order[b.bucket] || a.date.localeCompare(b.date); });
  var pend = (window.DALic && window.DALic.pendingItems) ? window.DALic.pendingItems().map(function (p) { var m = MODULES.find(function (x) { return x.key === p.module; }); return { title: p.title, date: '', bucket: 'agendar', level: 'warning', module: p.module, moduleLabel: m.label, color: m.color, href: p.href }; }) : [];
  if (CFG('mocoes.listarSemData', true) === false) pend = [];
  return rows.concat(pend);
}
window.DACalendar = {
  modules: MODULES,
  get: read,
  critical: critical,
  publish: function (moduleKey, events) {
    var s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    s = s || {};
    var clean = events.filter(function (e) { return !e.auto; });
    if (JSON.stringify(s[moduleKey]) === JSON.stringify(clean)) return;
    s[moduleKey] = clean;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    window.dispatchEvent(new CustomEvent('calendarchange'));
  }
};
})();
