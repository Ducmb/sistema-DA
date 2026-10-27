import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, applyTheme, deviceTheme } from '../lib/auth.jsx';
import { homePath } from '../lib/nav.js';

const REMEMBER = 'DA_user';
const MOTIVOS = { expirada: 'Sessão expirada por inatividade. Entre novamente.', login: 'Faça login para continuar.' };

/** Tela 01 — Login (RF01–RF02). */
export default function Login() {
  const { login, user, ready } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(MOTIVOS[params.get('motivo')] || '');
  const [theme, setTheme] = useState(deviceTheme());

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(REMEMBER));
      if (s && s.rememberMe && s.username) { setUsername(s.username); setRemember(true); }
    } catch (e) { /* sem dados salvos */ }
  }, []);

  if (ready && user) return <Navigate to={homePath((m) => user.modules.includes(m))} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Preencha todos os campos'); return; }
    setLoading(true); setError('');
    try {
      const u = await login(username.trim(), password);
      try {
        if (remember) localStorage.setItem(REMEMBER, JSON.stringify({ username: username.trim(), rememberMe: true }));
        else localStorage.removeItem(REMEMBER);
      } catch (er) { /* armazenamento indisponível */ }
      const volta = params.get('volta');
      nav(volta && volta.startsWith('/') && !volta.startsWith('//') ? volta : homePath((m) => u.modules.includes(m)), { replace: true });
    } catch (err) {
      setError(err.message || 'Erro ao fazer login. Tente novamente.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); applyTheme(t); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20, background: 'var(--bg)' }}>
      <div style={{ animation: 'fadeIn 0.6s ease-out', width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 60, height: 60, background: '#1C543A', borderRadius: 8, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: 28 }}>DA</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 16 }}>Sistema DA</h1>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 4 }}>Diretoria Administrativa</p>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
          <div className="field">
            <label htmlFor="login-user" style={{ fontSize: 13, fontWeight: 500 }}>Usuário</label>
            <input id="login-user" className="input" type="text" autoComplete="username" placeholder="Digite seu usuário" value={username} onChange={(e) => { setUsername(e.target.value); setError(''); }} />
          </div>
          <div className="field">
            <label htmlFor="login-pass" style={{ fontSize: 13, fontWeight: 500 }}>Senha</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input id="login-pass" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Digite sua senha" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} style={{ paddingRight: 48 }} />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} style={{ position: 'absolute', right: 2, width: 44, height: 40, background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 16 }}>{show ? '🔓' : '🔒'}</button>
            </div>
          </div>
          <label className="check" style={{ margin: '4px 0' }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Lembrar meus dados
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
        <div className="row between" style={{ marginTop: 16 }}>
          <Link to="/esqueci-senha" style={{ fontSize: 13, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Esqueci minha senha</Link>
          <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Usar modo padrão' : 'Usar modo escuro'} style={{ background: 'none', border: 'none', fontSize: 16, width: 44, height: 44 }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
        </div>
        {error && <div role="alert" style={{ marginTop: 16, padding: '12px 14px', background: 'var(--crit-bg)', borderLeft: '3px solid var(--crit-strong)', borderRadius: 4, fontSize: 13, color: 'var(--crit)' }}>{error}</div>}
      </div>
    </div>
  );
}
