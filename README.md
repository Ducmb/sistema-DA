# Sistema DA

Sistema web **mobile-first** da Diretoria Administrativa da Câmara Municipal: front-end React (`react-app/`) + API Node.js/Express com PostgreSQL (`backend/`), implementados a partir do protótipo navegável em `design/`.

## Como rodar (desenvolvimento)
```bash
# 1) API
cd backend && npm install && cp .env.example .env   # preencha DATABASE_URL e JWT_SECRET
npm run migrate && npm run seed && npm run dev       # http://localhost:3000
# 2) Front-end (outro terminal)
cd react-app && npm install && npm run dev           # http://localhost:5173
```
Ambiente de testes na Vercel: `VERCEL.md`. Revisão de segurança: `SEGURANCA.md`. Testes: `cd backend && npm test` (API, banco de teste real) e `cd react-app && npm test`. Detalhes de ambiente, segurança e e-mail/Drive em `backend/README.md`; contrato da API em `design/openapi.yaml` (gerado por `npm run openapi`).

> **Leia primeiro `INTEGRACAO.md`** — passo a passo para colocar o sistema em produção com o Claude Code.
> `CLAUDE.md` traz as regras que o Claude Code deve seguir. `HISTORICO.md` registra as decisões tomadas ao longo do protótipo.

## O que tem aqui

| Pasta / arquivo | O que é | Status |
|---|---|---|
| `design/*.dc.html` | **Protótipo de referência** (design hi-fi). Cada tela tem o HTML e uma `class Component` com estado, regras e dados de exemplo. | Fonte da verdade de layout, textos e regras |
| `design/*.js` | Lógica compartilhada do protótipo, em `localStorage` | Portada para `backend/src/services/` |
| `design/support.js` | Motor do protótipo | **Ignorar** — não vai para produção |
| `react-app/` | Front-end React + Vite + React Router | Todas as telas implementadas e ligadas à API |
| `backend/` | API Express + PostgreSQL: auth JWT + sessão, RBAC, auditoria, módulos | Todos os módulos implementados, com testes |
| `design/openapi.yaml` | Contrato da API | Gerado das rotas (`npm run openapi`); teste garante que está atualizado |

Para abrir o protótipo: `npx serve design` e abra `Index.dc.html` (hub de telas) ou `Login.dc.html`.

## Credenciais de teste (seed de desenvolvimento)
`admin/123456` · `operador/senha123` · `compras`, `almoxarifado`, `patrimonio`, `gerencia`, `visualizador` com senha `teste2026`.

## Telas

| Tela | Arquivo(s) | Pontos-chave |
|---|---|---|
| Login / Recuperar senha | `Login`, `ForgotPassword` | RF01–RF03, "Lembrar-me", modo claro/escuro salvo no dispositivo |
| Painel de Controle | `Dashboard` | Indicadores radiais, fluxo de processos, carga por subsetor e por agente, feed de alertas em tempo real (rotação, opacidade 40%→100%, stacking, auto-dismiss azul/verde), prazos críticos, exercício fiscal |
| Compras & Licitações | `ComprasModule` + `ComprasProcessos`, `ComprasContratos`, `ComprasDespesas`, `ComprasDotacao` | 24 etapas por processo (dispensa/inexigibilidade/licitação), SLA 5 dias úteis, "Refazer" com justificativa, sugestão de agente; contratos com avisos 120/60/30 dias, saldo < 20%, NF mensal; limites legais (Decreto 12.807/2025) por Classe CATMAT / Grupo CATSER + Verbinha; AUDESP, TCN; saldo de dotação; fornecedores multissegmento com ativar/inativar e exportação de e-mails |
| Almoxarifado | `AlmoxarifadoAmostragem` + `AlmoxEstoque`, `AlmoxInventario` | Escala semanal com responsável, contagem validada contra estoque, Base Completa (25/pág.), atualização de estoque por PDFs de RME/BRM com cadastro de itens novos |
| Patrimônio | `PatrimonioModule` | Transferências Pendente → Verificar → Realizado; termos de responsabilidade por centro de custo e mês |
| Protocolo | `ProtocoloModule` | Documentos, processos, prazos (atalho "+X dias"), calendário integrado com filtro por módulo |
| Moções & Homenagens | `MocoesHomenagens` + `HomenagensArranjos`, `HomenagensBandeiras` | Moções, galeria (cota por vereador), arranjos e placas, empréstimo de bandeiras com agendamento |
| Gestão de Pessoal | `RHModule`, `PessoalUsuarios` | Servidores, férias/licenças, usuários e permissões (vários perfis por usuário) |
| Legislações | `Legislacoes` | Normas com busca, ativar/inativar, PDF no modal |
| Analytics | `AnalyticsModule`, `AnalyticsConsolidado` | Indicadores consolidados |
| Log e Auditoria | `AuditLog` | Somente administrador |
| Configurações do Sistema | `Configuracoes` | Parâmetros por módulo, matriz perfis × módulos, centros de custo (padrão/patrimônio) |
| Meus Dados | `UserProfile` | Dados funcionais somente leitura, contato editável (LGPD), troca de senha |

Arquivos legados mantidos só como referência: `UserManagement` (substituído por `PessoalUsuarios`), `InventoryModule` (incorporado ao Almoxarifado). A Central de Notificações (`NotificationsModule`) foi implementada com os alertas reais dos módulos.

## Perfis de acesso
- **Administrativo:** tudo.
- **Compras:** Compras & Licitações, Moções & Homenagens.
- **Almoxarifado:** Almoxarifado, Moções & Homenagens.
- **Patrimônio:** Patrimônio.
- **Gerenciamento:** Protocolo.
- **Visualizador:** apenas Analytics e Perfil.
- Todos, exceto Visualizador: Painel, Perfil, Notificações, Legislações.
- Gestão de Pessoal, Log e Auditoria e Configurações: somente Administrativo.

## Design tokens
- **Cores:** Verde Câmara `#1C543A` (navegação, CTAs, foco) · hover `#153A2E` · Branco `#FFFFFF` · Preto Legislativo `#1D1D1B` · neutros `#E8E8E8` (bordas), `#F9F9F9` (fundos), `#CCCCCC` (disabled), `#666666` (texto secundário).
- **Semânticas:** atenção `#B45309` · crítico `#B91C1C` · informativo `#1E40AF`; badges com fundo claro da mesma cor.
- **Modo escuro** (`theme.js`): fundo `#111518`, superfícies `#1A1F23`/`#222A2F`, texto `#E8ECEA`, CTA `#2E7D55`, destaque e foco `#86D9A8`. Preferência por usuário.
- **Tipografia:** sans-serif do sistema nas telas operacionais; serifada (Georgia) em pré-visualização de documentos e atos normativos.
- **Forma:** raio 8px (cards/inputs), 12px (cards grandes), 999px (badges); bordas 1px; alvos de toque ≥ 44px; breakpoint mobile 900px.
- **Identidade:** colunas verticais (Palácio Legislativo) como barra de progresso e loading.
