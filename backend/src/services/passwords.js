const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('./config');

const ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

const hash = (p) => bcrypt.hash(p, ROUNDS);
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('hex');
// Hash inválido para contas ainda sem senha definida (convite pendente) e comparação de tempo constante
const UNUSABLE = '!' + crypto.randomBytes(16).toString('hex');
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', ROUNDS);
const BCRYPT = /^\$2[aby]\$\d{2}\$/;
/** Compara a senha; hash inutilizável (convite pendente) ou ausente leva o mesmo tempo de um hash real. */
async function compare(p, h) {
  if (!BCRYPT.test(h || '')) { await bcrypt.compare(String(p || ''), DUMMY_HASH); return false; }
  return bcrypt.compare(String(p || ''), h);
}

/** Regras de senha conforme Configurações › Geral › Senhas. Retorna lista de { label, ok }. */
async function rules(p) {
  const min = Math.max(8, +(await config.get('geral.senhaMin')));
  const complex = (await config.get('geral.senhaComplexa')) !== false;
  const r = [{ label: min + '+ caracteres', ok: String(p).length >= min }];
  if (complex) {
    r.push({ label: 'Letra maiúscula', ok: /[A-Z]/.test(p) }, { label: 'Letra minúscula', ok: /[a-z]/.test(p) }, { label: 'Número', ok: /\d/.test(p) }, { label: 'Símbolo', ok: /[^A-Za-z0-9]/.test(p) });
  }
  return r;
}

async function validate(p) {
  if (typeof p !== 'string' || p.length > 128) return 'Senha inválida.';
  const failed = (await rules(p)).filter((r) => !r.ok);
  return failed.length ? 'A senha não atende aos requisitos: ' + failed.map((r) => r.label.toLowerCase()).join(', ') + '.' : null;
}

module.exports = { hash, compare, sha256, randomToken, rules, validate, UNUSABLE, DUMMY_HASH };
