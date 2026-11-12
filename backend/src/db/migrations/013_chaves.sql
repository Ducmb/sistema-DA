-- Controle de Chaves (modelo "Entrega e Recebimento de Chaves"): cadastro de chaves por local,
-- retirada e devolução com assinatura eletrônica do solicitante (na tela/mesa digitalizadora ou no tablet).

CREATE TABLE chaves (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,              -- identificação física (etiqueta do chaveiro)
  local VARCHAR(160) NOT NULL,                     -- local a que a chave dá acesso
  descricao VARCHAR(300) NOT NULL DEFAULT '',
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assinatura eletrônica do solicitante. "pendente" = enviada ao tablet, aguardando; usada uma única vez.
CREATE TABLE chaves_assinaturas (
  id UUID PRIMARY KEY,
  criada_por INT NOT NULL REFERENCES users(id),    -- servidor que pediu a assinatura (e cujo tablet a recebe)
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('retirada', 'devolucao')),
  resumo JSONB NOT NULL,                           -- o que está sendo assinado (local, solicitante, data)
  status VARCHAR(10) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'assinada', 'cancelada')),
  dispositivo VARCHAR(10) CHECK (dispositivo IN ('tela', 'tablet')),
  imagem TEXT,                                     -- PNG (data URL) do traço da assinatura
  hash CHAR(64),                                   -- SHA-256 de resumo + imagem + data/hora (verificação de integridade)
  assinada_em TIMESTAMPTZ,
  ip VARCHAR(64),
  user_agent VARCHAR(300),
  expira_em TIMESTAMPTZ NOT NULL,
  usada BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX chaves_assinaturas_pendentes ON chaves_assinaturas (criada_por) WHERE status = 'pendente';

CREATE TABLE chaves_emprestimos (
  id SERIAL PRIMARY KEY,
  chave_id INT NOT NULL REFERENCES chaves(id),
  local VARCHAR(160) NOT NULL,                     -- local no momento da retirada
  solicitante VARCHAR(160) NOT NULL,
  solicitante_doc VARCHAR(40) NOT NULL DEFAULT '', -- matrícula ou documento
  solicitante_user_id INT REFERENCES users(id),
  retirada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entregue_por INT NOT NULL REFERENCES users(id),  -- Responsável pela Entrega
  assinatura_retirada UUID NOT NULL REFERENCES chaves_assinaturas(id),
  devolucao_em TIMESTAMPTZ,
  devolvido_por VARCHAR(160),                      -- quem trouxe a chave de volta
  recebido_por INT REFERENCES users(id),           -- Responsável pelo Recebimento
  assinatura_devolucao UUID REFERENCES chaves_assinaturas(id),
  observacao VARCHAR(400) NOT NULL DEFAULT ''
);
-- Uma chave só pode estar emprestada a uma pessoa por vez
CREATE UNIQUE INDEX chaves_emprestimos_aberto ON chaves_emprestimos (chave_id) WHERE devolucao_em IS NULL;
