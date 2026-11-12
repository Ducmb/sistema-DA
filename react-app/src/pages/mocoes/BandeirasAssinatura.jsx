import React, { useEffect, useState } from 'react';
import ColetaAssinatura from '../../components/ColetaAssinatura.jsx';
import { Async, Field, Modal, SkeletonRows } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useApi } from '../../lib/hooks.js';
import { fmtDate, fmtDateTime, maskDoc } from '../../lib/format.js';

/**
 * Saída de bandeiras com assinatura eletrônica (mesma lógica do Controle de Chaves): quem retira e quem devolve
 * assina no quadro da tela ou no tablet pareado; o servidor monta o conteúdo assinado e gera o código de verificação.
 */
const BASE = '/mocoes/bandeiras';
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 };
const hojeBr = () => new Date().toLocaleDateString('pt-BR');

function Responsavel({ label }) {
  const { user } = useAuth();
  return <Field label={label} hint="Usuário logado — registrado automaticamente."><input className="input" value={user ? user.name : ''} readOnly aria-readonly="true" /></Field>;
}

function Itens({ r, itens }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {itens.filter((i) => r.itens.includes(i.key)).map((i) => <span key={i.key} className="badge" style={{ borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)' }}>{i.label}</span>)}
    </div>
  );
}

export function RetiradaBandModal({ r, itens, onClose, onDone }) {
  const [nome, setNome] = useState('');
  const [doc, setDoc] = useState('');
  const dados = { tipo: 'bandeira_retirada', emprestimoId: r.id, retiradoPor: nome.trim(), retiradoDoc: doc.trim() };
  const concluir = async (assinaturaId) => {
    await api.post(`${BASE}/${r.id}/retirada`, { retiradoPor: dados.retiradoPor, retiradoDoc: dados.retiradoDoc, assinaturaId });
    onDone('Retirada registrada com assinatura — ' + r.entidade);
  };
  return (
    <Modal wide title="Retirada de bandeiras" sub={r.entidade + (r.protocolo ? ' · protocolo ' + r.protocolo : '')} onClose={onClose}>
      <div className="stack" style={{ gap: 14 }}>
        <Field label="Itens que saem"><Itens r={r} itens={itens} /></Field>
        <div style={grid}>
          <Field label="Quem retira (nome completo)" htmlFor="br-nome"><input id="br-nome" className="input" value={nome} maxLength={160} onChange={(e) => setNome(e.target.value)} /></Field>
          <Field label="Documento (opcional)" htmlFor="br-doc"><input id="br-doc" className="input" value={doc} maxLength={40} onChange={(e) => setDoc(e.target.value)} placeholder="RG ou CPF" /></Field>
          <Field label="Data da Retirada"><input className="input" value={hojeBr()} readOnly aria-readonly="true" /></Field>
          <Field label="Devolução prevista"><input className="input" value={r.devolucao ? fmtDate(r.devolucao) : 'Não definida'} readOnly aria-readonly="true" /></Field>
          <Responsavel label="Responsável pela Entrega" />
        </div>
        <ColetaAssinatura base={BASE} titulo="Assinatura - Quem retira" dados={dados} pronto={dados.retiradoPor.length >= 3} confirmarLabel="Assinar e registrar retirada" onConcluir={concluir} />
      </div>
    </Modal>
  );
}

export function DevolucaoBandModal({ r, itens, onClose, onDone }) {
  const [nome, setNome] = useState(r.retiradoPor || '');
  const [conf, setConf] = useState('Sim');
  const [obs, setObs] = useState('');
  const dados = { tipo: 'bandeira_devolucao', emprestimoId: r.id, devolvidoPor: nome.trim(), conformidade: conf, obs: conf === 'Não' ? obs.trim() : '' };
  const pronto = dados.devolvidoPor.length >= 3 && (conf === 'Sim' || dados.obs.length > 0);
  const concluir = async (assinaturaId) => {
    await api.post(`${BASE}/${r.id}/devolucao`, { devolvidoPor: dados.devolvidoPor, conformidade: conf, obs: dados.obs, assinaturaId });
    onDone('Devolução registrada com assinatura — ' + r.entidade);
  };
  return (
    <Modal wide title="Devolução de bandeiras" sub={r.entidade + (r.retirada ? ' · retirada em ' + fmtDate(r.retirada) : '')} onClose={onClose}>
      <div className="stack" style={{ gap: 14 }}>
        <Field label="Itens a conferir"><Itens r={r} itens={itens} /></Field>
        <div style={grid}>
          <Field label="Quem devolve (nome completo)" htmlFor="bd-nome"><input id="bd-nome" className="input" value={nome} maxLength={160} onChange={(e) => setNome(e.target.value)} /></Field>
          <Field label="Devolvido em conformidade?" htmlFor="bd-conf">
            <select id="bd-conf" className="select" value={conf} onChange={(e) => setConf(e.target.value)}><option>Sim</option><option>Não</option></select>
          </Field>
          <Field label="Data da Devolução"><input className="input" value={hojeBr()} readOnly aria-readonly="true" /></Field>
          <Responsavel label="Responsável pelo Recebimento" />
        </div>
        {conf === 'Não' && <Field label="O que não está em conformidade?" htmlFor="bd-obs"><input id="bd-obs" className="input" value={obs} maxLength={400} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: mastro danificado, bandeira de SP não devolvida" /></Field>}
        <p className="hint">Confira os itens antes de pedir a assinatura: a conferência aparece no documento assinado.</p>
        <ColetaAssinatura base={BASE} titulo="Assinatura - Quem devolve" dados={dados} pronto={pronto} confirmarLabel="Assinar e registrar devolução" onConcluir={concluir} />
      </div>
    </Modal>
  );
}

/** Termo de retirada e devolução de bandeiras com as assinaturas eletrônicas (imprimível). */
export function TermoBandModal({ id, onClose }) {
  const st = useApi(() => api.get(`${BASE}/${id}/termo`), [id]);
  useEffect(() => { document.body.classList.add('printing-termo'); return () => document.body.classList.remove('printing-termo'); }, []);
  return (
    <Modal wide title="Termo de retirada e devolução" onClose={onClose} footer={<>
      <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
      <button type="button" className="btn btn-primary" disabled={!st.data} onClick={() => window.print()}>🖨 Imprimir / PDF</button>
    </>}>
      <Async state={st} skeleton={<SkeletonRows n={4} />}>
        {(t) => (
          <div className="termo-chave">
            <h2>Empréstimo de Bandeiras — Retirada e Devolução</h2>
            <p className="termo-local">Empresa / Entidade: <span className="termo-valor">{t.entidade}</span>{t.documento && <> · {maskDoc(t.documento)}</>}{t.protocolo && <> · Protocolo 1Doc <span className="termo-valor">{t.protocolo}</span></>}</p>
            <p className="termo-local">Itens: <span className="termo-valor">{t.itens.join(', ')}</span></p>
            <Bloco data={['Data da Retirada', t.retirado ? fmtDate(t.retirada) : '__/__/____']} rotulo="Assinatura - Quem retira"
              pessoa={t.retiradoPor + (t.retiradoDoc ? ' · ' + t.retiradoDoc : '')} assinatura={t.assinaturaRetirada} resp={['Responsável pela Entrega', t.entreguePor]} />
            <Bloco data={['Data da Devolução', t.conformidade ? fmtDate(t.devolucao) : '__/__/____']} rotulo="Assinatura - Quem devolve"
              pessoa={t.devolvidoPor} assinatura={t.assinaturaDevolucao} resp={['Responsável pelo Recebimento', t.recebidoPor]}
              extra={t.conformidade ? (t.conformidade === 'Sim' ? 'Itens devolvidos em conformidade.' : 'Devolvidos com pendência: ' + t.obs) : ''} />
            {t.retirado && !t.assinaturaRetirada && <p className="termo-obs">Retirada registrada antes da assinatura eletrônica (sem assinatura).</p>}
            <p className="termo-legal">Documento assinado eletronicamente (assinatura eletrônica simples — Lei nº 14.063/2020, art. 4º, I). A integridade de cada assinatura é garantida pelo código de verificação (SHA-256 do conteúdo assinado, do traço e da data/hora).</p>
          </div>
        )}
      </Async>
    </Modal>
  );
}

function Bloco({ data, rotulo, pessoa, assinatura, resp, extra }) {
  const a = assinatura;
  return (
    <div className="termo-bloco">
      <p><span>{data[0]}:</span> <span className="termo-valor">{data[1]}</span></p>
      {extra && <p>{extra}</p>}
      <div className="termo-assin">
        <span>{rotulo}:</span>
        <div className="termo-linha">{a ? <img src={a.imagem} alt={'Assinatura de ' + pessoa} /> : <span className="muted-3">—</span>}</div>
        {pessoa && <small>{pessoa}</small>}
        {a && <small className="termo-meta">Assinado em {fmtDateTime(a.assinadaEm)} · {a.dispositivo === 'tablet' ? 'no tablet' : 'na tela do computador'} · IP {a.ip || '—'} · Código {a.codigo}</small>}
      </div>
      <p><span>{resp[0]}:</span> <span className="termo-valor">{resp[1] || ''}</span></p>
    </div>
  );
}
