import React, { useEffect, useRef, useState } from 'react';
import SignaturePad from '../../components/SignaturePad.jsx';
import { Segmented } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { abrirJanelaTablet, enviar, janelaAberta, janelaAtual, mensagemValida, suportaMultiplasTelas } from '../../lib/telaTablet.js';

const MODO_KEY = 'DA_chaves_modo';
const MODOS = ['tablet', 'tela', 'rede'];
const lerModo = () => { try { const m = localStorage.getItem(MODO_KEY); return MODOS.includes(m) ? m : 'tablet'; } catch (e) { return 'tablet'; } };
const novoId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

/**
 * Coleta a assinatura do solicitante e conclui o registro.
 * - "Tablet conectado" (padrão): o sistema abre sozinho a janela de assinatura na tela do tablet ligado ao
 *   computador; o traço volta para cá e o registro é concluído — sem abrir página nem fazer login no tablet.
 * - "Nesta tela": quadro de assinatura no próprio formulário (mesa digitalizadora/tela sensível ao toque).
 * - "Tablet via rede": tablet sem cabo, com a estação /chaves/tablet aberta com o mesmo usuário.
 * dados: corpo do pedido (tipo + campos); resumo: o que o tablet mostra; pronto: formulário válido;
 * onConcluir(assinaturaId) grava o registro.
 */
export default function ColetaAssinatura({ dados, resumo, pronto, confirmarLabel, onConcluir }) {
  const [modo, setModo] = useState(lerModo);
  const [temTraco, setTemTraco] = useState(false);
  const [pedido, setPedido] = useState(null); // pedido enviado à estação via rede
  const [tablet, setTablet] = useState(null); // { id, aviso } — documento na janela do tablet conectado
  const [restante, setRestante] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pad = useRef(null);
  const concluindo = useRef(false);
  const atual = useRef({});
  atual.current = { dados, resumo, tablet };

  const trocarModo = (m) => { cancelarTablet(); setModo(m); setErr(''); try { localStorage.setItem(MODO_KEY, m); } catch (e) { /* sem storage */ } };

  const concluir = async (assinaturaId) => {
    if (concluindo.current) return;
    concluindo.current = true;
    try { await onConcluir(assinaturaId); } catch (e) { concluindo.current = false; throw e; }
  };

  // ---------- Nesta tela ----------
  const assinarNaTela = async () => {
    if (pad.current.isEmpty()) { setErr('O solicitante precisa assinar no quadro.'); return; }
    setBusy(true); setErr('');
    try {
      const a = await api.post('/chaves/assinaturas', { ...dados, imagem: pad.current.toDataURL() });
      await concluir(a.id);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  // ---------- Tablet conectado (janela automática na tela do tablet) ----------
  const enviarDocumento = (id) => enviar({ tipo: 'documento', id, resumo: { ...atual.current.resumo, data: new Date().toISOString() } });
  const assinarNoTablet = () => {
    setErr('');
    const r = abrirJanelaTablet(); // no clique: o navegador só abre janelas em resposta a um gesto
    if (!r) { setErr('O navegador bloqueou a janela do tablet. Permita pop-ups para este sistema e tente de novo.'); return; }
    const id = novoId();
    setTablet({ id, aviso: '' });
    enviarDocumento(id); // se a janela já estava aberta; se é nova, reenvia quando ela avisar "pronta"
    r.naTelaDoTablet.then((ok) => {
      if (!ok) setTablet((t) => (t && t.id === id ? { ...t, aviso: suportaMultiplasTelas() ? 'Permita “Gerenciar janelas” no navegador para a janela abrir direto na tela do tablet — ou arraste-a até lá.' : 'Este navegador não posiciona janelas em outra tela: arraste a janela até a tela do tablet (recomendado: Chrome ou Edge).' } : t));
    });
  };
  function cancelarTablet() {
    if (atual.current.tablet) enviar({ tipo: 'cancelar' });
    setTablet(null);
  }

  useEffect(() => {
    if (!tablet) return undefined;
    const onMsg = async (e) => {
      if (!mensagemValida(e, janelaAtual())) return;
      const m = e.data, t = atual.current.tablet;
      if (!t) return;
      if (m.tipo === 'pronta') enviarDocumento(t.id);
      else if (m.tipo === 'fechada') { setTablet(null); setErr('A janela do tablet foi fechada antes da assinatura.'); }
      else if (m.tipo === 'assinatura' && m.id === t.id) {
        try {
          const a = await api.post('/chaves/assinaturas', { ...atual.current.dados, imagem: m.imagem, dispositivo: 'tablet' });
          await concluir(a.id);
          enviar({ tipo: 'resultado', id: m.id, ok: true });
        } catch (er) {
          enviar({ tipo: 'resultado', id: m.id, ok: false, erro: er.message });
          setErr(er.message);
        }
      }
    };
    window.addEventListener('message', onMsg);
    const iv = setInterval(() => { if (!janelaAberta()) { setTablet(null); setErr('A janela do tablet foi fechada antes da assinatura.'); } }, 1000);
    return () => { window.removeEventListener('message', onMsg); clearInterval(iv); };
  }, [tablet && tablet.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fechar o formulário com documento no tablet devolve o tablet ao repouso
  useEffect(() => () => { if (atual.current.tablet && !concluindo.current) enviar({ tipo: 'cancelar' }); }, []);

  // ---------- Tablet via rede (estação /chaves/tablet) ----------
  const enviarRede = async () => {
    setBusy(true); setErr('');
    try { setPedido(await api.post('/chaves/assinaturas', dados)); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const cancelarRede = async () => { if (pedido) api.del('/chaves/assinaturas/' + pedido.id).catch(() => {}); setPedido(null); };

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

  useEffect(() => () => { if (pedido && !concluindo.current) api.del('/chaves/assinaturas/' + pedido.id).catch(() => {}); }, [pedido]);

  const mmss = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  const aguardando = (titulo, texto, onCancel) => (
    <div className="stack" role="status" aria-live="polite" style={{ gap: 10, alignItems: 'center', textAlign: 'center', padding: '18px 10px' }}>
      <span aria-hidden="true" style={{ fontSize: 28 }}>📱</span>
      <p style={{ fontWeight: 700 }}>{titulo}</p>
      <p className="muted" style={{ fontSize: 12.5 }}>{texto}</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Cancelar</button>
    </div>
  );

  return (
    <section className="stack" style={{ gap: 12, padding: 16, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)' }}>
      <div className="row between">
        <h4 style={{ fontSize: 13.5, fontWeight: 700 }}>Assinatura - Solicitante</h4>
        <Segmented label="Onde assinar" value={modo} onChange={trocarModo} options={[
          { value: 'tablet', label: '📱 Tablet conectado' }, { value: 'tela', label: '✍ Nesta tela' }, { value: 'rede', label: '📶 Tablet via rede' }]} />
      </div>
      {modo === 'tablet' && (tablet ? aguardando('Aguardando a assinatura no tablet…',
        tablet.aviso || 'O documento foi aberto na tela do tablet. O registro é concluído aqui assim que o solicitante confirmar.', cancelarTablet) : (
        <div className="stack" style={{ gap: 10 }}>
          <p style={{ fontSize: 12.5 }}>Ao clicar, o documento abre automaticamente na tela do tablet conectado a este computador. O solicitante assina e confirma no tablet, e o registro é concluído aqui — sem abrir página nem fazer login no tablet.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" disabled={!pronto} onClick={assinarNoTablet}>Assinar no tablet</button>
          </div>
        </div>
      ))}
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
      {modo === 'rede' && (pedido ? aguardando('Aguardando a assinatura no tablet…', `O pedido aparece na estação tablet aberta com o seu usuário. Expira em ${mmss(restante)}.`, cancelarRede) : (
        <div className="stack" style={{ gap: 10 }}>
          <p style={{ fontSize: 12.5 }}>Para tablet sem cabo: no tablet, deixe aberta a <strong>Estação tablet</strong> com o seu usuário; o pedido aparece lá e o registro é concluído aqui assim que ele assinar.</p>
          <div className="row between">
            <a className="link-btn" href="/chaves/tablet" target="_blank" rel="noopener">Abrir a estação tablet ↗</a>
            <button type="button" className="btn btn-primary" disabled={!pronto || busy} onClick={enviarRede}>{busy ? 'Enviando…' : 'Enviar para o tablet'}</button>
          </div>
        </div>
      ))}
      {err && <p role="alert" style={{ fontSize: 12.5, color: 'var(--crit-strong)', fontWeight: 600 }}>{err}</p>}
    </section>
  );
}
