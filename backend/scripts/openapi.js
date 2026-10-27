/**
 * Gera design/openapi.yaml a partir das rotas registradas no Express e de scripts/openapi-docs.js.
 * Uso: npm run openapi   (o teste tests/openapi.test.js falha se alguma rota não estiver documentada)
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'gerador-openapi-'.repeat(4);
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/sistema_da';
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const app = require('../src/app');
const { listRoutes } = require('./routes');
const DOCS = require('./openapi-docs');

const TYPES = { s: { type: 'string' }, n: { type: 'number' }, i: { type: 'integer' }, b: { type: 'boolean' }, d: { type: 'string', format: 'date' }, a: { type: 'array', items: {} }, o: { type: 'object' }, f: { type: 'string', format: 'binary' } };
const TAGS = { auth: 'Autenticação', profile: 'Perfil', users: 'Usuários', audit: 'Auditoria', config: 'Configurações', 'cost-centers': 'Cadastros', vereadores: 'Cadastros', exercicio: 'Cadastros', painel: 'Painel', pessoal: 'Gestão de Pessoal', compras: 'Compras & Licitações', almoxarifado: 'Almoxarifado', patrimonio: 'Patrimônio', protocolo: 'Protocolo', mocoes: 'Moções & Homenagens', legislacoes: 'Legislações', notifications: 'Notificações', analytics: 'Analytics' };

function fieldsSchema(spec) {
  const properties = {}, required = [];
  spec.split(',').map((x) => x.trim()).filter(Boolean).forEach((f) => {
    const [n, t] = f.split(':'), name = n.replace('*', '');
    properties[name] = { ...(TYPES[t] || TYPES.s) };
    if (n.endsWith('*')) required.push(name);
  });
  return required.length ? { type: 'object', properties, required } : { type: 'object', properties };
}

function build() {
  const routes = listRoutes(app);
  const missing = routes.filter((r) => !DOCS[r]);
  if (missing.length) throw new Error('Rotas sem documentação em scripts/openapi-docs.js:\n' + missing.join('\n'));
  const paths = {};
  routes.forEach((r) => {
    const [method, p] = r.split(' '), d = DOCS[r];
    const seg = p.replace(/^\/api\//, '').split('/')[0];
    const op = { tags: [TAGS[seg] || 'Sistema'], summary: d.s };
    const desc = [];
    if (d.m) desc.push('Acesso: ' + (/^[a-z]/.test(d.m) ? 'módulo `' + d.m + '`' : 'perfil ' + d.m) + ' (403 sem permissão).');
    if (d.r) desc.push(d.r);
    if (desc.length) op.description = desc.join(' ');
    const params = [...p.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: /^(ym|tab|key|module)$/.test(m[1]) ? { type: 'string' } : m[1] === 'id' && seg === 'notifications' ? { type: 'string' } : { type: 'integer' } }));
    if (d.q) d.q.split(',').map((x) => x.trim()).forEach((q) => { const [n, t] = q.split(':'); params.push({ name: n, in: 'query', required: false, schema: TYPES[t] || TYPES.s }); });
    if (params.length) op.parameters = params;
    if (d.b) op.requestBody = { required: true, content: { 'application/json': { schema: fieldsSchema(d.b) } } };
    if (d.multipart) op.requestBody = { required: true, content: { 'multipart/form-data': { schema: fieldsSchema(d.multipart) } } };
    const ok = d.csv ? { description: 'Arquivo CSV (UTF-8 com BOM, separador ;)', content: { 'text/csv': { schema: { type: 'string' } } } }
      : d.pdf ? { description: 'Arquivo PDF', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } }
        : { description: 'Sucesso', content: { 'application/json': { schema: { type: 'object' } } } };
    op.responses = { [d.c === 201 ? '201' : '200']: ok, 400: { $ref: '#/components/responses/Erro' } };
    if (!d.pub) { op.responses[401] = { $ref: '#/components/responses/NaoAutenticado' }; op.responses[403] = { $ref: '#/components/responses/SemPermissao' }; }
    if (/\{/.test(p)) op.responses[404] = { $ref: '#/components/responses/Erro' };
    if (d.pub) op.security = [];
    (paths[p] = paths[p] || {})[method.toLowerCase()] = op;
  });
  const erro = (description) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } } });
  return {
    openapi: '3.0.3',
    info: {
      title: 'Sistema DA — Diretoria Administrativa da Câmara Municipal',
      version: require('../package.json').version,
      description: 'API do Sistema DA (Node.js/Express + PostgreSQL). Gerado por `npm run openapi` a partir das rotas registradas — não edite à mão.\n\n' +
        'Autenticação: `Authorization: Bearer <token>` obtido em `POST /api/auth/login`. A sessão expira por inatividade (Configurações › Geral). ' +
        'Toda autorização é validada no servidor: rota de módulo sem acesso devolve 403 e é registrada na auditoria. Erros 500 não expõem detalhes internos.'
    },
    servers: [{ url: 'http://localhost:3000', description: 'Desenvolvimento' }],
    security: [{ bearerAuth: [] }],
    tags: [...new Set(Object.values(TAGS))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: { Erro: { type: 'object', properties: { error: { type: 'string', description: 'Mensagem em português' }, fields: { type: 'object', description: 'Erros por campo (validação)' } }, required: ['error'] } },
      responses: { Erro: erro('Requisição inválida ou registro não encontrado'), NaoAutenticado: erro('Token ausente, inválido ou sessão expirada'), SemPermissao: erro('Sem permissão para o módulo ou a ação') }
    }
  };
}

if (require.main === module) {
  const out = path.join(__dirname, '..', '..', 'design', 'openapi.yaml');
  fs.writeFileSync(out, '# Gerado por backend/scripts/openapi.js (npm run openapi) — não edite à mão.\n' + yaml.dump(build(), { lineWidth: 140, noRefs: true }));
  console.log('OpenAPI atualizado: ' + path.relative(process.cwd(), out));
  process.exit(0);
}
module.exports = { build };
