import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BREAKPOINT } from '../theme.js';

/** Largura < 900px (mobile). */
export function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < BREAKPOINT);
  useEffect(() => {
    const on = () => setM(window.innerWidth < BREAKPOINT);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return m;
}

/**
 * Carrega dados da API: { data, error, loading, reload, setData }.
 * `loader` recebe um AbortSignal; recarrega quando `deps` mudam.
 */
export function useApi(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const ref = useRef(loader);
  ref.current = loader;
  const ctrl = useRef(null);
  const run = useCallback((silent) => {
    if (ctrl.current) ctrl.current.abort();
    const c = new AbortController();
    ctrl.current = c;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    return Promise.resolve(ref.current(c.signal))
      .then((data) => { if (!c.signal.aborted) setState({ data, error: null, loading: false }); return data; })
      .catch((error) => { if (error.name !== 'AbortError' && !c.signal.aborted) setState((s) => ({ ...s, error, loading: false })); });
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(false); return () => ctrl.current && ctrl.current.abort(); }, deps);
  const setData = useCallback((fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })), []);
  return { ...state, reload: () => run(false), refresh: () => run(true), setData };
}

/** Executa periodicamente enquanto a aba está visível. */
export function useInterval(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!ms) return undefined;
    const iv = setInterval(() => { if (!document.hidden) ref.current(); }, ms);
    return () => clearInterval(iv);
  }, [ms]);
}

/** Parâmetro da URL como estado (abas e filtros com link direto, ex.: ?tab=contratos). */
export function useQueryState(key, def) {
  const [params, setParams] = useSearchParams();
  const v = params.get(key) || def;
  const set = useCallback((nv) => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (nv === def || nv == null || nv === '') n.delete(key); else n.set(key, nv);
      return n;
    }, { replace: true });
  }, [key, def, setParams]);
  return [v, set];
}

/** Valor com atraso (evita uma requisição por tecla digitada). */
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
