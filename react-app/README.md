# Sistema DA — React

Prototipo migrado do design (.dc.html) para React + Vite + React Router. Mobile-first, paleta e tipografia do documento de requisitos v1.1.

## Rodar localmente
```
cd react-app
npm install
npm run dev
```

## Estrutura
- `src/components/Layout.jsx` — shell com sidebar (drawer no mobile) reutilizado em todas as telas
- `src/theme.js` — tokens de cor/fonte
- `src/pages/` — uma página por tela (Login, Dashboard, Usuários, Perfil, Moções, Almoxarifado, Patrimônio, Compras, Protocolo, RH, Inventário, Notificações, Analytics)

## Credenciais de teste
`admin/123456` ou `operador/senha123`

## Estado atual
Todas as telas usam dados mock em `useState` local — sem chamadas de API real. Login/Dashboard/Usuários/Perfil têm interatividade completa (paridade com o protótipo `.dc.html`); os 8 módulos complementares têm o shell e uma tabela funcional por aba — aprofundar conforme o backend (`../backend`, `../openapi.yaml`) for integrado.

## Próximos passos sugeridos
- Trocar mocks por chamadas fetch ao backend Node.js/PostgreSQL já especificado
- Adicionar guarda de rotas por papel (RBAC) usando contexto de autenticação
- Adicionar validação de formulário (regex e-mail, máscara de telefone) — já presente no protótipo original


## Atualização (out/2026)
- Permissões por servidor: as chaves de Usuários & Permissões (Gestão de Pessoal) são salvas em `DA_user_access` e `can()` (src/lib/session.js) as respeita antes do papel.
- Log central: `src/lib/audit.js` (`logAudit`), usado nas chaves de acesso e no cadastro de servidores.
- Exercício fiscal: `src/lib/exercicio.js`; seletor em Controle LICCONT filtra Contratos, Despesas e a nova aba Dotação Orçamentária.
- Painel: feed mostra os 5 alertas mais recentes (alertas reais de `liccont.js`) com link para a Central.
- Central de Notificações: alertas reais com "Ir para a ação", lidas e arquivadas persistidas.
- Analytics: visão consolidada calculada dos dados, com links para cada módulo.
