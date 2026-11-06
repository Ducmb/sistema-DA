-- Integração com a API de Dados Abertos do Compras.gov (CATMAT/CATSER):
-- cache local das consultas por código e hierarquia do catálogo gravada na despesa.

ALTER TABLE catalogo_itens
  ADD COLUMN ativo BOOLEAN,
  ADD COLUMN extra JSONB NOT NULL DEFAULT '{}'::jsonb,       -- seção/divisão/subclasse/CPC (serviços), NCM etc.
  ADD COLUMN fonte VARCHAR(6) NOT NULL DEFAULT 'local' CHECK (fonte IN ('local', 'api')),
  ADD COLUMN atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE catalogo_itens ALTER COLUMN nome TYPE VARCHAR(1000);

ALTER TABLE despesas
  ADD COLUMN pdm VARCHAR(10),
  ADD COLUMN catalogo_info JSONB;                                -- nomes de grupo/classe/PDM no momento do cadastro

ALTER TABLE catalogo_sync ADD COLUMN latencias JSONB NOT NULL DEFAULT '{}'::jsonb;
