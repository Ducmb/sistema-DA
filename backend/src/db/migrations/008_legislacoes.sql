-- Legislações: base normativa (resoluções, portarias, bases legais, recomendações) com PDF opcional

CREATE TABLE normas (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Base legal', 'Decreto', 'Resolução', 'Portaria', 'Recomendação')),
  numero VARCHAR(160) NOT NULL,
  ementa VARCHAR(1000) NOT NULL,
  orgao VARCHAR(160) NOT NULL DEFAULT '',
  data DATE,
  link VARCHAR(500) NOT NULL DEFAULT '',
  tags VARCHAR(300) NOT NULL DEFAULT '',
  texto TEXT NOT NULL DEFAULT '',
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  pdf_nome VARCHAR(200),                           -- nome original do arquivo
  pdf_arquivo VARCHAR(80),                         -- nome no UPLOAD_DIR (aleatório)
  pdf_tamanho INT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
