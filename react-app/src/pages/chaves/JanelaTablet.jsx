import React, { useEffect, useRef, useState } from 'react';
import SignaturePad from '../../components/SignaturePad.jsx';
import { fmtDateTime } from '../../lib/format.js';
import { CANAL, mensagemValida } from '../../lib/telaTablet.js';

/**
 * Janela aberta automaticamente pelo computador na tela do tablet conectado.
 * Não usa a API nem precisa de login: recebe o documento do computador, coleta o traço e o devolve.
 * Entre um documento e outro fica em repouso, pronta para o próximo pedido.
 */
export default function JanelaTablet() {
  const [doc, setDoc] = useState(null); // { id, resumo }
  const [fase, setFase] = useState('repouso'); // repouso | assinando | enviando | ok
  const [temTraco, setTemTraco] = useState(false);
  const [err, setErr] = useState('');
  const pad = useRef(null);
  const docRef = useRef(null);
  docRef.current = doc;
  const opener = window.opener;

  const responder = (msg) => { if (opener && !opener.closed) opener.postMessage({ canal: CANAL, ...msg }, window.location.origin); };

  useEffect(() => {
    document.title = 'Assinatura — Controle de Chaves';
    const onMsg = (e) => {
      if (!mensagemValida(e, opener)) return;
      const m = e.data;
      if (m.tipo === 'documento') {
        if (docRef.current && docRef.current.id === m.id) return;
        setDoc({ id: m.id, resumo: m.resumo }); setFase('assinando'); setErr(''); setTemTraco(false);
        if (pad.current) pad.current.clear();
        window.focus();
      } else if (m.tipo === 'resultado' && docRef.current && m.id === docRef.current.id) {
        if (m.ok) { setFase('ok'); setTimeout(() => { setDoc(null); setFase('repouso'); }, 3000); } else { setErr(m.erro || 'Não foi possível registrar.'); setFase('assinando'); }
      } else if (m.tipo === 'cancelar') { setDoc(null); setFase('repouso'); setErr(''); }
    };
    window.addEventListener('message', onMsg);
    responder({ tipo: 'pronta' });
    const avisaFechar = () => responder({ tipo: 'fechada' });
    window.addEventListener('pagehide', avisaFechar);
    return () => { window.removeEventListener('message', onMsg); window.removeEventListener('pagehide', avisaFechar); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmar = () => {
    if (!pad.current || pad.current.isEmpty()) { setErr('Assine no quadro antes de confirmar.'); return; }
    setFase('enviando'); setErr('');
    responder({ tipo: 'assinatura', id: doc.id, imagem: pad.current.toDataURL() });
  };
  const telaCheia = () => { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); };

  if (!opener) {
    return (
      <div className="tablet-station"><div className="tablet-center">
        <p style={{ fontSize: 48 }} aria-hidden="true">🔑</p>
        <p style={{ fontSize: 18, fontWeight: 700 }}>Esta janela é aberta automaticamente pelo Controle de Chaves.</p>
        <p className="muted">No computador, escolha “Tablet conectado” e clique em “Assinar no tablet”.</p>
      </div></div>
    );
  }

  const r = doc && doc.resumo;
  return (
    <div className="tablet-station">
      {fase === 'ok' ? (
        <div className="tablet-center" role="status">
          <p style={{ fontSize: 56 }} aria-hidden="true">✅</p>
          <p style={{ fontSize: 22, fontWeight: 800 }}>Assinatura registrada. Obrigado!</p>
        </div>
      ) : !doc ? (
        <div className="tablet-center" role="status" aria-live="polite">
          <p style={{ fontSize: 56 }} aria-hidden="true">🔑</p>
          <p style={{ fontSize: 20, fontWeight: 700 }}>Entrega e Recebimento de Chaves</p>
          <p className="muted">Aguardando o próximo documento para assinatura.</p>
          {!document.fullscreenElement && <button type="button" className="btn btn-secondary btn-sm" onClick={telaCheia}>⛶ Tela cheia</button>}
        </div>
      ) : (
        <main className="tablet-doc">
          <h1>{r.tipo === 'devolucao' ? 'Devolução de chave' : 'Retirada de chave'}</h1>
          <dl className="tablet-resumo">
            <div><dt>Local</dt><dd>{r.local}{r.chave ? ` (${r.chave})` : ''}</dd></div>
            <div><dt>{r.tipo === 'devolucao' ? 'Quem devolve' : 'Solicitante'}</dt><dd>{r.tipo === 'devolucao' ? r.devolvidoPor : r.solicitante}{r.solicitanteDoc ? ' · ' + r.solicitanteDoc : ''}</dd></div>
            <div><dt>{r.tipo === 'devolucao' ? 'Data da Devolução' : 'Data da Retirada'}</dt><dd>{fmtDateTime(r.data)}</dd></div>
            <div><dt>{r.tipo === 'devolucao' ? 'Responsável pelo Recebimento' : 'Responsável pela Entrega'}</dt><dd>{r.responsavel}</dd></div>
          </dl>
          <p style={{ fontSize: 13 }}>{r.tipo === 'devolucao' ? 'Declaro que devolvi a chave acima nesta data.' : 'Declaro que recebi a chave acima e me responsabilizo por sua guarda até a devolução.'}</p>
          <SignaturePad ref={pad} height={260} label="Assinatura - Solicitante" onChange={setTemTraco} disabled={fase === 'enviando'} />
          {err && <p role="alert" style={{ color: 'var(--crit-strong)', fontWeight: 600 }}>{err}</p>}
          <div className="row between">
            <button type="button" className="btn btn-secondary" onClick={() => pad.current && pad.current.clear()} disabled={fase === 'enviando'}>Limpar</button>
            <button type="button" className="btn btn-primary" style={{ minWidth: 180 }} disabled={!temTraco || fase === 'enviando'} onClick={confirmar}>{fase === 'enviando' ? 'Registrando…' : 'Confirmar assinatura'}</button>
          </div>
          <p className="hint">Assinatura eletrônica simples (Lei nº 14.063/2020). O traço é vinculado a este documento com data e hora.</p>
        </main>
      )}
    </div>
  );
}
