import React, { useEffect, useRef, useState } from 'react';
import SignaturePad from '../../components/SignaturePad.jsx';
import { Segmented } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/hooks.js';

const MODO_KEY = 'DA_chaves_modo';
const TABLET_KEY = 'DA_chaves_tablet';
const ler = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem storage */ } };

/**
 * Coleta a assinatura do solicitante e conclui o registro.
 * - "Tablet" (padrão): o pedido vai sozinho para o tablet pareado escolhido (Android/iPad que fica com a
 *   tela de assinatura aberta); o registro é concluído aqui assim que o solicitante confirma.
 * - "Nesta tela": quadro de assinatura no próprio formulário (mesa digitalizadora ou tela sensível ao toque).
 * dados: corpo do pedido (tipo + campos); pronto: formulário válido; onConcluir(assinaturaId) grava o registro.
 */
export default function ColetaAssinatura({ dados, pronto, confirmarLabel, onConcluir, onParear }) {
  const [modo, setModo] = useState(() => (ler(MODO_KEY, 'tablet') === 'tela' ? 'tela' : 'tablet'));
  const tablets = useApi(() => api.get('/chaves/tablets'), []);
  const pareados = (tablets.data || []).filter((t) => t.pareado);
  const [tabletId, setTabletId] = useState(() => ler(TABLET_KEY, ''));
  const tablet = pareados.find((t) => String(t.id) === String(tabletId)) || pareados[0];
  const [temTraco, setTemTraco] = useState(false);
  const [pedido, setPedido] = useState(null);
  const [restante, setRestante] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pad = useRef(null);
  const concluindo = useRef(false);

  const trocarModo = (m) => { setModo(m); setErr(''); gravar(MODO_KEY, m); };
  const escolherTablet = (id) => { setTabletId(id); gravar(TABLET_KEY, id); };

  const concluir = async (assinaturaId) => {
    if (concluindo.current) return;
    concluindo.current = true;
    try { await onConcluir(assinaturaId); } catch (e) { concluindo.current = false; throw e; }
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
    try { setPedido(await api.post('/chaves/assinaturas', { ...dados, tabletId: tablet.id })); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const cancelarTablet = () => { if (pedido) api.del('/chaves/assinaturas/' + pedido.id).catch(() => {}); setPedido(null); };

  // Aguarda o tablet: consulta o pedido e conclui o registro assim que estiver assinado
  useEffect(() => {
    if (!pedido) return undefined;
    let vivo = true;
    const tick = async () => {
      setRestante(Math.max(0, Math.round((new Date(pedido.expiraEm) - Date.now()) / 1000)));
      try {
        const a = await api.get('/chaves/assinaturas/' + pedido.id, { background: true });
        if (!vivo) return;
        if (a.status === 'assinada') concluir(a.id).catch((e) => { setErr(e.message); setPedido(null); });
        else if (a.status !== 'pendente') { setErr(a.status === 'expirada' ? 'O pedido expirou sem assinatura. Envie novamente.' : 'O pedido foi cancelado.'); setPedido(null); }
      } catch (e) { /* tenta de novo no próximo ciclo */ }
    };
    tick();
    const iv = setInterval(tick, 1500);
    return () => { vivo = false; clearInterval(iv); };
  }, [pedido]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fechar o formulário com pedido em aberto cancela o pedido (o tablet volta a aguardar)
  useEffect(() => () => { if (pedido && !concluindo.current) api.del('/chaves/assinaturas/' + pedido.id).catch(() => {}); }, [pedido]);

  const mmss = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  return (
    <section className="stack" style={{ gap: 12, padding: 16, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)' }}>
      <div className="row between">
        <h4 style={{ fontSize: 13.5, fontWeight: 700 }}>Assinatura - Solicitante</h4>
        <Segmented label="Onde assinar" value={modo} onChange={trocarModo} options={[{ value: 'tablet', label: '📱 No tablet' }, { value: 'tela', label: '✍ Nesta tela' }]} />
      </div>
      {modo === 'tela' && (
        <>
          <SignaturePad ref={pad} height={190} label="Assinatura do solicitante" onChange={setTemTraco} disabled={!pronto || busy} />
          <div className="row between">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => pad.current && pad.current.clear()} disabled={busy}>Limpar</button>
            <button type="button" className="btn btn-primary" disabled={!pronto || !temTraco || busy} onClick={assinarNaTela}>{busy ? 'Registrando…' : confirmarLabel}</button>
          </div>
          <p className="hint">Use a caneta da mesa digitalizadora ligada a este computador ou o toque, em tela sensível.</p>
        </>
      )}
      {modo === 'tablet' && (pedido ? (
        <div className="stack" role="status" aria-live="polite" style={{ gap: 10, alignItems: 'center', textAlign: 'center', padding: '18px 10px' }}>
          <span aria-hidden="true" style={{ fontSize: 28 }}>📱</span>
          <p style={{ fontWeight: 700 }}>Aguardando a assinatura em “{tablet ? tablet.nome : 'tablet'}”…</p>
          <p className="muted" style={{ fontSize: 12.5 }}>O documento apareceu no tablet. O registro é concluído aqui assim que o solicitante confirmar. Expira em {mmss(restante)}.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={cancelarTablet}>Cancelar pedido</button>
        </div>
      ) : tablets.loading ? <p className="muted" style={{ fontSize: 12.5 }}>Carregando tablets…</p> : !pareados.length ? (
        <div className="stack" style={{ gap: 8 }}>
          <p style={{ fontSize: 12.5 }}>Nenhum tablet pareado ainda. Pareie o tablet uma única vez (QR code) e depois os pedidos de assinatura aparecem nele automaticamente.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>{onParear && <button type="button" className="btn btn-secondary btn-sm" onClick={onParear}>Parear um tablet</button>}</div>
        </div>
      ) : (
        <div className="row between" style={{ gap: 10 }}>
          <label className="row" style={{ gap: 8, fontSize: 12.5, flex: 1, minWidth: 200 }}>
            <span>Tablet:</span>
            <select className="select" style={{ width: 'auto', flex: 1 }} value={tablet ? tablet.id : ''} onChange={(e) => escolherTablet(e.target.value)} aria-label="Tablet que vai coletar a assinatura">
              {pareados.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.online ? ' — conectado' : ' — sem conexão'}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-primary" disabled={!pronto || busy} onClick={enviarTablet}>{busy ? 'Enviando…' : 'Assinar no tablet'}</button>
          {tablet && !tablet.online && <p className="hint" style={{ width: '100%' }}>⚠ O tablet não está com a tela de assinatura aberta agora. O pedido aparece assim que ela for aberta.</p>}
        </div>
      ))}
      {err && <p role="alert" style={{ fontSize: 12.5, color: 'var(--crit-strong)', fontWeight: 600 }}>{err}</p>}
    </section>
  );
}
