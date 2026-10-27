import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fontSans } from '../theme.js';
import { startSession } from '../lib/session.js';

const MOCK_USERS = {
  admin: { pwd: '123456', user: { id: 1, name: 'Dr. Roberto Alencar', role: 'Administrativo' } },
  operador: { pwd: 'senha123', user: { id: 2, name: 'Ana Beatriz Silva', role: 'Operacional' } }
};

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('DA_user');
    if (saved) { setUsername(saved); setRemember(true); }
    const motivo = new URLSearchParams(window.location.search).get('motivo');
    if (motivo === 'expirada') setError('Sess\u00e3o expirada por inatividade. Entre novamente.');
    if (motivo === 'login') setError('Fa\u00e7a login para continuar.');
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) { setError('Informe usu\u00e1rio e senha'); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const mu = MOCK_USERS[username.trim().toLowerCase()];
      if (mu && mu.pwd === password) {
        startSession(mu.user, 'dev-token');
        if (remember) localStorage.setItem('DA_user', username); else localStorage.removeItem('DA_user');
        navigate('/dashboard');
      } else {
        setError('Usu\u00e1rio ou senha inv\u00e1lidos');
      }
    }, 600);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20, backgroundColor: colors.white, fontFamily: fontSans }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, backgroundColor: colors.green, borderRadius: 8, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.white, fontWeight: 'bold', fontSize: 28 }}>DA</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginTop: 16, color: colors.black }}>Sistema DA</h1>
          <p style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>C\u00e2mara Municipal \u2014 Diretoria Administrativa</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: colors.black }}>Usu\u00e1rio</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario" style={{ padding: '12px 14px', border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: colors.black }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022" style={{ width: '100%', padding: '12px 40px 12px 14px', border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: 15 }}>{showPassword ? '\uD83D\uDD13' : '\uD83D\uDD12'}</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: colors.black }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Lembrar-me
            </label>
            <a href="/esqueci-senha" onClick={(e) => { e.preventDefault(); navigate('/esqueci-senha'); }} style={{ fontSize: 12.5, color: colors.green, textDecoration: 'none' }}>Esqueci minha senha</a>
          </div>
          {error && <div style={{ padding: '10px 12px', backgroundColor: '#FEE', borderLeft: '3px solid #C33', borderRadius: 4, fontSize: 13, color: '#933' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ padding: '12px 16px', backgroundColor: loading ? colors.disabled : colors.green, color: colors.white, border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 16 }}>Teste: admin/123456 ou operador/senha123</p>
      </div>
    </div>
  );
}
