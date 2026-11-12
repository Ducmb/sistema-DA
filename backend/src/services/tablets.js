/**
 * Tablets pareados do Controle de Chaves. O pareamento usa um código de uso único (15 min) mostrado no
 * computador; o tablet troca o código por um token de dispositivo aleatório, guardado no servidor só como hash.
 * O token só permite ver o pedido de assinatura enviado a esse tablet e assiná-lo — nada mais do sistema.
 */
const crypto = require('crypto');

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem 0/O, 1/I/L
const CODIGO_MIN = 15;
const ONLINE_MS = 15000;

const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const normCodigo = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function novoCodigo() {
  const bytes = crypto.randomBytes(8);
  const s = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
  return s.slice(0, 4) + '-' + s.slice(4);
}
const novoToken = () => 'tab_' + crypto.randomBytes(32).toString('base64url');

const tabletOf = (t) => ({
  id: t.id, nome: t.nome, pareado: !!t.token_hash, pareadoEm: t.pareado_em, ultimoContato: t.ultimo_contato,
  online: !!(t.token_hash && t.ultimo_contato && Date.now() - new Date(t.ultimo_contato).getTime() < ONLINE_MS),
  codigoExpira: !t.token_hash && t.codigo_hash && t.codigo_expira && new Date(t.codigo_expira) > new Date() ? t.codigo_expira : null
});

module.exports = { sha, normCodigo, novoCodigo, novoToken, tabletOf, CODIGO_MIN, ONLINE_MS };
