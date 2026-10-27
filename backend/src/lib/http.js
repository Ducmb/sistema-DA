/** Erro com status HTTP e mensagem segura para o cliente. */
class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.expose = true;
    if (extra) this.extra = extra;
  }
}

const badRequest = (msg, extra) => new HttpError(400, msg, extra);
const notFound = (msg = 'Registro não encontrado.') => new HttpError(404, msg);
const forbidden = (msg = 'Acesso negado.') => new HttpError(403, msg);
const conflict = (msg) => new HttpError(409, msg);

/** Envolve handlers async para encaminhar erros ao middleware de erro. */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Valida req[source] com um schema zod e devolve os dados limpos.
 * Mensagens de erro em português, campo a campo.
 */
function parse(schema, data) {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const fields = {};
  r.error.issues.forEach((i) => { const k = i.path.join('.') || '_'; if (!fields[k]) fields[k] = i.message; });
  const first = Object.values(fields)[0];
  throw badRequest(first || 'Dados inválidos.', { fields });
}

/** Converte parâmetro de rota numérico; 400 se inválido. */
function idParam(v) {
  if (!/^[1-9]\d{0,9}$/.test(String(v))) throw badRequest('Identificador inválido.');
  return +v;
}

module.exports = { HttpError, badRequest, notFound, forbidden, conflict, ah, parse, idParam };
