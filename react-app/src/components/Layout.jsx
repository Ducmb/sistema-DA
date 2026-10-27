import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getSession, touchSession, endSession, canPath } from '../lib/session.js';
import { colors, fontSans } from '../theme.js';

const NAV_MAIN = [
  { to: '/dashboard', icon: '\u25A6', label: 'Painel de Controle' },
  { to: '/mocoes', icon: '\uD83C\uDF97', label: 'Mo\u00e7\u00f5es & Homenagens' },
  { to: '/almoxarifado', icon: '\uD83D\uDCE6', label: 'Almoxarifado' },
  { to: '/compras', icon: '\uD83D\uDED2', label: 'Compras & Licita\u00e7\u00f5es' },
  { to: '/patrimonio', icon: '\uD83C\uDFDB', label: 'Patrim\u00f4nio' },
].sort((a, b) => (a.to === '/dashboard' ? -1 : b.to === '/dashboard' ? 1 : a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' })));

const NAV_SECONDARY = [
  { to: '/compras/controle', icon: '\uD83D\uDCCA', label: 'Controle LICCONT' },
  { to: '/protocolo', icon: '\uD83D\uDCCB', label: 'Protocolo' },
  { to: '/rh', icon: '\uD83E\uDDD1\u200D\uD83D\uDCBC', label: 'Gest\u00e3o de Pessoal' },
  { to: '/analytics', icon: '\uD83D\uDCC8', label: 'Analytics' },
  { to: '/legislacoes', icon: '\u2696', label: 'Legisla\u00e7\u00f5es' }
].sort((a, b) => (a.to === '/dashboard' ? -1 : b.to === '/dashboard' ? 1 : a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' })));

export default function Layout({ children }) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const session = getSession() || { name: '', role: '' };
  const denied = new URLSearchParams(location.search).get('negado');
  const logout = (motivo) => { endSession(); navigate('/login' + (motivo ? '?motivo=' + motivo : ''), { replace: true }); };

  useEffect(() => {
    let last = 0;
    const onAct = () => { const n = Date.now(); if (n - last > 15000) { last = n; touchSession(); } };
    const evs = ['click', 'keydown', 'pointermove', 'scroll', 'touchstart'];
    evs.forEach(e => window.addEventListener(e, onAct, { passive: true }));
    const iv = setInterval(() => { if (!getSession()) logout('expirada'); }, 30000);
    return () => { evs.forEach(e => window.removeEventListener(e, onAct)); clearInterval(iv); };
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const linkStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 8,
    color: active ? colors.green : 'rgba(255,255,255,0.85)', textDecoration: 'none', fontSize: 13,
    fontWeight: active ? 700 : 600, backgroundColor: active ? colors.white : 'transparent'
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: colors.white, position: 'relative', fontFamily: fontSans }}>
      {isMobile && menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}
      <aside style={{
        backgroundColor: colors.green, color: colors.white, width: 250, flexShrink: 0,
        display: 'flex', flexDirection: 'column', padding: '24px 18px', gap: 28,
        position: isMobile ? 'fixed' : 'sticky', top: 0, left: 0, height: '100vh', zIndex: 50,
        transform: isMobile ? (menuOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
        transition: 'transform 0.3s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, backgroundColor: colors.white, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: colors.green, flexShrink: 0 }}>C</div>
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>C\u00c2MARA MUNICIPAL</p>
            <p style={{ fontSize: 9.5, letterSpacing: 0.4, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', margin: 0 }}>Diretoria Administrativa</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'rgba(255,255,255,0.5)', padding: '0 10px', margin: '0 0 6px' }}>Sistemas & Gest\u00e3o</p>
          {NAV_MAIN.filter(i => canPath(i.to)).map(item => (
            <Link key={item.to} to={item.to} style={linkStyle(location.pathname === item.to)}>{item.icon} {item.label}</Link>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'rgba(255,255,255,0.5)', padding: '0 10px', margin: '0 0 6px' }}>M\u00f3dulos Complementares</p>
          {NAV_SECONDARY.filter(i => canPath(i.to)).map(item => (
            <Link key={item.to} to={item.to} style={{ ...linkStyle(location.pathname === item.to), fontSize: 12.5 }}>{item.icon} {item.label}</Link>
          ))}
        </div>
        <Link to="/perfil" title="Meus Dados (Perfil)" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: '#F0B429', color: colors.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>RA</div>
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 700, margin: 0 }}>{session.name}</p>
            <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{session.role}</p>
          </div>
        </Link>
        <button onClick={() => logout()} style={{ height: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: colors.white, fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left', padding: '0 12px' }}>\u238B Sair do sistema</button>
      </aside>
      <main style={{ flex: 1, padding: isMobile ? '18px 16px 32px' : '28px 36px 40px', display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
        {isMobile && (
          <button onClick={() => setMenuOpen(true)} style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid #E0E0DE', backgroundColor: colors.white, fontSize: 18, cursor: 'pointer', alignSelf: 'flex-start' }}>\u2630</button>
        )}
        {denied && <div role="alert" style={{ backgroundColor: '#FDF3F2', color: '#B91C1C', border: '1px solid #F5C2C2', borderRadius: 8, padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>Acesso negado: seu perfil ({session.role}) n\u00e3o tem permiss\u00e3o para este m\u00f3dulo.</div>}
        {children}
      </main>
    </div>
  );
}
