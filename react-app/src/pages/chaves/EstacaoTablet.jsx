import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SignaturePad from '../../components/SignaturePad.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { fmtDateTime } from '../../lib/format.js';

/**
 * Estação tablet: aberta no tablet de assinatura com o usuário do responsável pela portaria/almoxarifado.
 * Mostra o pedido enviado pelo computador (tela "Controle de Chaves"), coleta a assinatura e devolve.
 * A consulta periódica mantém a sessão ativa enquanto a estação estiver aberta.
 */
export default function EstacaoTablet() {
  const { user } = useAuth();
  const [pedido, setPedido] = useState(null);
  const [fase, setFase] = useState('aguardando'); // aguardando | assinando | enviando | ok
  const [temTraco, setTemTraco] = useState(false);
  const [err, setErr] = useState('');
  const [conexao, setConexao] = useState(true);
  const pad = useRef(null);
  const faseRef = useRef(fase);
  faseRef.current = fase;
  const pedidoRef = useRef(pedido);
  pedidoRef.current = pedido;

  useEffect(() => {
    let vivo = true;
    const tick = async () => {
      if (faseRef.current === 'enviando' || faseRef.current === 'ok') return;
      try {
        const r = await api.get('/chaves/assinaturas/pendente');
        if (!vivo) return;
        setConexao(true);
        window.dispatchEvent(new Event('da:atividade'));
        const atual = pedidoRef.current, novo = r.pedido;
        if (faseRef.current === 'enviando' || faseRef.current === 'ok') return;
        if (!novo) { if (atual) { setPedido(null); setFase('aguardando'); setErr(''); } return; }
        if (!atual || atual.id !== novo.id) { setPedido(novo); setFase('assinando'); setErr(''); setTemTraco(false); if (pad.current) pad.current.clear(); }
      } catch (e) { if (vivo) setConexao(false); }
    };
    tick();
    const iv = setInterval(tick, 2000);
    return () => { vivo = false; clearInterval(iv); };
  }, []);

  const confirmar = async () => {
    if (!pad.current || pad.current.isEmpty()) { setErr('Assine no quadro antes de confirmar.'); return; }
    setFase('enviando'); setErr('');
    try {
      await api.post(`/chaves/assinaturas/${pedido.id}/assinar`, { imagem: pad.current.toDataURL() });
      setFase('ok');
      setTimeout(() => { setPedido(null); setFase('aguardando'); }, 3500);
    } catch (e) { setErr(e.message); setFase('assinando'); }
  };

  const telaCheia = () => {
    const d = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (d.requestFullscreen) d.requestFullscreen().catch(() => {});
  };

  const r = pedido && pedido.resumo;
  return (
    <div className="tablet-station">
      <header className="row between tablet-top">
        <div className="row" style={{ gap: 10 }}>
          <span aria-hidden="true" style={{ fontSize: 22 }}>🔑</span>
          <div>
            <p style={{ fontWeight: 800 }}>Entrega e Recebimento de Chaves</p>
            <p className="muted" style={{ fontSize: 12 }}>Estação de assinatura · {user ? user.name : ''} {conexao ? '' : '· ⚠ sem conexão'}</p>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={telaCheia}>⛶ Tela cheia</button>
          <Link className="btn btn-secondary btn-sm" to="/chaves">Sair da estação</Link>
        </div>
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
          <p style={{ fontSize: 20, fontWeight: 700 }}>Aguardando pedido de assinatura…</p>
          <p className="muted" style={{ maxWidth: 480 }}>No computador, abra <strong>Controle de Chaves</strong>, preencha a retirada ou a devolução e escolha <strong>“No tablet”</strong>. O documento aparece aqui automaticamente.</p>
        </div>
      ) : (
        <main className="tablet-doc">
          <h1>{r.tipo === 'devolucao' ? 'Devolução de chave' : 'Retirada de chave'}</h1>
          <dl className="tablet-resumo">
            <div><dt>Local</dt><dd>{r.local} ({r.chave})</dd></div>
            <div><dt>{r.tipo === 'devolucao' ? 'Quem devolve' : 'Solicitante'}</dt><dd>{r.tipo === 'devolucao' ? r.devolvidoPor : r.solicitante}{r.solicitanteDoc ? ' · ' + r.solicitanteDoc : ''}</dd></div>
            <div><dt>{r.tipo === 'devolucao' ? 'Data da Devolução' : 'Data da Retirada'}</dt><dd>{fmtDateTime(r.data)}</dd></div>
            <div><dt>{r.tipo === 'devolucao' ? 'Responsável pelo Recebimento' : 'Responsável pela Entrega'}</dt><dd>{r.responsavel}</dd></div>
          </dl>
          <p style={{ fontSize: 13 }}>{r.tipo === 'devolucao' ? 'Declaro que devolvi a chave acima nesta data.' : 'Declaro que recebi a chave acima e me responsabilizo por sua guarda até a devolução.'}</p>
          <SignaturePad ref={pad} height={260} label="Assinatura - Solicitante" onChange={setTemTraco} disabled={fase === 'enviando'} />
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
