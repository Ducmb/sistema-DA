(function(){
if (window.DAEstoque) return;
var KEY = 'DA_estoque_v1';
var PDF_LIB = 'https://cdn.jsdelivr.net/npm/pdf-parse@2.4.5/dist/pdf-parse/web/pdf-parse.es.js';
var PDF_WORKER = 'https://cdn.jsdelivr.net/npm/pdf-parse@2.4.5/dist/pdf-parse/web/pdf.worker.min.mjs';
function I(code, name, unit, category, priority, stock, avg, verify) { return { code: code, name: name, unit: unit, category: category, priority: priority, frequency: priority === 'Alta' ? 'Semanal' : 'Mensal', stock: stock, avgConsumption: avg, verify: !!verify }; }
var SEED = {
  folder: { name: 'Almoxarifado — RME e BRM 2026', id: '1AbC-almox-rme-brm-2026', url: 'https://drive.google.com/drive/folders/1AbC-almox-rme-brm-2026' },
  lastSync: '2026-10-05T07:00:00',
  items: [
    I('1 50 05 0024 8', 'DESINFETANTE PARA USO PROFISSIONAL - 5L', 'GL', 'Higiene', 'Alta', 52, 10.308, true),
    I('1 50 05 0034 5', 'PAPEL HIGIÊNICO BRANCO, 30M, FOLHA DUPLA, PICOTADO', 'PCT', 'Higiene', 'Alta', 68, 8.273, true),
    I('1 50 02 0068 6', 'PASTA EM POLIONDA LARGA COM ELÁSTICO 245x335x55MM', 'UN', 'Papelaria', 'Baixa', 56, 3.0, true),
    I('1 50 02 0069 4', 'TESOURA ESCOLAR COM CABO DE PLÁSTICO', 'UN', 'Papelaria', 'Baixa', 23, 1.2, true),
    I('1 50 02 0054 6', 'CADERNO UNIVERSITÁRIO DE 01 MATÉRIA (80 FOLHAS)', 'UN', 'Papelaria', 'Alta', 11, 2.545),
    I('1 50 05 0088 4', 'ESSÊNCIA AROMATIZANTE 250ML LAVANDA', 'UN', 'Higiene', 'Alta', 12, 10.083),
    I('1 50 02 0030 9', 'CORRETIVO EM FITA', 'UN', 'Papelaria', 'Baixa', 10, 1.8),
    I('1 50 02 0031 7', 'BORRACHA BRANCA ESCOLAR', 'UN', 'Papelaria', 'Baixa', 7, 1.571),
    I('1 50 02 0034 1', 'CANETA MARCA TEXTO ROSA', 'UN', 'Papelaria', 'Baixa', 6, 1.333),
    I('1 50 05 0089 2', 'ESSÊNCIA AROMATIZANTE 250ML BAMBU', 'UN', 'Higiene', 'Alta', 11, 12.182),
    I('1 50 02 0018 0', 'PACOTE DE PAPEL A4 C/ 500 FOLHAS 75G', 'PCT', 'Papelaria', 'Alta', 40, 9.5, true)
  ],
  docs: [
    { key: 'RME 1270/2026', tipo: 'RME', numero: '1270/2026', data: '2026-10-01', arquivo: '1270.pdf', processadoEm: '2026-10-05T07:00:00', itens: [{ code: '1 50 05 0034 5', desc: 'PAPEL HIGIÊNICO BRANCO, 30M, FOLHA DUPLA, PICOTADO', qtd: 4, unit: 'PCT', aplicado: true }] },
    { key: 'BRM 610/2026', tipo: 'BRM', numero: '610/2026', data: '2026-10-02', arquivo: '610-2026 BRM.pdf', processadoEm: '2026-10-05T07:00:00', itens: [{ code: '1 50 02 0018 0', desc: 'PACOTE DE PAPEL A4 C/ 500 FOLHAS 75G', qtd: 20, unit: 'PCT', aplicado: true }] }
  ],
  movements: []
};
// Arquivos presentes na pasta (no protótipo, simulados; os 2 novos apontam para os PDFs reais anexados)
var DRIVE_FILES = [
  { name: '1270.pdf', modified: '2026-10-01T16:10:00', src: null },
  { name: '610-2026 BRM.pdf', modified: '2026-10-02T11:40:00', src: null },
  { name: '1282.pdf', modified: '2026-10-15T09:12:00', src: 'uploads/1282.pdf' },
  { name: '616-2026 BRM.pdf', modified: '2026-10-16T14:47:00', src: 'uploads/616-2026 BRM.pdf' }
];
var LOCAL = null; // compat: pasta única
var LOCALS = { RME: null, BRM: null }; // pastas separadas por tipo (não persistem ao recarregar)
function sourceFiles() {
  if (LOCALS.RME || LOCALS.BRM) return (LOCALS.RME ? LOCALS.RME.files : []).concat(LOCALS.BRM ? LOCALS.BRM.files : []);
  return LOCAL ? LOCAL.files : DRIVE_FILES;
}
function readBuffer(f) { return f.file ? f.file.arrayBuffer() : fetch(encodeURI(f.src)).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }); }
function load() { try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.items) return s; } catch (e) {} return JSON.parse(JSON.stringify(SEED)); }
var db = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} window.dispatchEvent(new CustomEvent('estoquechange')); }
function digits(c) { return String(c || '').replace(/\D/g, ''); }
function fmtCode2(c) { var d = digits(c); return d.length === 10 ? d[0] + ' ' + d.slice(1, 3) + ' ' + d.slice(3, 5) + ' ' + d.slice(5, 9) + ' ' + d[9] : String(c || '').trim(); }
function num(s) { return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0; }
function isoDate(br) { var m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(br || ''); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }
function find(code) { var d = digits(code); return db.items.find(function (i) { return digits(i.code) === d; }); }

// --- Leitura dos documentos (texto extraído do PDF) ---
// Descrição = texto antes das quantidades + continuação após a unidade, só se parecer descrição quebrada
// (sem minúsculas e curta). Observações da RME (texto corrido, com minúsculas) são descartadas.
function cleanDesc(before, after) {
  before = String(before || ''); var lc = before.search(/\s\S*[a-zà-ú]{2,}\S*\s+\S*[a-zà-ú]{2,}/); if (lc > 20) before = before.slice(0, lc);
  var tail = String(after || '').replace(/\s+/g, ' ').trim();
  var cut = tail.search(/\S*[a-zà-ú]/); if (cut >= 0) tail = tail.slice(0, cut).trim();
  if (tail.length > 80) tail = '';
  return (String(before || '') + ' ' + tail).replace(/\s+/g, ' ').trim();
}
function parseRME(text) {
  var flat = text.replace(/\t/g, ' ');
  var lines = flat.split('\n').map(function (l) { return l.trim(); });
  var nm = /(\d+\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/.exec(flat);
  var status = ((/Status\s+([^\n]+)/.exec(flat) || [])[1] || '').trim().split(/\s{2,}/)[0];
  var setor = '';
  var li = lines.findIndex(function (l) { return /REQUISICAO INTERNA/i.test(l); });
  if (li > 0) setor = lines[li - 1];
  // Região dos itens: entre "Status" e "Obs."; descarta rodapés/quebras de página. Itens podem ocupar várias linhas.
  var body = lines.filter(function (l) { return l && !/^(MER\d+|--\s*\d+ of \d+\s*--|Requisitante\b|Página\b)/i.test(l) && !/Página\s*:\s*\d+/i.test(l); });
  var start = body.findIndex(function (l) { return /^Status\b/i.test(l); });
  var end = -1; for (var k = body.length - 1; k > start; k--) { if (/^Obs\b/i.test(body[k])) { end = k; break; } }
  var region = body.slice(start >= 0 ? start + 1 : 0, end > 0 ? end : body.length).join(' ').replace(/\s+/g, ' ');
  var CODE = /(\d ?\d{2} ?\d{2} ?\d{4} ?\d|\d\.\d{2}\.\d{2}\.\d{4}\.\d)(?=\s)/g;
  var hits = [], m; while ((m = CODE.exec(region))) hits.push({ code: m[1], at: m.index, end: CODE.lastIndex });
  var itens = [], naoLidos = [];
  hits.forEach(function (h, i) {
    var seg = region.slice(h.end, i + 1 < hits.length ? hits[i + 1].at : region.length).trim();
    var q = /([\d.]*\d,\d{1,3})\s+([\d.]*\d,\d{1,3})\s+([\d.]*\d,\d{1,3})\s+([A-Za-zÀ-ú.]{1,8})/.exec(seg);
    var two = !q && /([\d.]*\d,\d{1,3})\s+([\d.]*\d,\d{1,3})\s+([A-Za-zÀ-ú.]{1,8})/.exec(seg);
    if (!q && !two) { naoLidos.push(fmtCode2(h.code)); return; }
    var mm = q || two, req = num(q ? q[2] : two[1]), at = num(q ? q[3] : two[2]), unit = (q ? q[4] : two[3]).toUpperCase().replace(/\.$/, '');
    var desc = cleanDesc(seg.slice(0, mm.index), seg.slice(mm.index + mm[0].length));
    itens.push({ code: fmtCode2(h.code), desc: desc, requisitada: req, atendida: at, qtd: at > 0 ? at : req, unit: unit });
  });
  return { tipo: 'RME', numero: nm ? nm[1] : '', data: nm ? isoDate(nm[2]) : '', status: status, setor: setor, itens: itens, naoLidos: naoLidos, codigosEncontrados: hits.length, valido: itens.length > 0 };
}
function parseBRM(text) {
  var lines = text.split('\n').map(function (l) { return l.replace(/\t/g, ' ').trim(); });
  var nm = /BRM:\s*(\d+\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/.exec(text);
  var forn = (/Fornecedor:\s*\d+\s*-\s*([^\n]+?)\s+S[ée]rie/.exec(text.replace(/\t/g, ' ')) || [])[1] || '';
  var nf = (/S[ée]rie:\s*(\d+)/.exec(text) || [])[1] || '';
  var itens = [];
  lines.forEach(function (l, i) {
    var m = /^(\d\.\d{2}\.\d{2}\.\d{4}\.\d)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([A-Z]{1,4})/.exec(l);
    if (!m) return;
    var desc = '';
    for (var k = i + 1; k < Math.min(lines.length, i + 4); k++) { if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 \-\/.,()]{4,}$/.test(lines[k]) && !/^Total/.test(lines[k])) { desc = lines[k]; break; } }
    itens.push({ code: fmtCode2(m[1]), desc: desc, qtd: num(m[2]), preco: num(m[3]), unit: m[5] });
  });
  return { tipo: 'BRM', numero: nm ? nm[1] : '', data: nm ? isoDate(nm[2]) : '', fornecedor: forn.trim(), notaFiscal: nf, itens: itens, valido: itens.length > 0 };
}
function parseText(text) {
  if (/Requisi[çc][ãa]o de Material em Estoque/i.test(text)) return parseRME(text);
  if (/BOLETIM DE RECEBIMENTO DE MATERIAL/i.test(text)) return parseBRM(text);
  return null;
}
var _pdf = null;
function pdfText(f) {
  return (_pdf || (_pdf = import(PDF_LIB).then(function (m) { m.PDFParse.setWorker(PDF_WORKER); return m.PDFParse; })))
    .then(function (P) { return readBuffer(f).then(function (b) { return new P({ data: new Uint8Array(b) }).getText(); }); })
    .then(function (r) { return r.text; });
}

// --- Rotina de sincronização ---
function sync(actor) {
  var started = new Date().toISOString().slice(0, 19);
  var known = new Set(db.docs.map(function (d) { return d.arquivo; }));
  var SRC = sourceFiles(); var novos = SRC.filter(function (f) { return !known.has(f.name); });
  var report = { started: started, encontrados: SRC.length, novos: novos.length, processados: [], ignorados: [], erros: [] };
  return novos.reduce(function (p, f) {
    return p.then(function () {
      if (!f.src && !f.file) { report.erros.push({ arquivo: f.name, motivo: 'Arquivo indisponível' }); return; }
      return pdfText(f).then(function (text) {
        var doc = parseText(text);
        if (!doc) { report.ignorados.push({ arquivo: f.name, motivo: 'Não é RME nem BRM' }); return; }
        var key = doc.tipo + ' ' + doc.numero;
        if (f.tipoPasta && doc.tipo !== f.tipoPasta) { report.ignorados.push({ arquivo: f.name, motivo: key + ' está na pasta de ' + f.tipoPasta + 's' }); return; }
        if (db.docs.some(function (d) { return d.key === key; })) { report.ignorados.push({ arquivo: f.name, motivo: key + ' já computado' }); return; }
        if (!doc.valido) { report.erros.push({ arquivo: f.name, motivo: key + (doc.codigosEncontrados ? ': ' + doc.codigosEncontrados + ' código(s) encontrado(s), mas nenhuma quantidade/unidade reconhecida — envie o PDF para ajuste da leitura' : ': nenhum código de material encontrado no texto do PDF (pode ser PDF escaneado/imagem)') }); return; }
        var sign = doc.tipo === 'RME' ? -1 : 1;
        doc.itens.forEach(function (it) {
          var item = find(it.code);
          it.aplicado = !!item;
          if (item) {
            it.antes = item.stock; item.stock = Math.round((item.stock + sign * it.qtd) * 1000) / 1000; it.depois = item.stock; it.code = item.code;
            db.movements.unshift({ ts: started, code: item.code, tipo: doc.tipo, doc: key, qtd: sign * it.qtd, saldo: item.stock });
          }
        });
        if (doc.naoLidos && doc.naoLidos.length) report.erros.push({ arquivo: f.name, motivo: key + ': ' + doc.naoLidos.length + ' item(ns) sem quantidade reconhecida (' + doc.naoLidos.join(', ') + ') — os demais foram computados' });
        var rec = Object.assign({ key: key, arquivo: f.name, processadoEm: started, por: actor || 'Rotina automática' }, doc);
        db.docs.unshift(rec); report.processados.push(rec);
      }).catch(function (e) { report.erros.push({ arquivo: f.name, motivo: 'Falha na leitura: ' + e.message }); });
    });
  }, Promise.resolve()).then(function () {
    db.lastSync = started; db.lastReport = report; save();
    if (window.DAAudit) window.DAAudit.log('Atualização de estoque', 'almoxarifado', report.processados.length + ' documento(s) computado(s): ' + (report.processados.map(function (d) { return d.key; }).join(', ') || 'nenhum novo'));
    return report;
  });
}

window.DAEstoque = {
  get: function () { return db; },
  isLocal: function () { return !!LOCAL || !!LOCALS.RME || !!LOCALS.BRM; },
  setLocalFolder: function (fileList) {
    var all = Array.prototype.slice.call(fileList || []);
    var pdfs = all.filter(function (f) { return /\.pdf$/i.test(f.name); });
    var rel = all[0] && all[0].webkitRelativePath ? all[0].webkitRelativePath.split('/')[0] : 'Pasta local';
    LOCAL = { name: rel, total: all.length, files: pdfs.sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR', { numeric: true }); }).map(function (f) { return { name: f.name, modified: new Date(f.lastModified).toISOString().slice(0, 19), file: f }; }) };
    window.dispatchEvent(new CustomEvent('estoquechange'));
    return { name: LOCAL.name, pdfs: pdfs.length, total: all.length };
  },
  clearLocalFolder: function (tipo) { if (tipo) LOCALS[tipo] = null; else { LOCAL = null; LOCALS = { RME: null, BRM: null }; } window.dispatchEvent(new CustomEvent('estoquechange')); },
  setTypedFolder: function (tipo, fileList) {
    var all = Array.prototype.slice.call(fileList || []);
    var pdfs = all.filter(function (f) { return /\.pdf$/i.test(f.name); });
    var rel = all[0] && all[0].webkitRelativePath ? all[0].webkitRelativePath.split('/')[0] : 'Pasta local';
    LOCALS[tipo] = { name: rel, total: all.length, files: pdfs.sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR', { numeric: true }); }).map(function (f) { return { name: f.name, modified: new Date(f.lastModified).toISOString().slice(0, 19), file: f, tipoPasta: tipo }; }) };
    window.dispatchEvent(new CustomEvent('estoquechange'));
    return { name: rel, pdfs: pdfs.length, total: all.length };
  },
  typedInfo: function (tipo) { var L = LOCALS[tipo]; return L ? { name: L.name, pdfs: L.files.length, total: L.total } : null; },
  clearComputed: function () {
    var done = new Set(db.docs.map(function (d) { return d.arquivo; }));
    var keep = function (f) { return !done.has(f.name); };
    ['RME', 'BRM'].forEach(function (t) { if (LOCALS[t]) LOCALS[t].files = LOCALS[t].files.filter(keep); });
    if (LOCAL) LOCAL.files = LOCAL.files.filter(keep);
    window.dispatchEvent(new CustomEvent('estoquechange'));
  },
  localInfo: function () { if (LOCAL) return { name: LOCAL.name, pdfs: LOCAL.files.length, total: LOCAL.total }; if (LOCALS.RME || LOCALS.BRM) { var n = sourceFiles().length; return { name: 'Pastas de RME e BRM', pdfs: n, total: (LOCALS.RME ? LOCALS.RME.total : 0) + (LOCALS.BRM ? LOCALS.BRM.total : 0) }; } return null; },
  driveFiles: function () { return sourceFiles().map(function (f) { return Object.assign({ computado: db.docs.some(function (d) { return d.arquivo === f.name; }) }, f); }); },
  find: find, digits: digits, fmtCode: fmtCode2, parseText: parseText, sync: sync,
  setFolder: function (folder) { db.folder = Object.assign({}, db.folder, folder); save(); },
  addItem: function (it) {
    if (find(it.code)) return { ok: false, error: 'Já existe um item com este código.' };
    var rec = I(fmtCode2(it.code), String(it.name).trim().toUpperCase(), it.unit || 'UN', it.category || 'Papelaria', it.priority || 'Baixa', +it.stock || 0, +it.avgConsumption || 0, false);
    db.items.push(rec);
    if (+it.stock) db.movements.unshift({ ts: new Date().toISOString().slice(0, 19), code: rec.code, tipo: 'Saldo inicial', doc: 'Cadastro', qtd: +it.stock, saldo: rec.stock });
    save();
    if (window.DAAudit) window.DAAudit.log('Material cadastrado', 'almoxarifado', rec.code + ' · ' + rec.name);
    return { ok: true, item: rec };
  },
  updateItem: function (code, patch) { var it = find(code); if (!it) return false; Object.assign(it, patch); save(); if (window.DAAudit) window.DAAudit.log('Material editado', 'almoxarifado', it.code + ' · ' + it.name); return true; },
  applyPending: function (docKey, code) {
    var doc = db.docs.find(function (d) { return d.key === docKey; }); if (!doc) return false;
    var it = doc.itens.find(function (x) { return digits(x.code) === digits(code) && !x.aplicado; }); var item = find(code); if (!it || !item) return false;
    var sign = doc.tipo === 'RME' ? -1 : 1; it.antes = item.stock; item.stock = Math.round((item.stock + sign * it.qtd) * 1000) / 1000; it.depois = item.stock; it.aplicado = true; it.code = item.code;
    db.movements.unshift({ ts: new Date().toISOString().slice(0, 19), code: item.code, tipo: doc.tipo, doc: doc.key, qtd: sign * it.qtd, saldo: item.stock }); save(); return true;
  },
  pending: function () { var out = []; db.docs.forEach(function (d) { d.itens.forEach(function (it) { if (!it.aplicado && !it.descartado) out.push({ doc: d.key, tipo: d.tipo, data: d.data, origem: d.tipo === 'RME' ? d.setor : d.fornecedor, code: it.code, desc: it.desc, qtd: it.qtd, unit: it.unit, preco: it.preco }); }); }); return out; },
  pendingGrouped: function () {
    var g = {};
    this.pending().forEach(function (p) { var k = digits(p.code); var x = g[k] || (g[k] = { code: fmtCode2(p.code), desc: '', unit: '', fonte: '', movs: [] });
      p = Object.assign({}, p, { desc: cleanDesc(p.desc, '') }); x.movs.push(p);
      if (p.tipo === 'BRM' && (!x.fonte || x.fonte === 'RME')) { x.desc = p.desc || x.desc; x.unit = p.unit || x.unit; x.preco = p.preco; x.fonte = 'BRM'; x.fonteDoc = p.doc; x.fornecedor = p.origem; }
      else if (!x.fonte) { x.desc = p.desc; x.unit = p.unit; x.fonte = 'RME'; x.fonteDoc = p.doc; } });
    return Object.keys(g).map(function (k) { var x = g[k]; x.saldoPrevisto = x.movs.reduce(function (a, m) { return a + (m.tipo === 'RME' ? -m.qtd : m.qtd); }, 0); return x; });
  },
  acceptPending: function (data, actor) {
    var r = this.addItem(Object.assign({}, data, { stock: 0 })); if (!r.ok) return r;
    var self = this, n = 0;
    db.docs.forEach(function (d) { d.itens.forEach(function (it) { if (!it.aplicado && !it.descartado && digits(it.code) === digits(data.code)) { if (self.applyPending(d.key, it.code)) n++; } }); });
    return { ok: true, item: r.item, aplicados: n };
  },
  discardPending: function (code, motivo, actor) {
    var n = 0; db.docs.forEach(function (d) { d.itens.forEach(function (it) { if (!it.aplicado && !it.descartado && digits(it.code) === digits(code)) { it.descartado = true; it.motivoDescarte = motivo || 'Recusado no cadastro'; n++; } }); });
    save(); if (window.DAAudit) window.DAAudit.log('Item novo recusado', 'almoxarifado', fmtCode2(code) + ' · ' + n + ' movimento(s) não computado(s)', 'warning'); return n;
  },
  lastMove: function (code) { var d = digits(code); return db.movements.find(function (m) { return digits(m.code) === d; }) || null; }
};
})();
