-- Patrimônio: transferências de responsabilidade e termos por centro de custo/mês

CREATE TABLE patrimonio_transferencias (
  id SERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL,                       -- código de tombamento
  description VARCHAR(200) NOT NULL,
  from_user VARCHAR(160) NOT NULL,                 -- responsável atual (servidor ou setor)
  to_user VARCHAR(160) NOT NULL,                   -- novo responsável (servidor ou setor)
  to_user_id INT REFERENCES users(id) ON DELETE SET NULL, -- servidor que assina o termo, quando houver
  from_cc_id INT REFERENCES cost_centers(id),
  to_cc_id INT REFERENCES cost_centers(id),
  data DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Verificar transferência', 'Realizado', 'Recusado')),
  assinado_em TIMESTAMPTZ,
  assinado_por INT REFERENCES users(id),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX patrimonio_transf_data ON patrimonio_transferencias (data);
CREATE INDEX patrimonio_transf_code ON patrimonio_transferencias (upper(code));

CREATE TABLE patrimonio_termos (
  cost_center_id INT NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
  ym CHAR(7) NOT NULL,                             -- AAAA-MM
  emitido_em DATE NOT NULL,
  emitido_por INT REFERENCES users(id),
  PRIMARY KEY (cost_center_id, ym)
);
