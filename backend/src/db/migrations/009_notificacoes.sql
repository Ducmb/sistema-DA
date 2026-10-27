-- Central de Notificações: estado por usuário (lida/arquivada) dos alertas gerados pelos módulos.
-- Guarda uma cópia do alerta para que os arquivados continuem visíveis depois de resolvidos.

CREATE TABLE notification_state (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notif_id VARCHAR(120) NOT NULL,
  module VARCHAR(30) NOT NULL,
  level VARCHAR(10) NOT NULL,
  tipo VARCHAR(12) NOT NULL,
  title VARCHAR(300) NOT NULL,
  message VARCHAR(500) NOT NULL DEFAULT '',
  href VARCHAR(300) NOT NULL DEFAULT '',
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  emailed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, notif_id)
);
