-- Compras & Licitações: controle de processos (24 etapas), contratos, despesas/limites legais,
-- verbinha, dotação orçamentária, fornecedores e catálogo CATMAT/CATSER

CREATE TABLE compras_processos (
  id SERIAL PRIMARY KEY,
  interno VARCHAR(30) NOT NULL,
  externo VARCHAR(30) NOT NULL DEFAULT '—',
  objeto VARCHAR(400) NOT NULL,
  modo VARCHAR(20) NOT NULL CHECK (modo IN ('Dispensa', 'Inexigibilidade', 'Licitação')),
  setor VARCHAR(160) NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  agente_id INT REFERENCES users(id) ON DELETE SET NULL,
  criado_por INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX compras_processos_interno ON compras_processos (interno);

CREATE TABLE compras_etapas (
  processo_id INT NOT NULL REFERENCES compras_processos(id) ON DELETE CASCADE,
  idx SMALLINT NOT NULL CHECK (idx BETWEEN 0 AND 23),
  status VARCHAR(8) NOT NULL DEFAULT 'pend' CHECK (status IN ('pend', 'ok', 'refazer', 'na')),
  since DATE,            -- desde quando a etapa está parada (pendente atual)
  data DATE,             -- data da última marcação
  por INT REFERENCES users(id) ON DELETE SET NULL,
  justificativa TEXT,    -- obrigatória em "refazer"
  nota VARCHAR(200),
  PRIMARY KEY (processo_id, idx)
);

CREATE TABLE fornecedores (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  cnpj CHAR(18) NOT NULL UNIQUE,
  telefone VARCHAR(20),
  email VARCHAR(160) NOT NULL,
  segmentos TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  desde SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fornecedor_eventos (
  id SERIAL PRIMARY KEY,
  fornecedor_id INT NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  tipo VARCHAR(12) NOT NULL CHECK (tipo IN ('cadastro', 'cotacao', 'contrato', 'ocorrencia', 'situacao')),
  titulo VARCHAR(200) NOT NULL,
  detalhe TEXT
);

CREATE TABLE contratos (
  id SERIAL PRIMARY KEY,
  contratada VARCHAR(200) NOT NULL,
  contrato VARCHAR(30) NOT NULL,
  processo VARCHAR(30),
  aditamentos SMALLINT NOT NULL DEFAULT 0,
  assinatura DATE NOT NULL,
  fim DATE NOT NULL,
  empenhado NUMERIC(14,2) NOT NULL DEFAULT 0,
  fornecedor_id INT REFERENCES fornecedores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contrato, contratada)
);

-- Execução mensal (notas fiscais) por exercício
CREATE TABLE contrato_notas (
  contrato_id INT NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  ano SMALLINT NOT NULL,
  mes SMALLINT NOT NULL CHECK (mes BETWEEN 0 AND 11),
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (contrato_id, ano, mes)
);

-- Vigência anterior (histórico do exercício passado)
CREATE TABLE contrato_historico (
  contrato_id INT NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  ano SMALLINT NOT NULL,
  assinatura DATE,
  inicio DATE,
  fim DATE,
  PRIMARY KEY (contrato_id, ano)
);

CREATE TABLE despesas (
  id SERIAL PRIMARY KEY,
  processo VARCHAR(30) NOT NULL,
  catmat VARCHAR(20),
  classe VARCHAR(10),
  catser VARCHAR(20),
  grupo VARCHAR(10),
  objeto VARCHAR(300) NOT NULL,
  descricao VARCHAR(300),
  reserva NUMERIC(14,2),
  data DATE,
  modalidade VARCHAR(40),
  empenhado NUMERIC(14,2) NOT NULL CHECK (empenhado > 0),
  ficha VARCHAR(10),
  sub VARCHAR(10),
  data_empenho DATE NOT NULL,
  audesp VARCHAR(8) NOT NULL DEFAULT '' CHECK (audesp IN ('', 'Enviado', 'NA')),
  tcn VARCHAR(8) NOT NULL DEFAULT '' CHECK (tcn IN ('', 'Enviado', 'NA')),
  contrato_id INT REFERENCES contratos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (classe IS NOT NULL OR grupo IS NOT NULL)
);
CREATE INDEX despesas_data ON despesas (data_empenho);

-- Verbinha (adiantamentos) — entra no acumulado por Classe/Grupo
CREATE TABLE verbinha (
  id SERIAL PRIMARY KEY,
  origem VARCHAR(20) NOT NULL,
  classe VARCHAR(10),
  grupo VARCHAR(10),
  data DATE NOT NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  CHECK (classe IS NOT NULL OR grupo IS NOT NULL)
);

CREATE TABLE dotacoes (
  id SERIAL PRIMARY KEY,
  ano SMALLINT NOT NULL,
  ficha VARCHAR(10) NOT NULL,
  sub VARCHAR(10) NOT NULL DEFAULT '—',
  descricao VARCHAR(300) NOT NULL DEFAULT '',
  orcado NUMERIC(14,2) NOT NULL CHECK (orcado > 0),
  UNIQUE (ano, ficha, sub)
);

-- Catálogo compras.gov.br (sincronizado por rotina no servidor)
CREATE TABLE catalogo_itens (
  id SERIAL PRIMARY KEY,
  catalogo VARCHAR(6) NOT NULL CHECK (catalogo IN ('CATMAT', 'CATSER')),
  codigo VARCHAR(20) NOT NULL,
  nome VARCHAR(300) NOT NULL,
  grupo_cod VARCHAR(10), grupo_nome VARCHAR(200),
  classe_cod VARCHAR(10), classe_nome VARCHAR(200),
  pdm_cod VARCHAR(10), pdm_nome VARCHAR(200),
  UNIQUE (catalogo, codigo)
);

CREATE TABLE catalogo_sync (
  id SERIAL PRIMARY KEY,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modo VARCHAR(10) NOT NULL,          -- 'api' (sucesso via API oficial) | 'falha'
  status TEXT NOT NULL,
  contagens JSONB NOT NULL DEFAULT '{}'::jsonb,
  endpoints JSONB NOT NULL DEFAULT '{}'::jsonb,
  por INT REFERENCES users(id) ON DELETE SET NULL
);
