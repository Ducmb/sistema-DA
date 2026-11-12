/**
 * Controle de Chaves (modelo "Entrega e Recebimento de Chaves"): regras de assinatura eletrônica,
 * situação dos empréstimos e alertas de devolução atrasada.
 *
 * Assinatura eletrônica simples (Lei 14.063/2020, art. 4º, I): traço feito pelo solicitante na tela
 * (mesa digitalizadora/tablet de assinatura ligado ao computador) ou numa estação tablet, vinculado ao
 * conteúdo assinado por SHA-256, com data/hora, IP e dispositivo registrados.
 */
const crypto = require('crypto');
const db = require('../db');
const config = require('./config');

const PNG_PREFIX = 'data:image/png;base64,';
const MAX_PNG = 300 * 1024;

/** Valida o PNG da assinatura (data URL): assinatura do arquivo, tamanho e dimensões. Retorna mensagem de erro ou null. */
function imagemInvalida(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_PREFIX)) return 'Assinatura inválida.';
  const b64 = dataUrl.slice(PNG_PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return 'Assinatura inválida.';
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > MAX_PNG) return 'Assinatura muito grande.';
  if (buf.length < 100 || buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || buf.subarray(12, 16).toString('latin1') !== 'IHDR') return 'Assinatura inválida.';
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (w < 100 || h < 40 || w > 4000 || h > 2000) return 'Assinatura inválida.';
  return null;
}

/** Código de verificação: SHA-256 do conteúdo assinado + traço + data/hora. */
const hashOf = (resumo, imagem, quando) => crypto.createHash('sha256').update(JSON.stringify(resumo) + '|' + imagem + '|' + quando).digest('hex');

const assinaturaOf = (a, comImagem) => a && {
  id: a.id, tipo: a.tipo, status: a.status, resumo: a.resumo, dispositivo: a.dispositivo, assinadaEm: a.assinada_em,
  expiraEm: a.expira_em, codigo: a.hash ? a.hash.slice(0, 16).toUpperCase() : null, ...(comImagem ? { imagem: a.imagem, hash: a.hash, ip: a.ip } : {})
};

/** Prazo de devolução e atraso de um empréstimo em aberto. */
async function situacao(e, cfg) {
  const get = cfg || (await config.snapshot());
  const prazo = new Date(new Date(e.retirada_em).getTime() + get('chaves.prazoHoras') * 3600e3);
  const aberto = !e.devolucao_em;
  return { prazo, aberto, atrasado: aberto && Date.now() > prazo.getTime() };
}

const emprestimoOf = (e, s) => ({
  id: e.id, chaveId: e.chave_id, chaveCodigo: e.chave_codigo, local: e.local, solicitante: e.solicitante, solicitanteDoc: e.solicitante_doc,
  retiradaEm: e.retirada_em, entreguePor: e.entregue_nome, devolucaoEm: e.devolucao_em, devolvidoPor: e.devolvido_por || '',
  recebidoPor: e.recebido_nome || '', observacao: e.observacao, prazo: s.prazo, atrasado: s.atrasado,
  situacao: e.devolucao_em ? 'Devolvida' : s.atrasado ? 'Atrasada' : 'Em uso'
});

const SELECT_EMP = `SELECT e.*, c.codigo AS chave_codigo, ue.name AS entregue_nome, ur.name AS recebido_nome
  FROM chaves_emprestimos e JOIN chaves c ON c.id = e.chave_id
  JOIN users ue ON ue.id = e.entregue_por LEFT JOIN users ur ON ur.id = e.recebido_por`;

async function emprestimos(where = '', params = []) {
  const cfg = await config.snapshot();
  const { rows } = await db.query(`${SELECT_EMP} ${where} ORDER BY (e.devolucao_em IS NULL) DESC, e.retirada_em DESC, e.id DESC`, params);
  return Promise.all(rows.map(async (e) => emprestimoOf(e, await situacao(e, cfg))));
}

/** Alertas: chaves não devolvidas no prazo (Painel e Central de Notificações). */
async function alerts() {
  const cfg = await config.snapshot();
  if (!cfg('chaves.alertaAtraso')) return [];
  const abertas = await emprestimos('WHERE e.devolucao_em IS NULL');
  return abertas.filter((e) => e.atrasado).map((e) => {
    const horas = Math.round((Date.now() - new Date(e.retiradaEm).getTime()) / 3600e3);
    return {
      id: 'chave-atraso-' + e.id, module: 'chaves', category: 'CHAVES', level: horas >= 2 * cfg('chaves.prazoHoras') ? 'critical' : 'warning',
      title: `Chave não devolvida — ${e.local} (${e.chaveCodigo})`,
      description: `Com ${e.solicitante} há ${horas >= 48 ? Math.floor(horas / 24) + ' dia(s)' : horas + ' h'}`, href: '/chaves?emprestimo=' + e.id
    };
  });
}

module.exports = { imagemInvalida, hashOf, assinaturaOf, situacao, emprestimos, emprestimoOf, SELECT_EMP, alerts };
