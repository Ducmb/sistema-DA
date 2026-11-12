-- Assinatura eletrônica também no controle de saída de bandeiras (mesmos tablets pareados e mesmo registro de assinaturas).
ALTER TABLE chaves_assinaturas ALTER COLUMN tipo TYPE VARCHAR(20);
ALTER TABLE chaves_assinaturas DROP CONSTRAINT IF EXISTS chaves_assinaturas_tipo_check;
ALTER TABLE chaves_assinaturas ADD CONSTRAINT chaves_assinaturas_tipo_check
  CHECK (tipo IN ('retirada', 'devolucao', 'bandeira_retirada', 'bandeira_devolucao'));

ALTER TABLE bandeiras_emprestimos
  ADD COLUMN IF NOT EXISTS retirado_por VARCHAR(160),
  ADD COLUMN IF NOT EXISTS retirado_doc VARCHAR(40),
  ADD COLUMN IF NOT EXISTS retirada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entregue_por INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS assinatura_retirada UUID REFERENCES chaves_assinaturas(id),
  ADD COLUMN IF NOT EXISTS devolvido_por VARCHAR(160),
  ADD COLUMN IF NOT EXISTS devolucao_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recebido_por INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS assinatura_devolucao UUID REFERENCES chaves_assinaturas(id);
