# Passo a passo — integração com o Claude Code

## Antes de começar
Você vai precisar de:
- **Node.js 18+** e **npm 9+**
- **PostgreSQL 14+** (local ou na nuvem)
- **Git** e, de preferência, uma conta no GitHub
- **Claude Code**: `npm install -g @anthropic-ai/claude-code`, depois rode `claude` no terminal e entre com sua conta

---

## Etapa 1 — Montar o repositório

1. Baixe e descompacte o pacote `design_handoff_sistema_da`.
2. Crie a pasta do projeto e organize assim:
   ```
   sistema-da/
   ├── CLAUDE.md         ← da pasta de handoff para a raiz
   ├── README.md         ← idem
   ├── INTEGRACAO.md     ← este arquivo
   ├── HISTORICO.md      ← idem
   ├── design/           ← todos os *.dc.html, *.js e openapi.yaml
   ├── backend/
   └── react-app/
   ```
3. No terminal, dentro de `sistema-da/`:
   ```
   git init
   git add .
   git commit -m "Handoff do protótipo Sistema DA"
   ```

## Etapa 2 — Conferir que tudo abre

1. **Protótipo:** `npx serve design` e abra `http://localhost:3000/Index.dc.html`. Deixe aberto como referência.
2. **Banco:** crie o banco `sistema_da` no PostgreSQL.
3. **Back-end:**
   ```
   cd backend
   npm install
   cp .env.example .env
   ```
   Preencha `DATABASE_URL` e gere o `JWT_SECRET` com `openssl rand -hex 32`. Depois:
   ```
   npm run migrate
   npm run dev
   ```
4. **Front-end:** em outro terminal, `cd react-app && npm install && npm run dev`.

## Etapa 3 — Abrir o Claude Code

Na raiz `sistema-da/`, rode `claude`. Ele lê o `CLAUDE.md` sozinho.

Primeiro pedido, só de leitura:
> Leia CLAUDE.md, README.md e INTEGRACAO.md. Liste as telas do protótipo em design/ e compare com o que já existe em react-app/ e backend/. Não altere nada ainda: me entregue um plano de implementação por módulo, na ordem da Etapa 4.

Revise o plano e só então aprove.

## Etapa 4 — Implementar por fases

Uma fase por vez. Ao fim de cada uma: rode os testes, compare a tela com o protótipo lado a lado e faça commit.

| Fase | Pedido ao Claude Code | Referência em design/ |
|---|---|---|
| **1. Base e segurança** | "Implemente a autenticação completa no back-end e no React: login, logout, sessão com expiração por inatividade, recuperação de senha por e-mail, troca de senha, limite de tentativas e guarda de rotas por perfil no servidor e no front. Siga as regras de segurança do CLAUDE.md." | `Login`, `ForgotPassword`, `UserProfile`, `session.js`, `backend/src/middleware/auth.js` |
| **2. Perfis, usuários e auditoria** | "Implemente RBAC com os 6 perfis do README, vários perfis por usuário, permissões individuais por módulo com salvamento imediato, e a tela de Log e Auditoria." | `PessoalUsuarios`, `AuditLog`, `config.js` |
| **3. Configurações e cadastros base** | "Implemente Configurações do Sistema com parâmetros por módulo salvos no banco, matriz perfis × módulos, centros de custo (padrão/patrimônio) com busca e arquivamento, exercício fiscal e cadastro de vereadores." | `Configuracoes`, `config.js`, `sectors.js`, `exercicio.js`, `vereadores.js` |
| **4. Layout e Painel** | "Crie o layout (menu lateral por categorias em ordem alfabética, drawer no mobile, cabeçalho com busca global, modo claro/escuro por usuário) e o Painel de Controle com todos os widgets, o feed de alertas e as animações." | `Dashboard`, `theme.js`, `calendar-feed.js` |
| **5. Compras & Licitações** | "Implemente Compras: controle de processos (24 etapas), contratos, despesas e limites legais, dotação e fornecedores." | `ComprasModule` e 4 subtelas, `liccont.js` |
| **6. Almoxarifado** | "Implemente o Almoxarifado, incluindo a rotina de leitura dos PDFs de RME/BRM." | `AlmoxarifadoAmostragem`, `AlmoxEstoque`, `AlmoxInventario`, `estoque.js`, `backend/src/jobs/estoqueSync.js`, `backend/src/services/estoqueParser.js` |
| **7. Patrimônio e Protocolo** | "Implemente Patrimônio (transferências e termos) e Protocolo (documentos, processos, prazos e calendário integrado alimentado por todos os módulos)." | `PatrimonioModule`, `ProtocoloModule`, `calendar-feed.js` |
| **8. Demais módulos** | Moções & Homenagens, Gestão de Pessoal, Legislações, Analytics e Notificações — uma tela por pedido. | arquivos correspondentes |

Modelo de pedido para cada tela:
> Implemente a tela X no react-app reproduzindo design/X.dc.html: mesmo layout, textos, estados (vazio, carregando com skeleton, erro), validações e comportamento no celular. Porte as regras da class Component e de design/Y.js para rotas no back-end, com validação, permissão e auditoria. Atualize o openapi.yaml e escreva testes.

## Etapa 5 — Integrações externas

Peça uma de cada vez; todas precisam de credenciais, que ficam no `.env` e nunca no código.
1. **E-mail** (recuperação de senha, notificações): configurar o SMTP em `backend/src/services/mailer.js`.
2. **Google Drive** (PDFs de RME/BRM): no protótipo a pasta é escolhida no computador; em produção, usar uma conta de serviço do Google com leitura da pasta.
3. **Catálogo compras.gov.br** (CATMAT, CATSER, classe, grupo, PDM): sincronizar pela API pública do governo federal em rotina agendada.
4. **Limites legais:** os valores do Decreto nº 12.807/2025 já são o padrão em Configurações; prever atualização anual.

## Etapa 6 — Migração dos dados reais

1. Os dados do protótipo são **amostras** (cerca de 10 por planilha, agentes com nomes fictícios).
2. Peça um script de importação da planilha "CONTROLE GERAL LICCONT" e das bases do almoxarifado para o banco.
3. Rode primeiro em homologação e confira os totais com a planilha original.

## Etapa 7 — Homologação e publicação

1. Peça: "Revise o projeto inteiro contra as regras de segurança do CLAUDE.md e liste as falhas antes de corrigir."
2. Teste com um usuário de cada perfil. Cada um deve ver só o que lhe cabe, e chamadas diretas à API para módulos não permitidos devem retornar 403.
3. Teste no celular: menu em drawer, tabelas roláveis, formulários usáveis.
4. Publique primeiro em homologação, com HTTPS.
5. Configure backup do banco e confirme a retenção da auditoria (padrão: 5 anos).

## Pendências conhecidas
- `backend/package.json` tem o comando `seed`, mas `src/db/seed.js` ainda não existe. Peça ao Claude Code para criá-lo com usuários de teste.
- O back-end ainda não tem rotas de Moções, Patrimônio, Legislações, Configurações, Contratos, Despesas e Almoxarifado; elas surgem nas fases 3 a 8.
- No React, os módulos além de Login, Painel, Usuários e Perfil são simplificados; refazer a partir do protótipo.
- O feed de alertas e o calendário dependem de regras hoje no navegador (`liccont.js`, `calendar-feed.js`); devem migrar para o servidor, de preferência com atualização em tempo real (WebSocket ou SSE).
