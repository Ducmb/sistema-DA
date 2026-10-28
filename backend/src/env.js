/** Validação do ambiente compartilhada pelo servidor (server.js) e pela função da Vercel (api/index.js). */
function envError() {
  const s = process.env.JWT_SECRET || '';
  if (s.length < 32 || /change|secret|example|password|exemplo|senha/i.test(s)) return 'JWT_SECRET ausente ou fraco. Use ao menos 32 caracteres aleatórios (ex.: openssl rand -hex 32).';
  if (!process.env.DATABASE_URL) return 'DATABASE_URL não definido.';
  return null;
}

// Na Vercel só /tmp é gravável e a requisição chega por proxy
if (process.env.VERCEL) {
  process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/uploads';
  process.env.TRUST_PROXY = process.env.TRUST_PROXY || '1';
  process.env.DB_POOL_MAX = process.env.DB_POOL_MAX || '3';
}

module.exports = { envError };
