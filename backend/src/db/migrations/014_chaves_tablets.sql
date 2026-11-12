-- Tablets pareados (Android/iPad) que recebem automaticamente os pedidos de assinatura do Controle de Chaves.
-- O tablet é pareado uma vez com um código de uso único; depois usa um token de dispositivo (guardado só como hash).
CREATE TABLE IF NOT EXISTS chaves_tablets (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(80) NOT NULL,
  token_hash CHAR(64) UNIQUE,
  codigo_hash CHAR(64),
  codigo_expira TIMESTAMPTZ,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pareado_em TIMESTAMPTZ,
  ultimo_contato TIMESTAMPTZ,
  ultimo_ip VARCHAR(64),
  user_agent VARCHAR(300)
);
ALTER TABLE chaves_assinaturas ADD COLUMN IF NOT EXISTS tablet_id INTEGER REFERENCES chaves_tablets(id);
CREATE INDEX IF NOT EXISTS chaves_assinaturas_tablet_pend ON chaves_assinaturas (tablet_id) WHERE status = 'pendente';
