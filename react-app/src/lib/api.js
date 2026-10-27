/**
 * Cliente da API. O token fica em sessionStorage (encerra ao fechar a aba).
 * Respostas 401 disparam o evento 'da:unauthorized' para o AuthProvider encerrar a sessão.
 */
const BASE = import.meta.env.VITE_API_URL || '/api';
const KEY = 'DA_token';

export const tokenStore = {
  get: () => { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } },
  set: (t) => { try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch (e) { /* armazenamento indisponível */ } }
};

export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.error) || 'Erro de comunicação com o servidor.');
    this.status = status;
    this.body = body || {};
    this.fields = (body && body.fields) || {};
  }
}

async function request(method, path, body, opts = {}) {
  const headers = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = 'Bearer ' + token;
  if (opts.background) headers['X-Background'] = '1';
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload, signal: opts.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, { error: 'Sem conexão com o servidor. Verifique sua rede.' });
  }
  if (opts.raw) {
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
    return res;
  }
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (res.status === 401 && token && !opts.noAuthEvent) window.dispatchEvent(new CustomEvent('da:unauthorized', { detail: data || {} }));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (p, o) => request('GET', p, undefined, o),
  post: (p, b, o) => request('POST', p, b, o),
  put: (p, b, o) => request('PUT', p, b, o),
  patch: (p, b, o) => request('PATCH', p, b, o),
  del: (p, o) => request('DELETE', p, undefined, o),
  /** Baixa um arquivo (CSV/PDF) autenticado. */
  async download(path, filename) {
    const res = await request('GET', path, undefined, { raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || (/filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '') || [])[1] || 'arquivo';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  /** Abre um arquivo autenticado (ex.: PDF) em blob URL. */
  async blobUrl(path) {
    const res = await request('GET', path, undefined, { raw: true });
    return URL.createObjectURL(await res.blob());
  }
};

export const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? '?' + s : '';
};
