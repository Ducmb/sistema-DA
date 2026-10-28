# Revisão de segurança — Sistema DA

Revisão completa de `backend/` e `react-app/` contra as regras do `CLAUDE.md` (RNF01–RNF04) e as práticas usuais (OWASP Top 10). Data: 28/10/2026.

## Escopo e método
- Leitura de todo o código de autenticação, sessões, RBAC, rotas de cada módulo, uploads, exportações, auditoria e do front-end.
- Busca por SQL montado com texto, uso de HTML não escapado, segredos versionados e dependências vulneráveis (`npm audit`).
- Testes automatizados para cada correção (`backend/tests/security.test.js`, `react-app/src/__tests__/nav.test.js`) e verificação no navegador.

## Achados corrigidos

| # | Gravidade | Achado | Correção |
|---|---|---|---|
| 1 | Média | **Descoberta de usuários pelo tempo do login.** Usuário inexistente era comparado com um hash de custo 4 (≈ 40 ms) e os reais têm custo 12 (≈ 250 ms); contas com convite pendente respondiam na hora. | Hash "isca" com o mesmo custo dos reais e comparação de tempo constante para hashes inutilizáveis (`services/passwords.js`). |
| 2 | Média | **Open redirect no front-end** (`?volta=/\host`), agravado pela versão do React Router (GHSA-wrjc-x8rr-h8h6). | React Router atualizado para 7.18.5 (0 vulnerabilidades no `npm audit`) e `safePath()` aceita só caminhos internos de telas conhecidas — usado no login, no feed do Painel e nas notificações. |
| 3 | Média | **RNF04 contornável pela Gestão de Pessoal.** Quem recebesse o módulo Gestão de Pessoal sem ser Administrativo podia alterar o próprio nome, matrícula e cargo, desligar (bloquear) administradores e editar o cadastro deles. | `PUT /pessoal/servidores/:id`: o próprio servidor não altera dados funcionais (403 + auditoria); desligar/reativar quem tem acesso e editar administradores passa a ser exclusivo do Administrativo. |
| 4 | Média | **Termo de patrimônio sem assinatura.** O botão de etapa levava "Pendente → Verificar" sem a assinatura do servidor de destino, e o termo podia ser alterado depois de assinado. | Transferência para um servidor só avança pela assinatura dele; termo assinado só aceita completar os centros de custo; voltar para "Pendente" anula a assinatura. A tela mostra "Aguardando assinatura de …". |
| 5 | Média | **Registro de leitura de dados pessoais podia ser desligado** em Configurações (`rh.lgpdLog`), contrariando a regra obrigatória do CLAUDE.md. | Chave removida; a leitura de dados pessoais é sempre auditada. |
| 6 | Baixa | **Log de auditoria alterável** por qualquer falha de SQL da aplicação. | Gatilho no banco impede `UPDATE` em `audit_logs` (migração 010). |
| 7 | Baixa | **Consumo de memória no upload do Almoxarifado:** até 200 PDFs de 10 MB por requisição, em memória (≈ 2 GB). | Limite de 25 arquivos por remessa (a tela envia lotes de 20); erros do upload viram 400 em vez de 500. |
| 8 | Baixa | **Tempo de resposta da recuperação de senha** dependia do envio do e-mail (revelava se o e-mail existe). | Envio do e-mail fora do caminho da resposta. |
| 9 | Baixa | PDF de legislação aberto diretamente no navegador sem isolamento. | Resposta com `Content-Security-Policy: sandbox; default-src 'none'`. |
| 10 | Operacional | **Não havia como criar o primeiro administrador em produção** (o seed é bloqueado lá, corretamente). | `npm run create-admin`: cria o administrador sem senha em linha de comando e imprime um link de convite de uso único (72 h); recusa se já existir administrador ativo. |

Também corrigido durante a verificação (não é de segurança): após o login, o retorno para a tela pedida (`volta`) era ignorado.

## Verificado e em conformidade
- **Autorização no servidor:** todo módulo é montado com `requireModule` (403 + registro "Acesso negado"); Usuários, Configurações e Centros de Custo exigem Administrativo; regras por objeto (agente/chefia em Compras, responsável em Almoxarifado, destinatário no Patrimônio, não decidir a própria férias, notificações por usuário) conferidas.
- **Senhas e tokens:** bcrypt custo 12, mínimo 8 com regras configuráveis, bloqueio por tentativas, token de redefinição/convite aleatório (256 bits), uso único, expiração, salvo como SHA-256; troca/redefinição revoga as sessões.
- **Sessão:** JWT HS256 com algoritmo fixo e expiração; sessão no banco com revogação no logout e expiração por inatividade; servidor não sobe sem `JWT_SECRET` forte.
- **Erros:** 500 com mensagem genérica; detalhes só no log do servidor.
- **Injeção de SQL:** todas as consultas são parametrizadas; trechos dinâmicos vêm de listas fixas.
- **XSS:** nenhum `dangerouslySetInnerHTML`/`innerHTML`; links externos só `http(s)` (validados no servidor e no front) com `rel="noopener noreferrer"`.
- **Uploads:** PDF validado pelo conteúdo (`%PDF-`), nome em disco aleatório, `path.basename` contra path traversal, `nosniff`.
- **CSV:** proteção contra injeção de fórmulas; exportações auditadas.
- **Dados pessoais:** perfil não altera dados funcionais (403 + auditoria); leituras de servidores, usuários e empréstimos de bandeiras (CPF/telefone) auditadas.
- **Segredos:** `.env` fora do git e nenhum segredo no histórico; `npm audit` sem vulnerabilidades no back-end e no front-end.

## Riscos aceitos e recomendações para a publicação
1. **Cabeçalhos do front-end:** o `dist/` do React precisa ser servido com HTTPS e cabeçalhos próprios — `Strict-Transport-Security`, `Content-Security-Policy` (ex.: `default-src 'self'; frame-ancestors 'none'; object-src 'none'; frame-src 'self' blob:`), `Referrer-Policy: no-referrer` (os links de redefinição levam o token na URL) e `X-Content-Type-Options: nosniff`. A API já usa `helmet`.
2. **Proxy reverso:** defina `TRUST_PROXY` para que IP de auditoria e limites por IP usem o IP real. Se toda a Câmara sair por um único IP, ajuste os limites de `/api/auth`.
3. **Bloqueio de conta:** o bloqueio por tentativas é por usuário, então terceiros podem bloquear temporariamente uma conta conhecida (negação de serviço). É a troca usual para impedir força bruta; o tempo é configurável.
4. **Banco:** use um usuário de aplicação sem permissão de DDL, com apenas `INSERT/SELECT/DELETE` em `audit_logs`, e backup criptografado. A retenção da auditoria é configurável (padrão 5 anos).
5. **Leitor de PDF:** `pdf-parse` 1.1.1 embute uma versão antiga do pdf.js. Hoje só extrai texto de PDFs enviados por usuários autenticados do Almoxarifado ou da pasta do Drive. Avalie trocar por um extrator mantido ou rodar a leitura em processo isolado.
6. **Token no navegador:** fica em `sessionStorage` (apagado ao fechar a aba). Sem vetores de XSS encontrados, o risco é baixo; um cookie `HttpOnly` com proteção CSRF seria a evolução.
7. **Credenciais de exemplo** (`admin/123456` etc.) existem só no seed de desenvolvimento, que não roda em produção.
8. **Antes de publicar:** teste com um usuário de cada perfil em homologação (o roteiro está na Etapa 7 do `INTEGRACAO.md`).
