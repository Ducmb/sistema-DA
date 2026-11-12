import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import FormModal from '../../components/FormModal.jsx';
import { ConfirmModal, Empty, ErrorBox, Modal, SkeletonRows, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useInterval } from '../../lib/hooks.js';
import { fmtDateTime } from '../../lib/format.js';

/**
 * Tablets de assinatura (Android/iPad). Cada tablet é pareado uma vez — lendo o QR code com a câmera ou
 * digitando o código — e depois fica com a tela de assinatura aberta, recebendo os pedidos automaticamente.
 */
export default function Tablets() {
  const toast = useToast();
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(null);
  const [novo, setNovo] = useState(false);
  const [codigo, setCodigo] = useState(null); // tablet + código de pareamento em exibição
  const [confirma, setConfirma] = useState(null);

  const carregar = useCallback(async () => {
    try { setLista(await api.get('/chaves/tablets', { background: true })); setErro(null); } catch (e) { setErro(e); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useInterval(carregar, 5000); // status "conectado" e conclusão do pareamento

  const criar = async (f) => { const t = await api.post('/chaves/tablets', { nome: f.nome || '' }); setNovo(false); setCodigo(t); carregar(); };
  const novoCodigo = async (t) => { const r = await api.post(`/chaves/tablets/${t.id}/codigo`); setCodigo(r); carregar(); };
  const remover = async (t) => { await api.del('/chaves/tablets/' + t.id); toast('Tablet removido.'); carregar(); };

  const pareando = codigo && lista && lista.find((t) => t.id === codigo.id);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card row between" style={{ padding: 16 }}>
        <p style={{ fontSize: 13, flex: 1, minWidth: 220 }}>Pareie o tablet <strong>uma única vez</strong>. Depois ele fica na tela de assinatura, sem login, e os documentos aparecem nele automaticamente quando você clica em “Assinar no tablet”.</p>
        <button type="button" className="btn btn-primary" onClick={() => setNovo(true)}>+ Parear tablet</button>
      </div>
      {erro ? <ErrorBox error={erro} onRetry={carregar} /> : !lista ? <SkeletonRows n={3} /> : !lista.length ? (
        <Empty icon="📱" title="Nenhum tablet pareado">Clique em “+ Parear tablet” e leia o QR code com a câmera do tablet.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 640 }}>
            <thead><tr><th>Tablet</th><th>Situação</th><th>Último contato</th><th>Ações</th></tr></thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.nome}</strong>{t.pareadoEm && <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>Pareado em {fmtDateTime(t.pareadoEm)}</span>}</td>
                  <td style={{ fontSize: 12.5 }}>{!t.pareado ? <span style={{ color: 'var(--warn)' }}>● Aguardando pareamento</span> : t.online ? <span style={{ color: 'var(--success, #1a7f37)', fontWeight: 600 }}>● Conectado</span> : <span className="muted">● Tela de assinatura fechada</span>}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{t.ultimoContato ? fmtDateTime(t.ultimoContato) : '—'}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      {!t.pareado && t.codigoExpira
                        ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => novoCodigo(t).catch((e) => toast(e.message, 'error'))}>Mostrar novo código</button>
                        : <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirma({ tipo: 'codigo', t })}>{t.pareado ? 'Parear outro aparelho' : 'Gerar código'}</button>}
                      <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--crit-strong)' }} onClick={() => setConfirma({ tipo: 'remover', t })}>Remover</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {novo && <FormModal title="Parear tablet" sub="Dê um nome para identificar o aparelho" initial={{ nome: '' }} onClose={() => setNovo(false)} onSubmit={criar} submitLabel="Gerar QR code"
        fields={[{ key: 'nome', label: 'Nome do tablet', placeholder: 'Tablet da Portaria' }]} />}
      {codigo && <CodigoModal tablet={codigo} pareado={!!(pareando && pareando.pareado)} onClose={() => setCodigo(null)} />}
      {confirma && confirma.tipo === 'codigo' && (
        <ConfirmModal title={'Parear de novo — ' + confirma.t.nome} confirmLabel="Gerar código"
          message={confirma.t.pareado ? 'O aparelho pareado agora será desconectado e só voltará a receber pedidos depois de ler o novo código.' : 'Gera um novo código de pareamento (válido por 15 minutos).'}
          onConfirm={() => novoCodigo(confirma.t)} onClose={() => setConfirma(null)} />
      )}
      {confirma && confirma.tipo === 'remover' && (
        <ConfirmModal title={'Remover ' + confirma.t.nome} danger confirmLabel="Remover tablet"
          message="O tablet é desconectado na hora e deixa de receber pedidos de assinatura. Os termos já assinados não são afetados."
          onConfirm={() => remover(confirma.t)} onClose={() => setConfirma(null)} />
      )}
    </div>
  );
}

/** QR code com o endereço de pareamento (o tablet abre e pareia sozinho) + o código para digitar. */
function CodigoModal({ tablet, pareado, onClose }) {
  const url = `${window.location.origin}/chaves/tablet?codigo=${encodeURIComponent(tablet.codigo)}`;
  const base = `${window.location.origin}/chaves/tablet`;
  const [qr, setQr] = useState('');
  const [restante, setRestante] = useState(15 * 60);
  useEffect(() => { QRCode.toDataURL(url, { width: 260, margin: 1, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr('')); }, [url]);
  useEffect(() => {
    const fim = tablet.codigoExpira ? new Date(tablet.codigoExpira).getTime() : Date.now() + 15 * 60000;
    const tick = () => setRestante(Math.max(0, Math.round((fim - Date.now()) / 1000)));
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, [tablet.codigoExpira]);
  const mmss = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  return (
    <Modal title={'Parear ' + tablet.nome} onClose={onClose} footer={<button type="button" className="btn btn-primary" onClick={onClose}>{pareado ? 'Concluir' : 'Fechar'}</button>}>
      {pareado ? (
        <div className="stack" role="status" style={{ alignItems: 'center', textAlign: 'center', gap: 8, padding: '24px 0' }}>
          <p style={{ fontSize: 48 }} aria-hidden="true">✅</p>
          <p style={{ fontSize: 18, fontWeight: 800 }}>Tablet pareado!</p>
          <p className="muted" style={{ fontSize: 13 }}>Deixe a tela de assinatura aberta no tablet. Os pedidos vão aparecer nele automaticamente.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 14, alignItems: 'center', textAlign: 'center' }}>
          <p style={{ fontSize: 13 }}><strong>1.</strong> No tablet, abra a câmera e leia o QR code — o tablet abre a tela de assinatura e fica pareado.</p>
          <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}>
            {qr ? <img src={qr} width={240} height={240} alt="QR code para parear o tablet" /> : <div style={{ width: 240, height: 240 }} />}
          </div>
          <p style={{ fontSize: 13 }}><strong>2.</strong> Ou, no navegador do tablet, abra <strong style={{ wordBreak: 'break-all' }}>{base}</strong> e digite o código:</p>
          <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4, fontFamily: 'ui-monospace, monospace' }} aria-label={'Código ' + tablet.codigo.split('').join(' ')}>{tablet.codigo}</p>
          <p className="muted" style={{ fontSize: 12 }}>{restante ? `Código de uso único — expira em ${mmss(restante)}.` : 'Código expirado. Gere um novo.'} Esta janela confirma quando o tablet for pareado.</p>
          <p className="hint">Dica: no tablet, use “Adicionar à tela inicial” e deixe a tela de assinatura sempre aberta (em tela cheia).</p>
        </div>
      )}
    </Modal>
  );
}
