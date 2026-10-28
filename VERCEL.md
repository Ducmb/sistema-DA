# Ambiente de testes na Vercel

Um único projeto Vercel a partir da raiz do repositório:
- **front-end** (`react-app/dist`) como site estático;
- **API** Express como função serverless em `/api` (`api/index.js`);
- **banco** PostgreSQL gerenciado (Neon, pelo Marketplace da Vercel).

A cada deploy o build roda as migrações e, se `DEMO_SEED=true` e o banco estiver vazio, carrega os dados de exemplo do protótipo. Deploys seguintes **preservam** os dados.

## Passo a passo
1. Entre em https://vercel.com com a conta do GitHub.
2. **Add New → Project** e importe `Ducmb/sistema-DA`. Deixe *Framework Preset* em **Other** e *Root Directory* em `./`. O `vercel.json` já define instalação, build e rotas.
3. Ainda na tela de importação, abra **Environment Variables** e cadastre:

   | Nome | Valor |
   |---|---|
   | `JWT_SECRET` | 64 caracteres aleatórios (`openssl rand -hex 32`) |
   | `DEMO_SEED` | `true` |
   | `DEMO_PASSWORD` | senha de 12+ caracteres para **todos** os usuários de exemplo |

4. Clique em **Deploy**. O primeiro build **falha na etapa de migração** porque ainda não há banco — é esperado.
5. No projeto: **Storage → Create Database → Neon (Serverless Postgres)** → crie (região São Paulo, se disponível) e **Connect** ao projeto. Isso cria `DATABASE_URL` automaticamente.
6. **Deployments → ⋯ no último deploy → Redeploy.** Ao terminar, abra o endereço `https://<projeto>.vercel.app`.

## Como entrar
Usuários do seed — todos com a senha definida em `DEMO_PASSWORD`:
`admin` (Administrativo), `operador` (Almoxarifado, chefia), `compras`, `almoxarifado`, `patrimonio`, `gerencia`, `visualizador`, e os agentes de contratação `marina.duarte`, `paulo.reis`, `silvia.prado`, `otavio.lemos`.

As senhas padrão publicadas no README (`123456` etc.) **não** funcionam na Vercel.

## Proteção do endereço
O endereço `.vercel.app` é público. Para restringir aos testadores: **Settings → Deployment Protection → Vercel Authentication** (a proteção de deploys de prévia já vem ligada; proteger o domínio de produção exige plano pago) ou compartilhe só os links de prévia.

## Recomeçar os dados de teste
Para voltar aos dados de exemplo: no Neon, apague e recrie o banco (ou crie um *branch* vazio) e faça **Redeploy**.

## Limitações do ambiente de testes
- **Rotinas agendadas não rodam** (node-cron): limpeza da auditoria, sincronização diária do catálogo, leitura periódica do Google Drive e resumo diário de notificações. Os botões manuais (sincronizar catálogo/Drive) funcionam.
- **Arquivos enviados não são permanentes:** os PDFs de Legislações ficam em `/tmp` da função e podem sumir entre acessos. Para produção, use disco persistente ou armazenamento de objetos.
- **Limite de 4,5 MB por requisição:** o envio de RME/BRM é dividido em lotes automaticamente, mas um único PDF maior que isso (ou PDF de Legislação grande) é recusado.
- **E-mail:** sem `SMTP_*`, convites e recuperação de senha não são enviados (os usuários de exemplo já têm senha).
- O limite de tentativas de login é por instância da função.

Para produção definitiva, siga `backend/README.md` e as recomendações do `SEGURANCA.md`.
