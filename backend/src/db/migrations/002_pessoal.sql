-- Gestão de Pessoal: situação funcional, servidores sem acesso ao sistema, férias e licenças

ALTER TABLE users ADD COLUMN situacao VARCHAR(12) NOT NULL DEFAULT 'Ativo' CHECK (situacao IN ('Ativo', 'Afastado', 'Desligado'));
-- Servidor pode existir sem e-mail/acesso (cadastro funcional feito pela Gestão de Pessoal)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

CREATE TABLE rh_ausencias (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo VARCHAR(60) NOT NULL CHECK (tipo IN ('Férias', 'Licença Médica', 'Licença Maternidade', 'Licença Paternidade', 'Licença Capacitação', 'Licença para Tratar de Interesses Particulares')),
  inicio DATE NOT NULL,
  fim DATE NOT NULL CHECK (fim >= inicio),
  status VARCHAR(10) NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Aprovado', 'Recusado')),
  observacoes TEXT,
  solicitado_por INT REFERENCES users(id) ON DELETE SET NULL,
  solicitado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decidido_por INT REFERENCES users(id) ON DELETE SET NULL,
  decidido_em TIMESTAMPTZ
);
CREATE INDEX rh_ausencias_periodo ON rh_ausencias (inicio, fim);
