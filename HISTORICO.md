# Handoff: Sistema DA — Diretoria Administrativa (Câmara Municipal)

## Overview
Protótipo completo de um sistema web **mobile-first** para automatizar a rotina da Diretoria Administrativa de uma Câmara Municipal: autenticação, dashboard gerencial com alertas em tempo real, gestão de usuários/permissões (RBAC), perfil do servidor e módulos setoriais (Moções & Homenagens, Almoxarifado com amostragem, Patrimônio, Compras, Protocolo, RH, Inventário, Notificações, Analytics).

## About the Design Files
Os arquivos `.dc.html` deste pacote são **referências de design criadas em HTML** — protótipos que demonstram aparência e comportamento pretendidos, **não código de produção**. A tarefa é **recriar estas telas no ambiente do codebase de destino** (React/Next.js recomendado, dado o scaffold Node.js já especificado) usando seus padrões e bibliotecas. Se não houver codebase, sugere-se React + Tailwind (front) e Node.js + PostgreSQL (back — ver `backend/` e `openapi.yaml`).

Cada arquivo contém um template HTML (dentro de `<x-dc>`) e uma classe de lógica JS (`class Component`) com estado, handlers e dados mock — leia ambos para entender estrutura e comportamento. Ignore `support.js` (runtime do protótipo).

## Fidelity
**High-fidelity (hifi)**: cores, tipografia, espaçamentos e interações são finais. Recriar com fidelidade de pixel usando os componentes do codebase de destino.

## Design Tokens
Cores (uso estrito, do documento de requisitos):
- `#1C543A` Verde Câmara — navegação estrutural, ações primárias, foco de inputs, badges de sucesso
- `#164530` — hover/variação escura do verde (único tom de hover)
- `#FFFFFF` Branco Institucional — fundos de tela e cards
- `#1D1D1B` Preto Legislativo — textos, labels, dados de tabelas
- Neutros (Prata Transparência) — escala única: `#F9F9F9` fundo de input/hover, `#F5F5F5` fundo secundário, `#F0F0F0` divisórias, `#EEEEEE` trilhas/avatares neutros, `#E8E8E8` bordas de cards, `#E0E0E0` bordas de inputs, `#D9D9D9` switch desligado, `#CCCCCC` disabled, `#999999`/`#666666` texto secundário
- Semânticas: `#F59E0B`/`#F0B429` atenção, `#DC2626` crítico, `#3B82F6` informativo
- Badges de status: cor semântica com fundo a 13% de opacidade (sufixo hex `22`)

Tipografia:
- Operacional: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (painéis, formulários, menus)
- Documentos: fonte serifada (Georgia/similar) para pré-visualização de atos normativos e relatórios oficiais
- Escala: títulos de página 18px/600, títulos de seção 15–16px/600, corpo 13px, labels/meta 11–12px, uppercase de 10px com letter-spacing 0.4px para categorias

Outros: raio 8px (cards), 6px (botões/inputs), 4px (badges); bordas 1px `#E8E8E8`; sombras discretas `0 2px 8px rgba(0,0,0,0.1)`.

## Screens / Views

### Tela 01 — Login (`Login.dc.html`)
Card centrado em fundo branco; logotipo institucional; campos usuário/senha com borda cinza → verde no foco; toggle mostrar/ocultar senha; checkbox "Lembrar-me"; link "Esqueci minha senha"; botão "Entrar" verde. Credenciais mock: `admin/123456`, `operador/senha123`. Requisitos RF01–RF03, RNF01 (bcrypt/Argon2, HTTPS).

### Tela 02 — Dashboard (`Dashboard.dc.html`)
Sidebar verde (drawer no mobile, hambúrguer no topo); seletor de papel (Administrativo/Vereador/Operacional/Visualizador) que filtra seções e navegação; indicadores radiais (Concluídos, Em Andamento, Aguardando Assinatura); gráfico de área "Fluxo de Processos" (degradê verde); barras por subsetor; calendário de prazos; timeline de metas (Autuação → Análise → Parecer → Arquivamento); feed lateral de alertas estilo glassmorphism com opacidade 40% em repouso → 100% no hover, stacking de atualizações (+N), auto-dismiss 5s para azul/verde, persistência para amarelo/vermelho; tabela de auditoria com exportação CSV. Animações: staggered fade-in (15px, delay 150ms), desenho SVG 1.2s ease-out, apenas transform/opacity (RNF02).

### Tela 03 — Gestão de Usuários (`UserManagement.dc.html` + `UserManagement-print.dc.html`)
Lista de servidores (cards expansíveis no mobile); badges de papel (Administrador verde / Usuário cinza); filtros por papel + busca; drawer lateral de edição com toggle switches por módulo (salvamento instantâneo via toast "Salvo com sucesso"); modal "Novo Servidor"; painel de log de auditoria (admin, data/hora, ação, usuário afetado, módulo); versão para impressão/PDF. RF06–RF08, RNF03 (403 no servidor + tabela de logs).

### Tela 04 — Meu Perfil (`UserProfile.dc.html`)
Dois blocos: dados funcionais somente leitura (Nome, Matrícula, Cargo, E-mail institucional — fundo cinza) e dados pessoais editáveis (Telefone com máscara dinâmica 10/11 dígitos, E-mail pessoal validado por regex, Data de aniversário). Botão "Salvar" habilita só com alteração. RF09–RF11, RNF04 (LGPD).

### Tela 05 — Moções & Homenagens (`MocoesHomenagens.dc.html`)
Abas: Controle de Moções (registro com busca) e Galeria de Homenageados (cota por vereador/legislatura, validação Portaria DA).

### Tela 06 — Almoxarifado (`AlmoxarifadoAmostragem.dc.html`)
Estoque com escala de amostragem gerada por prioridade/consumo, contagem com divergência (OK/+N/−N), simulação de scanner, alertas de nível crítico.

### Tela 07 — Patrimônio (`PatrimonioModule.dc.html`)
Bens patrimoniais, tombamento, movimentações e status.

### Módulos complementares
- `ComprasModule.dc.html` — requisições, fornecedores, licitações (fases Edital/Julgamento/Homologação), KPIs
- `ProtocoloModule.dc.html` — documentos, processos, prazos com urgência (Crítico/Atenção/Normal), fluxo
- `RHModule.dc.html` — servidores, férias, analytics e matriz RBAC (checkbox por papel × permissão, select de papel por usuário)
- `InventoryModule.dc.html` — amostragem de inventário com consolidação
- `NotificationsModule.dc.html` — caixa de entrada/não lidas/arquivadas/preferências, dark mode
- `AnalyticsModule.dc.html` — visão geral, métricas por módulo, saúde do sistema
- `Index.dc.html` — hub de navegação de todas as telas

## App Shell (todas as telas autenticadas)
Estrutura idêntica nas 12 telas internas — implementar como um único componente de layout:
- **Sidebar** verde 250px: marca "DA" (link para o Painel), grupos "Sistemas & Gestão" (Painel, Moções, Almoxarifado, Patrimônio, Usuários, Perfil) e "Módulos Complementares" (Compras, Protocolo, RH, Inventário, Notificações, Analytics); item ativo = fundo branco + texto verde 700; bloco do usuário (link para Perfil) + "Sair do sistema" (→ Login). Itens com altura mínima 44px. No Painel, os itens de Sistemas & Gestão são filtrados pelo papel ativo (RF08).
- **Barra superior** sticky 64px: mobile = ☰ + marca "DA"; desktop = breadcrumb "Painel de Controle › Tela". À direita: **busca global** (spec 2.3) — filtra telas/módulos por nome e palavras-chave, sem acentos, Enter abre o 1º resultado, Esc limpa — e atalho de Notificações.
- **Cabeçalho de página**: eyebrow "Sistema de Gestão Integrada • Seção" (11px/700, verde, caixa alta) + H1 30px/800 (24px mobile) + ações da página à direita.
- **Mobile (<900px)**: sidebar vira drawer (transição elástica 0.3s) com overlay 50%; gutter lateral 16px (36px desktop).

## Interactions & Behavior
- Navegação entre telas via links relativos `*.dc.html` — no app real, rotas do router
- Sidebar consistente nas telas principais: Painel, Usuários, Moções, Almoxarifado, Patrimônio, Perfil
- Mobile (breakpoint 900px): sidebar vira drawer com overlay 0.5; grids colapsam para 1 coluna na ordem: alertas críticos → indicadores → gráfico → calendário → histórico (RF04); tabelas com scroll horizontal; alvos de toque ≥ 44px
- Skeletons pulsantes durante carregamento (RF05)
- Toggles de permissão salvam via requisição assíncrona imediata (RF07); menu renderizado condicionalmente por permissão (RF08)
- Estados: hover em cards/botões (escurecimento verde, sombra), disabled cinza `#CCCCCC`, foco de input com borda verde

## State Management
Cada tela declara seu estado na `class Component` (mock): listas de usuários/processos/produtos, aba ativa, filtros, formulários, papel ativo. No app real: auth (sessão/JWT), permissões do usuário (dirigem menu e rotas), dados via API REST.

## Backend & API
- `openapi.yaml` — especificação OpenAPI 3.0 dos endpoints (auth, usuários, permissões, módulos, auditoria)
- `backend/` — scaffold Node.js + PostgreSQL com validação server-side RBAC (403), hashing de senha e logging de auditoria
- `api.js` — camada mock de integração usada pelo protótipo

## Assets
Sem imagens externas; ícones são emoji/glifos temporários — substituir por biblioteca de ícones institucional. Logotipo da Câmara é placeholder textual: solicitar o logotipo oficial.

## Files
Todos os `.dc.html` listados acima + `openapi.yaml` + `backend/` no pacote. Documento de requisitos v1.1 é a fonte normativa (RF01–RF11, RNF01–RNF04).


## Atualização — Planilha CONTROLE GERAL LICCONT (out/2026)
Fonte de dados compartilhada: `liccont.js` (`window.DALic`, persistência em localStorage, evento `licchange`). Amostra de ~10 registros por aba; agentes com nomes fictícios.
- **Compras › Controle de Processos** (`ComprasProcessos.dc.html`): 24 etapas (6 internas + 18 externas), status Pendente/Concluída/Refazer/Não se aplica. Etapa parada > 5 dias úteis = atrasada. "Refazer" exige justificativa e gera alerta amarelo no Painel. Só o agente responsável e a chefia editam. Novo processo: sistema sugere o agente com menor carga; a chefia confirma.
- **Compras › Contratos** (`ComprasContratos.dc.html`): vigência, aditamentos, empenho, execução mensal 2026, histórico 2025. Avisos: azul ≤ 120 dias, amarelo ≤ 60, vermelho ≤ 30; saldo de empenho < 20%.
- **Compras › Limites Legais** (`ComprasDespesas.dc.html`): despesas reais 2026 + Verbinha, acumulado por Classe CATMAT / Grupo CATSER até a data do empenho (Decreto 12.807/2025). Campos Ficha/Sub, AUDESP e vínculo com contrato.
- **Moções › Arranjos e Placas** (`HomenagensArranjos.dc.html`): logística de entrega das homenagens.
- **Calendário Integrado (Protocolo)**: inclui fins de contrato (Compras) e entregas de homenagens (Moções).
- **Painel**: card "Carga por Agente de Contratação" e alertas de Refazer, atraso de etapa, vencimento e saldo de contrato.
- React: rota `/compras/controle` (`src/pages/ComprasControle.jsx`, `src/lib/liccont.js`).
