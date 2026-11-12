import React, { useEffect, useRef, useState } from 'react';
import SignaturePad from '../../components/SignaturePad.jsx';
import { Segmented } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';

const MODO_KEY = 'DA_chaves_modo';
const lerModo = () => { try { return localStorage.getItem(MODO_KEY) || 'tela'; } catch (e) { return 'tela'; } };

/**
 * Coleta a assinatura do solicitante e conclui o registro.
 * - "Nesta tela": mesa digitalizadora/tablet de assinatura ligado ao computador (ou tela sensível ao toque).
 * - "No tablet": envia o pedido à estação tablet (/chaves/tablet) logada com o mesmo usuário e aguarda.
 * dados: corpo do pedido (tipo + campos); pronto: formulário válido; onConcluir(assinaturaId) grava o registro.
 */
export default function ColetaAssinatura({ dados, pronto, confirmarLabel, onConcluir }) {
  const [modo, setModo] = useState(lerModo);
  const [temTraco, setTemTraco] = useState(false);
  const [pedido, setPedido] = useState(null); // pedido enviado ao tablet
  const [restante, setRestante] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pad = useRef(null);
  const concluindo = useRef(false);

  const trocarModo = (m) => { setModo(m); setErr(''); try { localStorage.setItem(MODO_KEY, m); } catch (e) { /* sem storage */ } };

  const concluir = async (assinaturaId) => {
    if (concluindo.current) return;
    concluindo.current = true;
    try { await onConcluir(assinaturaId); } catch (e) { setErr(e.message); setPedido(null); concluindo.current = false; }
  };

  const assinarNaTela = async () => {
    if (pad.current.isEmpty()) { setErr('O solicitante precisa assinar no quadro.'); return; }
    setBusy(true); setErr('');
    try {
      const a = await api.post('/chaves/assinaturas', { ...dados, imagem: pad.current.toDataURL() });
      await concluir(a.id);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const enviarTablet = async () => {
    setBusy(true); setErr('');
    try { setPedido(await api.post('/chaves/assinaturas', dados)); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const cancelarTablet = async () => { if (pedido) api.del('/chaves/assinaturas/' + pedido.id).catch(() => {}); setPedido(null); };

  // Aguarda o tablet: consulta o pedido e conclui o registro assim que estiver assinado
  useEffect(() => {
    if (!pedido) return undefined;
    let vivo = true;
    const tick = async () => {
      setRestante(Math.max(0, Math.round((new Date(pedido.expiraEm) - Date.now()) / 1000)));
      try {
        const a = await api.get('/chaves/assinaturas/' + pedido.id, { background: true });
        if (!vivo) return;
        if (a.status === 'assinada') concluir(a.id);
        else if (a.status !== 'pendente') { setErr(a.status === 'expirada' ? 'O pedido expirou sem assinatura. Envie novamente.' : 'O pedido foi cancelado.'); setPedido(null); }
      } catch (e) { /* tenta de novo no próximo ciclo */ }
    };
    tick();
    const iv = setInterval(tick, 1500);
    return () => { vivo = false; clearInterval(iv); };
  }, [pedido]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fechar o modal com pedido em aberto cancela o pedido no tablet
  useEffect(() => () => { if (pedido && !concluindo.current) api.del('/chaves/assinaturas/' + pedido.id).catch(() => {}); }, [pedido]);

  const mmss = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  return (
    <section className="stack" style={{ gap: 12, padding: 16, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)' }}>
      <div className="row between">
        <h4 style={{ fontSize: 13.5, fontWeight: 700 }}>Assinatura - Solicitante</h4>
        <Segmented label="Onde assinar" value={modo} onChange={trocarModo} options={[{ value: 'tela', label: '✍ Nesta tela / mesa digitalizadora' }, { value: 'tablet', label: '📱 No tablet' }]} />
      </div>
      {modo === 'tela' ? (
        <>
          <SignaturePad ref={pad} height={190} label="Assinatura do solicitante" onChange={setTemTraco} disabled={!pronto || busy} />
          <div className="row between">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => pad.current && pad.current.clear()} disabled={busy}>Limpar</button>
            <button type="button" className="btn btn-primary" disabled={!pronto || !temTraco || busy} onClick={assinarNaTela}>{busy ? 'Registrando…' : confirmarLabel}</button>
          </div>
          <p className="hint">Use a caneta da mesa digitalizadora ou do tablet de assinatura ligado a este computador (ou o toque, em tela sensível).</p>
        </>
      ) : pedido ? (
        <div className="stack" role="status" aria-live="polite" style={{ gap: 10, alignItems: 'center', textAlign: 'center', padding: '18px 10px' }}>
          <span className="spinner" aria-hidden="true" style={{ fontSize: 28 }}>📱</span>
          <p style={{ fontWeight: 700 }}>Aguardando a assinatura no tablet…</p>
          <p className="muted" style={{ fontSize: 12.5 }}>O pedido aparece na estação tablet aberta com o seu usuário. Expira em {mmss(restante)}.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={cancelarTablet}>Cancelar pedido</button>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <p style={{ fontSize: 12.5 }}>O solicitante assina no tablet. No tablet, abra <strong>Controle de Chaves › Estação tablet</strong> com o seu usuário; o pedido aparece lá automaticamente e o registro é concluído aqui assim que ele assinar.</p>
          <div className="row between">
            <a className="link-btn" href="/chaves/tablet" target="_blank" rel="noopener">Abrir a estação tablet ↗</a>
            <button type="button" className="btn btn-primary" disabled={!pronto || busy} onClick={enviarTablet}>{busy ? 'Enviando…' : 'Enviar para o tablet'}</button>
          </div>
        </div>
      )}
      {err && <p role="alert" style={{ fontSize: 12.5, color: 'var(--crit-strong)', fontWeight: 600 }}>{err}</p>}
    </section>
  );
}
