/**
 * Assinatura eletrônica do solicitante (Lei 14.063/2020, art. 4º, I — assinatura simples), compartilhada pelo
 * Controle de Chaves e pelo controle de saída de bandeiras. O conteúdo assinado (resumo) é montado pelo
 * servidor; o traço vem do quadro da tela do computador ou de um tablet pareado; o código de verificação é o
 * SHA-256 de resumo + traço + data/hora. Cada assinatura é usada uma única vez e precisa conferir com o registro.
 */
const crypto = require('crypto');
const db = require('../db');
const config = require('./config');
const K = require('./chaves');
const { badRequest, conflict, notFound, forbidden } = require('../lib/http');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const uuid = (v) => { if (!UUID.test(String(v))) throw badRequest('Identificador inválido.'); return String(v); };
const USO_APOS_ASSINAR_MIN = 30;

/**
 * Cria o pedido. Com `imagem`: já assinado no quadro da tela do computador.
 * Com `tabletId` (sem imagem): pendente — aparece sozinho no tablet pareado escolhido.
 */
async function criar(req, tipo, resumo, { imagem, tabletId } = {}) {
  const id = crypto.randomUUID();
  if (imagem !== undefined) {
    const err = K.imagemInvalida(imagem);
    if (err) throw badRequest(err);
    const quando = new Date().toISOString();
    await db.query(
      `INSERT INTO chaves_assinaturas (id, criada_por, tipo, resumo, status, dispositivo, imagem, hash, assinada_em, ip, user_agent, expira_em)
       VALUES ($1,$2,$3,$4,'assinada','tela',$5,$6,$7,$8,$9, NOW() + make_interval(mins => $10))`,
      [id, req.user.id, tipo, JSON.stringify(resumo), imagem, K.hashOf(resumo, imagem, quando), quando, req.ip, (req.get('User-Agent') || '').slice(0, 300), USO_APOS_ASSINAR_MIN]);
  } else {
    if (!tabletId) throw badRequest('Escolha o tablet que vai coletar a assinatura.');
    const { rows: t } = await db.query('SELECT id FROM chaves_tablets WHERE id = $1 AND ativo AND token_hash IS NOT NULL', [tabletId]);
    if (!t.length) throw badRequest('Tablet não encontrado ou não pareado.');
    // Um pedido por vez em cada tablet: o novo substitui o anterior
    await db.query("UPDATE chaves_assinaturas SET status = 'cancelada' WHERE tablet_id = $1 AND status = 'pendente'", [tabletId]);
    await db.query(
      'INSERT INTO chaves_assinaturas (id, criada_por, tipo, resumo, tablet_id, expira_em) VALUES ($1,$2,$3,$4,$5, NOW() + make_interval(mins => $6))',
      [id, req.user.id, tipo, JSON.stringify(resumo), tabletId, await config.get('chaves.assinaturaMin')]);
  }
  const { rows } = await db.query('SELECT * FROM chaves_assinaturas WHERE id = $1', [id]);
  return K.assinaturaOf(rows[0]);
}

/** Pedido do próprio usuário, restrito aos tipos do módulo que pergunta. */
async function minha(req, id, tipos) {
  const { rows } = await db.query('SELECT * FROM chaves_assinaturas WHERE id = $1', [uuid(id)]);
  if (!rows.length || (tipos && !tipos.includes(rows[0].tipo))) throw notFound('Pedido de assinatura não encontrado.');
  if (rows[0].criada_por !== req.user.id) throw forbidden('Este pedido de assinatura é de outro usuário.');
  return rows[0];
}
const situacao = (a) => K.assinaturaOf(a.status === 'pendente' && new Date(a.expira_em) < new Date() ? { ...a, status: 'expirada' } : a, true);
async function cancelar(a) { if (a.status === 'pendente') await db.query("UPDATE chaves_assinaturas SET status = 'cancelada' WHERE id = $1", [a.id]); }

/** Reserva a assinatura para um registro: do próprio usuário, assinada, do tipo certo, não usada e dentro do prazo. */
async function consumir(c, assinaturaId, userId, tipo, confere) {
  const { rows } = await c.query('SELECT * FROM chaves_assinaturas WHERE id = $1 FOR UPDATE', [uuid(assinaturaId)]);
  const a = rows[0];
  if (!a || a.criada_por !== userId || a.tipo !== tipo) throw badRequest('Assinatura inválida para este registro.');
  if (a.status !== 'assinada') throw badRequest('O solicitante ainda não assinou.');
  if (a.usada) throw conflict('Esta assinatura já foi usada.');
  if (new Date(a.expira_em) < new Date()) throw badRequest('A assinatura expirou. Colete a assinatura novamente.');
  if (!confere(a.resumo)) throw badRequest('A assinatura não corresponde aos dados informados. Colete a assinatura novamente.');
  await c.query('UPDATE chaves_assinaturas SET usada = TRUE WHERE id = $1', [a.id]);
  return a;
}

/** Tablets disponíveis para escolher onde assinar (sem dados sensíveis). */
async function tabletsPareados() {
  const T = require('./tablets');
  const { rows } = await db.query('SELECT * FROM chaves_tablets WHERE ativo AND token_hash IS NOT NULL ORDER BY nome, id');
  return rows.map(T.tabletOf).map(({ id, nome, pareado, online }) => ({ id, nome, pareado, online }));
}

/** O que o tablet mostra ao solicitante: título, campos e declaração (montados no servidor a partir do resumo). */
function exibicao(tipo, r) {
  const doc = (v) => (v ? ' · ' + v : '');
  switch (tipo) {
    case 'retirada': return { titulo: 'Retirada de chave', campos: [['Local', `${r.local} (${r.chave})`], ['Solicitante', r.solicitante + doc(r.solicitanteDoc)], ['Data da Retirada', r.data, 'datahora'], ['Responsável pela Entrega', r.responsavel]], declaracao: 'Declaro que recebi a chave acima e me responsabilizo por sua guarda até a devolução.' };
    case 'devolucao': return { titulo: 'Devolução de chave', campos: [['Local', `${r.local} (${r.chave})`], ['Quem devolve', r.devolvidoPor], ['Data da Devolução', r.data, 'datahora'], ['Responsável pelo Recebimento', r.responsavel]], declaracao: 'Declaro que devolvi a chave acima nesta data.' };
    case 'bandeira_retirada': return { titulo: 'Retirada de bandeiras', campos: [['Empresa / Entidade', r.entidade], ['Quem retira', r.retiradoPor + doc(r.retiradoDoc)], ['Itens', r.itens.join(', ')], ['Devolução prevista', r.devolucaoPrevista || 'não definida', 'data'], ['Data da Retirada', r.data, 'datahora'], ['Responsável pela Entrega', r.responsavel]], declaracao: 'Declaro que recebi os itens acima em perfeito estado e me responsabilizo por sua guarda e devolução até a data prevista.' };
    case 'bandeira_devolucao': return { titulo: 'Devolução de bandeiras', campos: [['Empresa / Entidade', r.entidade], ['Quem devolve', r.devolvidoPor], ['Itens', r.itens.join(', ')], ['Conferência', r.conformidade === 'Sim' ? 'Devolvidos em conformidade' : 'Com pendência: ' + (r.obs || '—')], ['Data da Devolução', r.data, 'datahora'], ['Responsável pelo Recebimento', r.responsavel]], declaracao: r.conformidade === 'Sim' ? 'Declaro que devolvi os itens acima nesta data.' : 'Declaro que devolvi os itens acima nesta data e estou ciente da pendência registrada.' };
    default: return { titulo: 'Assinatura', campos: [], declaracao: '' };
  }
}

module.exports = { criar, minha, situacao, cancelar, consumir, tabletsPareados, exibicao, uuid };
