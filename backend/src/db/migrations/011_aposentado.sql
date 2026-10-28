-- Situação "Aposentado" (filtro do protótipo RHModule): vínculo encerrado, como "Desligado".
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_situacao_check;
ALTER TABLE users ALTER COLUMN situacao TYPE VARCHAR(12);
ALTER TABLE users ADD CONSTRAINT users_situacao_check CHECK (situacao IN ('Ativo', 'Afastado', 'Aposentado', 'Desligado'));
