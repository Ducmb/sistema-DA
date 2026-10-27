-- Protocolo: documentos protocolados, processos internos e prazos

CREATE TABLE protocolo_documentos (
  id SERIAL PRIMARY KEY,
  protocolo VARCHAR(20) NOT NULL UNIQUE,           -- PRT-AAAA-NNN
  assunto VARCHAR(300) NOT NULL,
  interessado VARCHAR(160) NOT NULL,
  setor VARCHAR(160) NOT NULL DEFAULT '',           -- setor de destino (centro de custo)
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'Registrado' CHECK (status IN ('Registrado', 'Em Processamento', 'Finalizado', 'Arquivado')),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE protocolo_processos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,              -- PROC-NNN
  titulo VARCHAR(200) NOT NULL,
  descricao VARCHAR(600) NOT NULL DEFAULT '',
  prioridade VARCHAR(10) NOT NULL DEFAULT 'Média' CHECK (prioridade IN ('Alta', 'Média', 'Baixa')),
  progresso INT NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  responsavel VARCHAR(160) NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE protocolo_prazos (
  id SERIAL PRIMARY KEY,
  documento_id INT REFERENCES protocolo_documentos(id) ON DELETE CASCADE,
  processo_id INT REFERENCES protocolo_processos(id) ON DELETE CASCADE,
  descricao VARCHAR(200) NOT NULL,
  vencimento DATE NOT NULL,
  concluido_em TIMESTAMPTZ,
  concluido_por INT REFERENCES users(id),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((documento_id IS NULL) <> (processo_id IS NULL))
);
CREATE INDEX protocolo_prazos_abertos ON protocolo_prazos (vencimento) WHERE concluido_em IS NULL;
