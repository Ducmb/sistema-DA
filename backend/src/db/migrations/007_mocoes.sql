-- Moções & Homenagens: moções, galeria de homenageados (cota), entregas de arranjos/placas e empréstimo de bandeiras

CREATE TABLE mocoes (
  id SERIAL PRIMARY KEY,
  numero INT NOT NULL,
  ano INT NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Aplauso', 'Congratulação', 'Pesar', 'Apoio', 'Repúdio', 'Reconhecimento')),
  assunto VARCHAR(300) NOT NULL,
  vereador_id INT NOT NULL REFERENCES vereadores(id),
  data DATE NOT NULL,                              -- data de protocolo
  sessao DATE,                                     -- data da sessão (calendário)
  status VARCHAR(12) NOT NULL DEFAULT 'Em Análise' CHECK (status IN ('Em Análise', 'Aprovada', 'Rejeitada', 'Arquivada')),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (numero, ano)
);

CREATE TABLE homenageados (
  id SERIAL PRIMARY KEY,
  homenageado VARCHAR(200) NOT NULL,
  vereador_id INT NOT NULL REFERENCES vereadores(id),
  legislatura CHAR(9) NOT NULL,                    -- AAAA-AAAA
  quadro VARCHAR(20) NOT NULL UNIQUE,              -- Q-000
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE homenagens_entregas (
  id SERIAL PRIMARY KEY,
  homenageado VARCHAR(200) NOT NULL,
  honraria VARCHAR(160) NOT NULL DEFAULT '',
  vereador_id INT NOT NULL REFERENCES vereadores(id),
  material VARCHAR(80) NOT NULL DEFAULT 'Placa',
  processo VARCHAR(40) NOT NULL DEFAULT '',
  decreto VARCHAR(40) NOT NULL DEFAULT '',
  data DATE,                                       -- NULL = a agendar
  horario VARCHAR(20) NOT NULL DEFAULT '',
  status VARCHAR(60) NOT NULL DEFAULT 'PLACA ENCOMENDADA',
  obs VARCHAR(400) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bandeiras_emprestimos (
  id SERIAL PRIMARY KEY,
  solicitacao DATE NOT NULL,
  entidade VARCHAR(200) NOT NULL,
  documento VARCHAR(14) NOT NULL DEFAULT '',       -- CPF/CNPJ só dígitos (dado pessoal)
  telefone VARCHAR(20) NOT NULL DEFAULT '',
  protocolo VARCHAR(40) NOT NULL DEFAULT '',       -- protocolo 1Doc
  itens TEXT[] NOT NULL DEFAULT '{}',
  retirado BOOLEAN NOT NULL DEFAULT FALSE,
  retirada DATE,                                   -- agendamento enquanto não retirado
  devolucao DATE,                                  -- prevista enquanto não devolvido
  conformidade VARCHAR(3) NOT NULL DEFAULT '' CHECK (conformidade IN ('', 'Sim', 'Não')),
  obs VARCHAR(400) NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
