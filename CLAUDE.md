# CLAUDE.md — Sistema DA

Contexto permanente para o Claude Code neste repositório.

## Objetivo
Transformar o protótipo (`design/*.dc.html`) em sistema de produção:
front-end React (`react-app/`) + API Node.js/Express + PostgreSQL (`backend/`).

## Regras
1. **O protótipo é a referência visual e de regras.** Ao implementar uma tela, leia o `.dc.html` correspondente — o template (layout, textos) e a `class Component` (estado, validações, cálculos). Reproduza fielmente; não invente telas nem campos.
2. **Não copie o runtime do protótipo.** `support.js`, `<x-dc>`, `<sc-for>`, `<sc-if>`, `{{ }}` e `DCLogic` são do protótipo. Reescreva como componentes React.
3. **Os `*.js` de `design/` são regras de negócio em `localStorage`.** Porte cálculos, alertas e validações para o back-end e exponha via API. O front-end só exibe.
4. **Segurança é obrigatória (RNF01–RNF04):**
   - Toda autorização é validada no servidor (403 para rota não permitida). O menu só esconde; não protege.
   - Senhas com bcrypt/Argon2, mínimo 8 caracteres; token de redefinição aleatório, uso único, 30 min, salvo como hash.
   - JWT com expiração; o servidor não sobe sem `JWT_SECRET` forte.
   - Erros 500 não expõem detalhes internos.
   - Alterações de permissão e configuração e leituras de dados pessoais vão para a auditoria.
   - Nome, matrícula, cargo e e-mail institucional não podem ser alterados pelo próprio usuário — barrar no servidor.
5. **Mobile-first.** Breakpoint 900px; grid colapsa para 1 coluna; alvos ≥ 44px; tabelas com rolagem horizontal.
6. **Design tokens** estão no README. Centralize em `react-app/src/theme.js` (claro e escuro).
7. **Atualize `openapi.yaml`** sempre que criar ou mudar uma rota.
8. Interface em **português do Brasil**, como no protótipo.
9. Trabalhe em fases (ver INTEGRACAO.md). Ao fim de cada fase: testes passando e commit.

## Comandos
- Front: `cd react-app && npm install && npm run dev`
- Back: `cd backend && npm install && cp .env.example .env` (preencher) `&& npm run migrate && npm run dev`
- Testes: `cd backend && npm test`
