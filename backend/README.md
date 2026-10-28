# Sistema DA — API (Node.js + Express + PostgreSQL)

API do Sistema DA. As regras de negócio que no protótipo ficavam em `localStorage` (`design/*.js`) estão portadas para `src/services/`; o front-end só exibe.

## Requisitos
- Node.js 20+ (testado com 22)
- PostgreSQL 14+ (testado com 16)

## Configuração
```bash
npm install
cp .env.example .env      # preencha DATABASE_URL e JWT_SECRET (openssl rand -hex 32)
npm run migrate           # aplica src/db/migrations/*.sql (versionadas em schema_migrations)
npm run seed              # dados de exemplo do protótipo (bloqueado em NODE_ENV=production)
npm run dev               # http://localhost:3000
```
`npm run seed -- --reset` limpa todas as tabelas antes de semear (somente fora de produção).

O servidor **não inicia** sem `JWT_SECRET` forte (≥ 32 caracteres, sem palavras óbvias) e sem `DATABASE_URL`.

### Variáveis de ambiente
| Variável | Uso |
|---|---|
| `DATABASE_URL` / `TEST_DATABASE_URL` | Banco principal / banco recriado a cada `npm test` |
| `JWT_SECRET`, `JWT_EXPIRY` | Assinatura e validade do token (a sessão também expira por inatividade — Configurações › Geral) |
| `APP_URL`, `CORS_ORIGIN` | Links de convite/redefinição e origens permitidas |
| `TRUST_PROXY` | Atrás de proxy reverso com HTTPS |
| `SMTP_*` | E-mail institucional. Sem SMTP fora de produção, as mensagens saem no console |
| `GOOGLE_APPLICATION_CREDENTIALS`, `DRIVE_FOLDER_ID_RME`, `DRIVE_FOLDER_ID_BRM` | Leitura automática das pastas de RME/BRM no Google Drive (conta de serviço somente leitura). Sem elas, use o envio de PDFs pela tela |
| `UPLOAD_DIR` | Pasta dos PDFs de Legislações (nomes aleatórios, servidos só a usuários autenticados) |

## Credenciais de exemplo (seed)
`admin/123456` (Administrativo) · `operador/senha123` (Almoxarifado, chefia) · `compras`, `almoxarifado`, `patrimonio`, `gerencia`, `visualizador` com senha `teste2026`. Agentes de contratação: `marina.duarte`, `paulo.reis`, `silvia.prado`, `otavio.lemos` (`teste2026`).
**Troque todas antes de qualquer uso real** — o seed não roda em produção.

### Primeiro administrador em produção
```bash
npm run create-admin -- --nome "Nome completo" --email nome@camara.sp.gov.br --matricula 0000 [--cargo "Cargo"]
```
Não recebe senha: imprime um link de convite de uso único (72 h) para a pessoa definir a própria senha. Recusa se já existir administrador ativo.

## Estrutura
```
src/
  app.js              Express: helmet, CORS, JSON, rotas, 404 e erro (500 sem detalhes)
  server.js           validação do ambiente, listen e rotinas agendadas
  middleware/auth.js  JWT + sessão no servidor (inatividade), requireModule(...), requireAdmin
  routes/             uma rota por módulo; modules.js monta cada uma com requireModule
  services/           regras: access (RBAC), audit, config (esquema de Configurações), compras, estoque,
                      patrimonio, protocolo, mocoes, feed (calendário/prazos/alertas), notifications…
  jobs/               node-cron: limpeza da auditoria, catálogo CATMAT/CATSER, Drive RME/BRM, resumo diário de notificações
  db/migrations/      SQL versionado; db/seeds/ dados de exemplo
scripts/              gerador do OpenAPI (npm run openapi)
tests/                Jest + Supertest contra banco real (TEST_DATABASE_URL), "hoje" fixo em 27/10/2026
```

## Segurança (RNF01–RNF04)
- Autorização sempre no servidor: cada módulo exige o próprio acesso (403 + registro "Acesso negado" na auditoria). Perfis múltiplos por usuário, matriz perfil × módulo editável e exceções por usuário.
- Senhas com bcrypt e regras configuráveis (mínimo 8). Bloqueio por tentativas. Token de redefinição/convite aleatório, uso único, 30 min, salvo como hash.
- JWT com expiração + sessão no banco (logout revoga; inatividade encerra). Troca de senha invalida as demais sessões.
- Alterações de permissão/configuração e leituras de dados pessoais (servidores, usuários, empréstimos de bandeiras com CPF/telefone) vão para a auditoria.
- Nome, matrícula, cargo e e-mail institucional não podem ser alterados pelo próprio usuário (403).
- Exportações CSV com proteção contra injeção de fórmulas; uploads validados pelo conteúdo (%PDF-).
- Log de auditoria somente de inclusão (gatilho no banco). Em produção, dê ao usuário da aplicação apenas `INSERT/SELECT/DELETE` em `audit_logs` e nenhum privilégio de DDL.

Revisão de segurança completa, com achados e recomendações de publicação: [`../SEGURANCA.md`](../SEGURANCA.md).

## API
O contrato completo está em [`../design/openapi.yaml`](../design/openapi.yaml), **gerado** a partir das rotas registradas:
```bash
npm run openapi
```
Ao criar ou mudar uma rota, documente-a em `scripts/openapi-docs.js` e rode o comando — `tests/openapi.test.js` falha se houver rota sem documentação ou se o YAML estiver desatualizado.

## Testes
```bash
npm test     # recria o banco de TEST_DATABASE_URL, migra, semeia e roda todas as suítes
```
