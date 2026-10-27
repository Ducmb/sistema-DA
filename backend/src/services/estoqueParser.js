// Leitura de RME (Requisição de Material em Estoque) e BRM (Boletim de Recebimento de Material) a partir do texto do PDF.
// Mesma lógica usada no protótipo (estoque.js). Ajustar as expressões se o layout do sistema de origem mudar.
function digits(c) { return String(c || '').replace(/\D/g, ''); }
function fmtCode2(c) { var d = digits(c); return d.length === 10 ? d[0] + ' ' + d.slice(1, 3) + ' ' + d.slice(3, 5) + ' ' + d.slice(5, 9) + ' ' + d[9] : String(c || '').trim(); }
function num(s) { return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0; }
function isoDate(br) { var m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(br || ''); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }
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
module.exports = { parseText, parseRME, parseBRM };
