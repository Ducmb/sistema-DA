# Sistema DA — Front-end (React + Vite)

Interface mobile-first do Sistema DA, reescrita a partir do protótipo (`design/*.dc.html`). Todos os dados vêm da API (`../backend`); o front-end não guarda regras de negócio.

## Rodar
```bash
npm install
npm run dev        # http://localhost:5173 — /api é encaminhado para http://localhost:3000 (vite.config.js)
npm run build      # gera dist/ para servir atrás do mesmo domínio da API
npm test           # Vitest
```
A API precisa estar rodando (veja `../backend/README.md`).

## Estrutura
- `src/theme.js` — design tokens claro/escuro (gerados como variáveis CSS em `main.jsx`) e níveis semânticos (crítico, atenção, informativo).
- `src/styles.css` — utilitários (card, btn, input, tabela com rolagem horizontal, modal, drawer, skeleton, chips). Breakpoint 900px, alvos ≥ 44px.
- `src/components/` — `Layout` (menu lateral/drawer, busca global, sino de notificações, aviso de acesso negado), `ui.jsx` (Modal, Tabs, Async, Kpi, Switch, Toast…).
- `src/lib/` — `api.js` (fetch com token, 401 → login), `auth.jsx` (sessão, inatividade, preferências salvas no servidor), `nav.js` (telas e menu por módulo), `hooks.js`, `format.js`, `cadastros.jsx`.
- `src/pages/` — uma pasta/arquivo por módulo: Painel, Compras, Almoxarifado, Patrimônio, Protocolo (calendário integrado), Moções & Homenagens, Gestão de Pessoal, Legislações, Analytics, Notificações, Auditoria, Configurações, Perfil, Login/Recuperação.

## Permissões
O menu e as rotas escondem o que o usuário não pode acessar (`Guard` em `App.jsx`), mas **quem protege é o servidor** (403). Ao cair numa rota negada, o usuário volta para a tela inicial do perfil com o aviso.

## Credenciais de exemplo
`admin/123456` · `operador/senha123` · `compras`, `almoxarifado`, `patrimonio`, `gerencia`, `visualizador` com `teste2026` (somente com o seed de desenvolvimento).
