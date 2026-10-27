-- Núcleo: centros de custo, usuários, perfis, sessões, auditoria, configurações

CREATE TABLE cost_centers (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nome VARCHAR(160) NOT NULL,
  tipo VARCHAR(12) NOT NULL DEFAULT 'padrao' CHECK (tipo IN ('padrao', 'patrimonio')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX cost_centers_nome_tipo ON cost_centers (lower(nome), tipo);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(160) NOT NULL UNIQUE,              -- e-mail institucional (somente admin altera)
  name VARCHAR(160) NOT NULL,                      -- somente admin altera
  registration VARCHAR(40) UNIQUE,                 -- matrícula (somente admin altera)
  position VARCHAR(120),                           -- cargo funcional (somente admin altera)
  hierarchy VARCHAR(20) NOT NULL DEFAULT 'Funcionário' CHECK (hierarchy IN ('Diretoria', 'Chefia', 'Funcionário')),
  department VARCHAR(160),                         -- lotação (nome do centro de custo)
  phone VARCHAR(20),
  personal_email VARCHAR(160),
  birthday DATE,
  status VARCHAR(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  password_hash VARCHAR(100) NOT NULL,
  token_version INT NOT NULL DEFAULT 0,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,  -- tema, exercício fiscal etc.
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vários perfis por usuário
CREATE TABLE user_roles (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL CHECK (role IN ('Administrativo', 'Compras', 'Almoxarifado', 'Patrimônio', 'Gerenciamento', 'Visualizador')),
  PRIMARY KEY (user_id, role)
);

-- Permissões individuais por módulo (prevalecem sobre os perfis, exceto auditoria e configurações)
CREATE TABLE user_module_overrides (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module VARCHAR(30) NOT NULL,
  allowed BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, module)
);

-- Matriz perfil × módulo editável em Configurações (sem linha = padrão do sistema)
CREATE TABLE role_modules (
  role VARCHAR(30) NOT NULL,
  module VARCHAR(30) NOT NULL,
  PRIMARY KEY (role, module)
);
CREATE TABLE role_modules_custom (
  role VARCHAR(30) PRIMARY KEY
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason VARCHAR(40),
  ip VARCHAR(64),
  user_agent TEXT
);
CREATE INDEX sessions_user ON sessions (user_id);

-- Bloqueio por tentativas (chave = usuário digitado, normalizado; existe ou não)
CREATE TABLE login_attempts (
  username_key VARCHAR(160) PRIMARY KEY,
  failures INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tokens de redefinição (RF03): só o hash SHA-256; uso único; expiração curta
CREATE TABLE password_resets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  purpose VARCHAR(12) NOT NULL DEFAULT 'reset' CHECK (purpose IN ('reset', 'convite')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX password_resets_user ON password_resets (user_id);

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(160) NOT NULL DEFAULT 'desconhecido',
  user_role VARCHAR(160) NOT NULL DEFAULT '—',
  action VARCHAR(120) NOT NULL,
  module VARCHAR(30) NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  level VARCHAR(10) NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'critical')),
  device VARCHAR(20),
  ip VARCHAR(64),
  user_agent TEXT,
  target_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  changes JSONB
);
CREATE INDEX audit_logs_ts ON audit_logs (ts DESC);
CREATE INDEX audit_logs_module ON audit_logs (module);
CREATE INDEX audit_logs_target ON audit_logs (target_user_id);

CREATE TABLE system_config (
  key VARCHAR(60) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INT REFERENCES users(id) ON DELETE SET NULL
);

-- Cadastro único de vereadores (autores de moções, homenagens, arranjos e bandeiras)
CREATE TABLE vereadores (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX vereadores_nome ON vereadores (lower(nome));
