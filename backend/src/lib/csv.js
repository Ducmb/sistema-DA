/** Envia CSV (separador ;, BOM UTF-8 para o Excel) com proteção contra injeção de fórmulas. */
function cell(c) {
  let v = String(c == null ? '' : c);
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return '"' + v.replace(/"/g, '""') + '"';
}

function csv(res, filename, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^\w.\-]/g, '_')}"`);
  res.send('﻿' + rows.map((r) => r.map(cell).join(';')).join('\n'));
}

module.exports = { csv, cell };
