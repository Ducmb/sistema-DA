import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, tokenStore } from './api.js';

/**
 * Sessão do usuário. O servidor é quem autoriza (403); aqui só se decide o que mostrar.
 * Inatividade: o servidor expira a sessão; o cliente também encerra ao atingir o tempo
 * configurado (geral.sessaoMin) para não deixar a tela aberta.
 */
const AuthCtx = createContext(null);
const THEME_KEY = 'DA_theme';

export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignora */ }
}
export const deviceTheme = () => { try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; } };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [endReason, setEndReason] = useState('');
  const lastAct = useRef(Date.now());

  const end = useCallback((reason) => {
    tokenStore.set('');
    setUser(null);
    setEndReason(reason || '');
    applyTheme(deviceTheme());
  }, []);

  const refresh = useCallback(async () => {
    const u = await api.get('/auth/me');
    setUser(u);
    if (u.preferences && u.preferences.theme) applyTheme(u.preferences.theme);
    return u;
  }, []);

  // Restaura sessão existente na aba
  useEffect(() => {
    if (!tokenStore.get()) { setReady(true); return; }
    refresh().catch(() => end('')).finally(() => setReady(true));
  }, [refresh, end]);

  // 401 vindo de qualquer chamada
  useEffect(() => {
    const on = (e) => end((e.detail && e.detail.code) || 'login');
    window.addEventListener('da:unauthorized', on);
    return () => window.removeEventListener('da:unauthorized', on);
  }, [end]);

  // Inatividade no cliente
  useEffect(() => {
    if (!user) return undefined;
    const touch = () => { lastAct.current = Date.now(); };
    const evs = ['click', 'keydown', 'pointermove', 'scroll', 'touchstart'];
    evs.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
    const idleMs = (user.settings && user.settings.sessaoMin ? user.settings.sessaoMin : 30) * 60000;
    let lastPing = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      if (now - lastAct.current > idleMs) { api.post('/auth/logout', undefined, { noAuthEvent: true }).catch(() => {}); end('expirada'); return; }
      // Mantém a sessão do servidor viva enquanto há atividade real
      if (lastAct.current > lastPing && now - lastPing > 60000) { lastPing = now; api.get('/auth/me').catch(() => {}); }
    }, 15000);
    return () => { evs.forEach((ev) => window.removeEventListener(ev, touch)); clearInterval(iv); };
  }, [user, end]);

  const login = useCallback(async (username, password) => {
    const r = await api.post('/auth/login', { username, password }, { noAuthEvent: true });
    tokenStore.set(r.token);
    lastAct.current = Date.now();
    setEndReason('');
    setUser(r.user);
    applyTheme((r.user.preferences && r.user.preferences.theme) || deviceTheme());
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout', undefined, { noAuthEvent: true }); } catch (e) { /* sessão já encerrada */ }
    end('');
  }, [end]);

  const setPreference = useCallback(async (patch) => {
    if (patch.theme) applyTheme(patch.theme);
    setUser((u) => (u ? { ...u, preferences: { ...u.preferences, ...patch } } : u));
    const r = await api.put('/auth/preferences', patch);
    setUser((u) => (u ? { ...u, preferences: r.preferences } : u));
  }, []);

  const replaceToken = useCallback((t) => tokenStore.set(t), []);

  const value = useMemo(() => ({
    user, ready, endReason, login, logout, refresh, setPreference, replaceToken,
    can: (mod) => !!user && user.modules.includes(mod),
    isAdmin: !!(user && user.isAdmin)
  }), [user, ready, endReason, login, logout, refresh, setPreference, replaceToken]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
