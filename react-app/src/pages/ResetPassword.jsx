import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { AuthCard } from './ForgotPassword.jsx';
import PasswordStrength, { checkPassword, usePasswordRules } from '../components/PasswordStrength.jsx';

/** Redefinição (link do e-mail) e definição de senha de novos servidores (convite). */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const convite = params.get('convite') === '1';
  const rules = usePasswordRules();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (checkPassword(p1, rules).some((r) => !r.ok)) { setError('A nova senha não atende a todos os requisitos.'); return; }
    if (p1 !== p2) { setError('A confirmação não confere com a nova senha.'); return; }
    setLoading(true); setError('');
    try { await api.post('/auth/reset-password', { token, password: p1 }); setDone(true); } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const title = convite ? 'Definir senha' : 'Nova senha';
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return <AuthCard title={title} subtitle="Link inválido"><div className="alert-box error">Link inválido ou incompleto. <Link to="/esqueci-senha">Solicite um novo link.</Link></div></AuthCard>;
  }
  return (
    <AuthCard title={title} subtitle={convite ? 'Crie a senha do seu primeiro acesso' : 'Crie uma nova senha para sua conta'}>
      {done ? (
        <div className="alert-box success" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 24 }}>
          <strong>✓ Senha definida com sucesso.</strong>
          <span style={{ color: 'var(--text-2)' }}>Por segurança, todas as sessões anteriores foram encerradas.</span>
          <Link to="/login" className="btn btn-primary" style={{ marginTop: 10 }}>Entrar</Link>
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
          <div className="field">
            <label htmlFor="rp-1">Nova senha</label>
            <input id="rp-1" className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={p1} onChange={(e) => { setP1(e.target.value); setError(''); }} placeholder={'Mínimo ' + rules.min + ' caracteres'} />
          </div>
          <div className="field">
            <label htmlFor="rp-2">Confirmar nova senha</label>
            <input id="rp-2" className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={p2} onChange={(e) => { setP2(e.target.value); setError(''); }} placeholder="Repita a nova senha" />
          </div>
          <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Mostrar senhas</label>
          <PasswordStrength value={p1} rules={rules} />
          {error && <div className="alert-box error" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading || !p1 || !p2}>{loading ? 'Salvando...' : 'Salvar senha'}</button>
        </form>
      )}
    </AuthCard>
  );
}
