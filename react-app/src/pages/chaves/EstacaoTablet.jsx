import React, { useCallback, useEffect, useRef, useState } from 'react';
import SignaturePad from '../../components/SignaturePad.jsx';
import { fmtDate, fmtDateTime } from '../../lib/format.js';

/**
 * Tablet de assinatura (Android/iPad) do Controle de Chaves.
 * Pareado UMA vez (QR code ou código mostrado no computador); depois fica sempre nesta tela, sem login,
 * e o documento aparece sozinho quando o computador pede a assinatura. O token do aparelho fica no
 * armazenamento local do navegador do tablet e só dá acesso aos pedidos enviados a ele.
 */
const BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'DA_tablet_token';
const NOME_KEY = 'DA_tablet_nome';
const ler = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const gravar = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* sem storage */ } };

async function chamar(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = 'Tablet ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try { res = await fetch(BASE + '/tablet' + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); } catch (e) {
    const er = new Error('Sem conexão com o servidor.'); er.status = 0; throw er;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const er = new Error(data.error || 'Erro de comunicação com o servidor.'); er.status = res.status; throw er; }
  return data;
}

/** Mantém a tela do tablet acesa enquanto a estação estiver aberta (quando o navegador permite). */
function useTelaAcesa() {
  useEffect(() => {
    let lock = null, vivo = true;
    const pedir = async () => {
      try { if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch (e) { /* sem suporte */ }
      if (!vivo && lock) lock.release().catch(() => {});
    };
    pedir();
    const vis = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', vis);
    return () => { vivo = false; document.removeEventListener('visibilitychange', vis); if (lock) lock.release().catch(() => {}); };
  }, []);
}

export default function EstacaoTablet() {
  const [token, setToken] = useState(() => ler(TOKEN_KEY));
  const [nome, setNome] = useState(() => ler(NOME_KEY));
  useEffect(() => { document.title = 'Tablet de assinatura — Chaves e Bandeiras'; }, []);
  useTelaAcesa();

  const pareado = (t, n) => { gravar(TOKEN_KEY, t); gravar(NOME_KEY, n); setToken(t); setNome(n); };
  const desparear = useCallback(() => { gravar(TOKEN_KEY, ''); gravar(NOME_KEY, ''); setToken(''); setNome(''); }, []);

  return token ? <Estacao token={token} nome={nome} onDesparear={desparear} onNome={setNome} /> : <Pareamento onPareado={pareado} />;
}

function Pareamento({ onPareado }) {
  const inicial = new URLSearchParams(window.location.search).get('codigo') || '';
  const [codigo, setCodigo] = useState(inicial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const auto = useRef(false);

  const parear = useCallback(async (c) => {
    setBusy(true); setErr('');
    try {
      const r = await chamar('/parear', { method: 'POST', body: { codigo: c } });
      window.history.replaceState(null, '', window.location.pathname); // tira o código da barra de endereço
      onPareado(r.token, r.nome);
    } catch (e) { setErr(e.message); setBusy(false); }
  }, [onPareado]);

  // Aberto pelo QR code: pareia sozinho
  useEffect(() => { if (inicial && !auto.current) { auto.current = true; parear(inicial); } }, [inicial, parear]);

  return (
    <div className="tablet-station">
      <div className="tablet-center">
        <p style={{ fontSize: 52 }} aria-hidden="true">🔑</p>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Parear tablet de assinatura</h1>
        <p className="muted" style={{ maxWidth: 520 }}>No computador, abra <strong>Controle de Chaves › Tablets</strong>, clique em <strong>“+ Parear tablet”</strong> e leia o QR code com a câmera deste tablet — ou digite abaixo o código mostrado. Isso é feito uma única vez.</p>
        <form className="stack" style={{ gap: 12, width: '100%', maxWidth: 360 }} onSubmit={(e) => { e.preventDefault(); parear(codigo); }}>
          <label htmlFor="tab-codigo" className="sr-only">Código de pareamento</label>
          <input id="tab-codigo" className="input" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" maxLength={12}
            autoComplete="off" autoCapitalize="characters" spellCheck={false} style={{ fontSize: 26, letterSpacing: 4, textAlign: 'center', fontWeight: 700, minHeight: 56 }} />
          <button type="submit" className="btn btn-primary" disabled={busy || codigo.replace(/[^A-Za-z0-9]/g, '').length !== 8} style={{ minHeight: 48 }}>{busy ? 'Pareando…' : 'Parear este tablet'}</button>
          {err && <p role="alert" style={{ color: 'var(--crit-strong)', fontWeight: 600 }}>{err}</p>}
        </form>
      </div>
    </div>
  );
}

function Estacao({ token, nome, onDesparear, onNome }) {
  const [pedido, setPedido] = useState(null);
  const [fase, setFase] = useState('aguardando'); // aguardando | assinando | enviando | ok
  const [temTraco, setTemTraco] = useState(false);
  const [err, setErr] = useState('');
  const [conexao, setConexao] = useState(true);
  const pad = useRef(null);
  const faseRef = useRef(fase); faseRef.current = fase;
  const pedidoRef = useRef(pedido); pedidoRef.current = pedido;

  useEffect(() => {
    let vivo = true;
    const tick = async () => {
      if (faseRef.current === 'enviando' || faseRef.current === 'ok') return;
      try {
        const r = await chamar('/pedido', { token });
        if (!vivo) return;
        setConexao(true);
        if (r.tablet && r.tablet.nome !== nome) { onNome(r.tablet.nome); gravar(NOME_KEY, r.tablet.nome); }
        if (faseRef.current === 'enviando' || faseRef.current === 'ok') return;
        const atual = pedidoRef.current, novo = r.pedido;
        if (!novo) { if (atual) { setPedido(null); setFase('aguardando'); setErr(''); } return; }
        if (!atual || atual.id !== novo.id) { setPedido(novo); setFase('assinando'); setErr(''); setTemTraco(false); if (pad.current) pad.current.clear(); }
      } catch (e) {
        if (!vivo) return;
        if (e.status === 401) onDesparear(); // tablet removido ou pareado de novo em outro aparelho
        else setConexao(false);
      }
    };
    tick();
    const iv = setInterval(tick, 2000);
    return () => { vivo = false; clearInterval(iv); };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmar = async () => {
    if (!pad.current || pad.current.isEmpty()) { setErr('Assine no quadro antes de confirmar.'); return; }
    setFase('enviando'); setErr('');
    try {
      await chamar(`/pedido/${pedido.id}/assinar`, { method: 'POST', token, body: { imagem: pad.current.toDataURL() } });
      setFase('ok');
      setTimeout(() => { setPedido(null); setFase('aguardando'); }, 3500);
    } catch (e) {
      if (e.status === 401) { onDesparear(); return; }
      setErr(e.message); setFase(e.status === 409 ? 'aguardando' : 'assinando');
      if (e.status === 409) setPedido(null);
    }
  };

  const telaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  };
  const sair = () => { if (window.confirm('Desconectar este tablet? Será preciso pareá-lo de novo pelo computador.')) onDesparear(); };

  const x = pedido && pedido.exibicao; // título, campos e declaração montados pelo servidor
  return (
    <div className="tablet-station">
      <header className="row between tablet-top">
        <div className="row" style={{ gap: 10 }}>
          <span aria-hidden="true" style={{ fontSize: 22 }}>🔑</span>
          <div>
            <p style={{ fontWeight: 800 }}>Assinatura eletrônica — Chaves e Bandeiras</p>
            <p className="muted" style={{ fontSize: 12 }}>{nome || 'Tablet de assinatura'} · {conexao ? <span style={{ color: 'var(--success, #1a7f37)' }}>● conectado</span> : <span style={{ color: 'var(--crit-strong)' }}>● sem conexão</span>}</p>
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={telaCheia}>⛶ Tela cheia</button>
      </header>

      {fase === 'ok' ? (
        <div className="tablet-center" role="status">
          <p style={{ fontSize: 56 }} aria-hidden="true">✅</p>
          <p style={{ fontSize: 22, fontWeight: 800 }}>Assinatura registrada. Obrigado!</p>
          <p className="muted">Pode devolver o tablet ao responsável.</p>
        </div>
      ) : !pedido ? (
        <div className="tablet-center" role="status" aria-live="polite">
          <p style={{ fontSize: 56 }} aria-hidden="true">📱</p>
          <p style={{ fontSize: 20, fontWeight: 700 }}>Aguardando documento para assinatura…</p>
          <p className="muted" style={{ maxWidth: 480 }}>Deixe esta tela aberta. Quando o responsável pedir a assinatura no computador, o documento aparece aqui automaticamente.</p>
          {err && <p role="alert" style={{ color: 'var(--crit-strong)', fontWeight: 600 }}>{err}</p>}
          <button type="button" className="link-btn" style={{ marginTop: 24, fontSize: 12 }} onClick={sair}>Desconectar este tablet</button>
        </div>
      ) : (
        <main className="tablet-doc">
          <h1>{x.titulo}</h1>
          <dl className="tablet-resumo">
            {x.campos.map(([rotulo, valor, tipo]) => (
              <div key={rotulo}><dt>{rotulo}</dt><dd>{tipo === 'datahora' ? fmtDateTime(valor) : tipo === 'data' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? fmtDate(valor) : valor}</dd></div>
            ))}
          </dl>
          <p style={{ fontSize: 13 }}>{x.declaracao}</p>
          <SignaturePad ref={pad} height={260} label={'Assinatura — ' + x.titulo} onChange={setTemTraco} disabled={fase === 'enviando'} />
          {err && <p role="alert" style={{ color: 'var(--crit-strong)', fontWeight: 600 }}>{err}</p>}
          <div className="row between">
            <button type="button" className="btn btn-secondary" onClick={() => pad.current && pad.current.clear()} disabled={fase === 'enviando'}>Limpar</button>
            <button type="button" className="btn btn-primary" style={{ minWidth: 180 }} disabled={!temTraco || fase === 'enviando'} onClick={confirmar}>{fase === 'enviando' ? 'Enviando…' : 'Confirmar assinatura'}</button>
          </div>
          <p className="hint">Assinatura eletrônica simples (Lei nº 14.063/2020). O traço é vinculado a este documento com data, hora e dispositivo.</p>
        </main>
      )}
    </div>
  );
}
