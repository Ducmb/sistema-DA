import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { menu, searchScreens, screenByPath } from '../lib/nav.js';
import { initials } from '../lib/format.js';
import { useInterval, useIsMobile } from '../lib/hooks.js';
import { api } from '../lib/api.js';
import { MODULE_NAMES } from '../lib/modules.js';

/** Shell único das telas autenticadas: menu lateral, barra superior com busca e notificações. */
export default function Layout({ children }) {
  const { user, logout, can, setPreference } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);
  const [denied, setDenied] = useState('');

  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    const neg = new URLSearchParams(loc.search).get('negado');
    if (!neg) return undefined;
    setDenied(neg);
    const p = new URLSearchParams(loc.search); p.delete('negado');
    nav({ pathname: loc.pathname, search: p.toString() }, { replace: true });
    const t = setTimeout(() => setDenied(''), 5000);
    return () => clearTimeout(t);
  }, [loc.search, loc.pathname, nav]);

  const loadUnread = () => { if (can('notificacoes')) api.get('/notifications/summary', { background: true }).then((r) => setUnread(r.unread)).catch(() => {}); };
  useEffect(loadUnread, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useInterval(loadUnread, 60000);

  const groups = useMemo(() => menu(can), [can]);
  const current = screenByPath(loc.pathname);
  const dark = user.preferences && user.preferences.theme === 'dark';

  return (
    <div className="app">
      {isMobile && open && <div className="overlay" onClick={() => setOpen(false)} />}
      <aside className={'sidebar' + (open ? ' open' : '')} aria-label="Menu principal" aria-hidden={isMobile && !open ? true : undefined}>
        <Link to="/painel" className="brand" title="Voltar ao Painel de Controle">
          <div className="brand-mark">DA</div>
          <div><p className="brand-name">CÂMARA MUNICIPAL</p><p className="brand-sub">Diretoria Administrativa</p></div>
        </Link>
        {groups.map((g) => (
          <nav key={g.key} className="nav-group" aria-label={g.label}>
            <p className="nav-title">{g.label}</p>
            {g.items.map((s) => (
              <NavLink key={s.path} to={s.path} className={({ isActive }) => 'nav-link' + (g.key === 'comp' ? ' sm' : '') + (isActive ? ' active' : '')}>
                <span className="nav-ico" aria-hidden="true">{s.icon}</span>{s.label}
              </NavLink>
            ))}
          </nav>
        ))}
        <div className="side-foot">
          <Link to="/perfil" className="side-user" title="Meus Dados (Perfil)">
            <div className="avatar">{initials(user.name)}</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700 }}>{user.name}</p>
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)' }}>{[user.registration, user.hierarchy].filter(Boolean).join(' · ')}</p>
            </div>
          </Link>
          <div className="theme-switch" role="group" aria-label="Aparência">
            <span>Aparência</span>
            <div className="pill">
              <button type="button" aria-pressed={!dark} aria-label="Modo padrão" title="Modo padrão" onClick={() => setPreference({ theme: 'light' })}>☀</button>
              <button type="button" aria-pressed={dark} aria-label="Modo escuro" title="Modo escuro" onClick={() => setPreference({ theme: 'dark' })}>☾</button>
            </div>
          </div>
          <button type="button" className="logout" onClick={() => logout().then(() => nav('/login', { replace: true }))} title={'Encerrar sessão de ' + user.name}>
            <span className="nav-ico" aria-hidden="true">⎋</span>Sair do sistema
          </button>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="row" style={{ minWidth: 0, flexWrap: 'nowrap' }}>
            {isMobile ? (
              <>
                <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}>☰</button>
                <Link to="/painel" className="mini-brand" title="Painel de Controle">DA</Link>
              </>
            ) : (
              <nav className="crumbs" aria-label="Você está em">
                <Link to="/painel">Painel de Controle</Link>
                <span style={{ color: 'var(--disabled)' }}>›</span>
                <strong>{current && current.path !== '/painel' ? current.label : 'Visão Geral'}</strong>
              </nav>
            )}
          </div>
          <div className="row" style={{ flex: 1, justifyContent: 'flex-end', minWidth: 0, flexWrap: 'nowrap' }}>
            <GlobalSearch can={can} />
            {can('notificacoes') && (
              <Link to="/notificacoes" className="icon-btn" title="Notificações" aria-label={unread ? `Notificações (${unread} não lidas)` : 'Notificações'}>
                🔔{unread > 0 && <span className="dot" />}
              </Link>
            )}
          </div>
        </header>
        {denied && (
          <div role="alert" className="toast error" style={{ top: 76 }}>
            Acesso negado: seu perfil ({user.role}) não tem permissão para {MODULE_NAMES[denied] || denied}.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Busca global (spec 2.3): nome e palavras-chave, sem acentos; Enter abre o 1º resultado, Esc limpa. */
function GlobalSearch({ can }) {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);
  const [sel, setSel] = useState(0);
  const nav = useNavigate();
  const results = searchScreens(q, can);
  const go = (s) => { setQ(''); setFocus(false); nav(s.path); };
  return (
    <div className="search">
      <input type="search" placeholder="Buscar módulos e telas…" aria-label="Busca global" value={q}
        onChange={(e) => { setQ(e.target.value); setSel(0); setFocus(true); }}
        onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results.length) go(results[sel] || results[0]);
          if (e.key === 'Escape') { setQ(''); setFocus(false); }
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
        }} />
      <span className="ico" aria-hidden="true">⌕</span>
      {focus && q.trim() && (
        <div className="search-pop" role="listbox">
          {results.map((r, i) => (
            <a key={r.path} href={r.path} role="option" aria-selected={i === sel} className={i === sel ? 'sel' : ''} onMouseDown={(e) => { e.preventDefault(); go(r); }}>
              <span style={{ width: 20, textAlign: 'center' }} aria-hidden="true">{r.icon}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{r.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.groupLabel}</span>
            </a>
          ))}
          {!results.length && <p style={{ padding: '12px 10px', fontSize: 12.5, color: 'var(--text-3)' }}>Nenhum resultado para “{q}”</p>}
        </div>
      )}
    </div>
  );
}

/** Cabeçalho de página: eyebrow + título + ações. */
export function PageHeader({ section, title, desc, children, eyebrow }) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{eyebrow || <>Sistema de Gestão Integrada &nbsp;•&nbsp; {section}</>}</p>
        <h1 className="page-title">{title}</h1>
        {desc && <p className="page-desc">{desc}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}
