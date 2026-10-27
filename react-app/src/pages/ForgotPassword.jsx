import React, { useState } from 'react';
import { colors, fontSans } from '../theme.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('E-mail inv\u00e1lido'); return; }
    setError(''); setLoading(true);
    setTimeout(() => { setLoading(false); setSent(true); }, 900);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20, backgroundColor: colors.white, fontFamily: fontSans }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, backgroundColor: colors.green, borderRadius: 8, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.white, fontWeight: 'bold', fontSize: 28 }}>DA</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginTop: 16 }}>Recuperar senha</h1>
          <p style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>Informe seu e-mail cadastrado</p>
        </div>
        {!sent ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="nome@camara.gov.br" style={{ padding: '12px 14px', border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 14 }} />
            {error && <div style={{ padding: '10px 12px', backgroundColor: '#FEE', borderLeft: '3px solid #C33', borderRadius: 4, fontSize: 13, color: '#933' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ padding: '12px 16px', backgroundColor: loading ? colors.disabled : colors.green, color: colors.white, border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Enviando...' : 'Enviar link de redefini\u00e7\u00e3o'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '28px 20px', border: '1px solid #E8E8E8', borderRadius: 8, backgroundColor: '#F9F9F9' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(28,84,58,0.1)', color: colors.green, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>\u2713</div>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Verifique seu e-mail</h2>
            <p style={{ fontSize: 13, color: '#666', marginTop: 8 }}>Se <strong>{email}</strong> constar na base, um link foi enviado.</p>
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/login" style={{ fontSize: 13, color: colors.green, textDecoration: 'none' }}>\u2190 Voltar ao login</a>
        </div>
      </div>
    </div>
  );
}
