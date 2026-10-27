-- Almoxarifado: materiais, documentos RME/BRM, movimentos, parâmetros da escala, escalas e contagens

CREATE TABLE materiais (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL,                      -- formatado: 1 50 02 0018 0
  codigo_digitos CHAR(10) NOT NULL UNIQUE CHECK (codigo_digitos ~ '^[0-9]{10}$'),
  descricao VARCHAR(255) NOT NULL,
  unidade VARCHAR(10) NOT NULL DEFAULT 'UN',
  categoria VARCHAR(60) NOT NULL DEFAULT 'Papelaria',
  prioridade VARCHAR(10) NOT NULL DEFAULT 'Baixa' CHECK (prioridade IN ('Alta', 'Média', 'Baixa')),
  saldo NUMERIC(14,3) NOT NULL DEFAULT 0,
  consumo_medio NUMERIC(14,3) NOT NULL DEFAULT 0,
  verificar BOOLEAN NOT NULL DEFAULT FALSE,         -- "Sugerido" para contagem
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE estoque_documentos (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(3) NOT NULL CHECK (tipo IN ('RME', 'BRM')),
  numero VARCHAR(20) NOT NULL,
  data_doc DATE,
  arquivo VARCHAR(255) NOT NULL,
  origem VARCHAR(255),          -- setor (RME) ou fornecedor (BRM)
  nota_fiscal VARCHAR(40),
  status_doc VARCHAR(60),       -- status da RME no sistema de origem
  fonte VARCHAR(10) NOT NULL DEFAULT 'upload' CHECK (fonte IN ('upload', 'drive', 'seed')),
  drive_file_id VARCHAR(128) UNIQUE,
  processado_por INT REFERENCES users(id) ON DELETE SET NULL,
  processado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tipo, numero)
);

CREATE TABLE estoque_doc_itens (
  id SERIAL PRIMARY KEY,
  documento_id INT NOT NULL REFERENCES estoque_documentos(id) ON DELETE CASCADE,
  codigo_digitos CHAR(10) NOT NULL,
  descricao VARCHAR(255),
  quantidade NUMERIC(14,3) NOT NULL CHECK (quantidade >= 0),
  unidade VARCHAR(10),
  preco NUMERIC(14,4),
  material_id INT REFERENCES materiais(id) ON DELETE SET NULL,
  aplicado BOOLEAN NOT NULL DEFAULT FALSE,
  descartado BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_descarte VARCHAR(200),
  saldo_antes NUMERIC(14,3),
  saldo_depois NUMERIC(14,3)
);
CREATE INDEX estoque_doc_itens_pend ON estoque_doc_itens (codigo_digitos) WHERE NOT aplicado AND NOT descartado;

CREATE TABLE estoque_movimentos (
  id SERIAL PRIMARY KEY,
  material_id INT NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  documento_id INT REFERENCES estoque_documentos(id) ON DELETE SET NULL,
  tipo VARCHAR(20) NOT NULL,     -- RME | BRM | Saldo inicial | Contagem
  referencia VARCHAR(60) NOT NULL,
  quantidade NUMERIC(14,3) NOT NULL,
  saldo_apos NUMERIC(14,3) NOT NULL,
  por INT REFERENCES users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX estoque_movimentos_material ON estoque_movimentos (material_id, criado_em DESC);

-- Parâmetros da escala (equipe, dias, pesos); itens/sessão, sessões, tolerância e recontagem ficam em system_config
CREATE TABLE almox_params (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  equipe JSONB NOT NULL DEFAULT '[]'::jsonb,        -- [{ userId, active }]
  dias JSONB NOT NULL DEFAULT '["Seg","Qua"]'::jsonb,
  pesos JSONB NOT NULL DEFAULT '{"alta":60,"media":30,"baixa":10}'::jsonb,
  base_calculo VARCHAR(8) NOT NULL DEFAULT 'dias' CHECK (base_calculo IN ('dias', 'sessoes')),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE almox_escalas (
  id SERIAL PRIMARY KEY,
  gerada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gerada_por INT REFERENCES users(id) ON DELETE SET NULL,
  categoria VARCHAR(60) NOT NULL DEFAULT 'todos',
  metodo VARCHAR(12) NOT NULL,
  semana_inicio DATE NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE almox_escala_itens (
  escala_id INT NOT NULL REFERENCES almox_escalas(id) ON DELETE CASCADE,
  material_id INT NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  responsavel_id INT REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (escala_id, material_id)
);

CREATE TABLE almox_contagens (
  id SERIAL PRIMARY KEY,
  material_id INT NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  escala_id INT REFERENCES almox_escalas(id) ON DELETE SET NULL,
  contado NUMERIC(14,3) NOT NULL CHECK (contado >= 0),
  sistema NUMERIC(14,3) NOT NULL,
  diferenca NUMERIC(14,3) NOT NULL,
  status VARCHAR(12) NOT NULL CHECK (status IN ('ok', 'tolerancia', 'divergente', 'corrigido')),
  por INT REFERENCES users(id) ON DELETE SET NULL,
  em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  corrigido_por INT REFERENCES users(id) ON DELETE SET NULL,
  corrigido_em TIMESTAMPTZ
);
CREATE INDEX almox_contagens_material ON almox_contagens (material_id, em DESC);
