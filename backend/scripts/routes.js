/** Lista as rotas registradas no Express ("MÉTODO /caminho"), percorrendo os sub-roteadores. */
function prefixOf(layer) {
  const m = layer.regexp && layer.regexp.source.match(/^\^\\\/(.*?)\\\/\?\(\?=\\\/\|\$\)/);
  return m ? '/' + m[1].replace(/\\\//g, '/') : '';
}
function listRoutes(app) {
  const out = [];
  (function walk(stack, prefix) {
    stack.forEach((l) => {
      if (l.route) Object.keys(l.route.methods).forEach((m) => out.push(m.toUpperCase() + ' ' + (prefix + l.route.path).replace(/:(\w+)/g, '{$1}')));
      else if (l.name === 'router' && l.handle.stack) walk(l.handle.stack, prefix + prefixOf(l));
    });
  })(app._router.stack, '');
  return out;
}
module.exports = { listRoutes };
