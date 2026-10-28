-- Log de auditoria somente de inclusão: registros não podem ser alterados.
-- (A exclusão fica restrita à rotina de retenção; em produção, conceda ao usuário da aplicação
--  apenas INSERT/SELECT/DELETE em audit_logs — ver backend/README.md.)

CREATE OR REPLACE FUNCTION audit_logs_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs é somente de inclusão';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_sem_update BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_imutavel();
