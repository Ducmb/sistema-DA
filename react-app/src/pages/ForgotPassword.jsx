import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { EMAIL_RE } from '../lib/format.js';
import { Loader } from '../components/ui.jsx';

export function AuthCard({ title, subtitle, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20, background: 'var(--bg)' }}>
      <div style={{ animation: 'fadeIn 0.6s ease-out', width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 60, height: 60, background: '#1C543A', borderRadius: 8, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: 28 }}>DA</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 16 }}>{title}</h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4 }}>{subtitle}</p>
        </div>
        {children}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/login" style={{ fontSize: 13, textDecoration: 'none' }}>← Voltar ao login</Link>
        </div>
      </div>
    </div>
  );
}

/** Recuperar senha (RF03): resposta sempre igual, exista ou não o e-mail. */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    await api.post('/auth/forgot-password', { email: email.trim() });
  };
  const submit = async (e) => {
    e.preventDefault();
    const v = email.trim();
    if (!v) { setError('Informe o e-mail cadastrado'); return; }
    if (!EMAIL_RE.test(v)) { setError('E-mail inválido'); return; }
    setLoading(true); setError('');
    try { await send(); setSent(true); } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  const resend = async () => {
    setResent(false);
    try { await send(); setResent(true); } catch (err) { setError(err.message); }
  };

  return (
    <AuthCard title="Recuperar senha" subtitle="Informe seu e-mail cadastrado para receber o link de redefinição">
      {!sent ? (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
          <div className="field">
            <label htmlFor="fp-email" style={{ fontSize: 13, fontWeight: 500 }}>E-mail cadastrado</label>
            <input id="fp-email" className="input" type="email" autoComplete="email" placeholder="nome@camara.gov.br" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
          </div>
          {error && <div className="alert-box error" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ fontSize: 15, fontWeight: 600 }}>{loading ? 'Enviando...' : 'Enviar link de redefinição'}</button>
          {loading && <Loader />}
        </form>
      ) : (
        <div style={{ textAlign: 'center', padding: '28px 20px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>✓</div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Verifique seu e-mail</h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.5 }}>Se <strong>{email}</strong> constar na base de dados, um link único e temporário de redefinição de senha foi enviado.</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>O link expira em 30 minutos. Verifique também a caixa de spam.</p>
          <button type="button" className="btn btn-outline" style={{ marginTop: 18 }} onClick={resend}>Reenviar e-mail</button>
          {resent && <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 10, fontWeight: 600 }}>E-mail reenviado.</p>}
          {error && <p className="field-error" style={{ marginTop: 10 }}>{error}</p>}
        </div>
      )}
    </AuthCard>
  );
}
