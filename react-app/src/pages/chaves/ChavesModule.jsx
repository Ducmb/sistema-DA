import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../components/Layout.jsx';
import FormModal from '../../components/FormModal.jsx';
import { Async, Badge, Empty, Field, Kpi, Modal, SkeletonRows, Switch, Tabs, useToast } from '../../components/ui.jsx';
import { api, qs } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useApi, useDebounced, useQueryState } from '../../lib/hooks.js';
import { fmtDateTime } from '../../lib/format.js';
import ColetaAssinatura from './Assinatura.jsx';
import Tablets from './Tablets.jsx';

const TABS = [{ key: 'emprestimos', label: 'Entregas e devoluções' }, { key: 'chaves', label: 'Chaves cadastradas' }, { key: 'tablets', label: '📱 Tablets' }];
const SIT_LEVEL = { 'Em uso': 'info', Atrasada: 'critical', Devolvida: 'success' };
const dataBr = (ts) => (ts ? new Date(ts).toLocaleDateString('pt-BR') : '__/__/____');

/** Controle de Chaves: termo de "Entrega e Recebimento de Chaves" com assinatura eletrônica do solicitante. */
export default function ChavesModule() {
  const [tab, setTab] = useQueryState('tab', 'emprestimos');
  const t = TABS.some((x) => x.key === tab) ? tab : 'emprestimos';
  return (
    <>
      <PageHeader section="Controle de Chaves" title="Controle de Chaves" desc="Entrega e recebimento de chaves com assinatura eletrônica do solicitante." />
      <main className="page">
        <Tabs tabs={TABS} value={t} onChange={setTab} label="Seções do controle de chaves" />
        <div className="fade-up" key={t}>
          {t === 'emprestimos' && <Emprestimos onParear={() => setTab('tablets')} />}
          {t === 'chaves' && <Chaves />}
          {t === 'tablets' && <Tablets />}
        </div>
      </main>
    </>
  );
}

function Emprestimos({ onParear }) {
  const toast = useToast();
  const [sit, setSit] = useState('abertos');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const st = useApi(() => api.get('/chaves/emprestimos' + qs({ situacao: sit, q: dq })), [sit, dq]);
  const [retirada, setRetirada] = useState(false);
  const [devolucao, setDevolucao] = useState(null);
  const [termo, setTermo] = useQueryState('emprestimo', '');
  const k = st.data ? st.data.kpis : {};
  const done = (msg) => { toast(msg); setRetirada(false); setDevolucao(null); st.reload(); };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid" style={{ "--min": "180px", gap: 12 }}>
        <Kpi label="Chaves em uso" value={k.abertos ?? '—'} active={sit === 'abertos'} onClick={() => setSit('abertos')} />
        <Kpi label="Não devolvidas no prazo" value={k.atrasadas ?? '—'} color={k.atrasadas ? 'var(--crit-strong)' : undefined} active={sit === 'atrasadas'} onClick={() => setSit('atrasadas')} sub={st.data ? `Prazo: ${st.data.prazoHoras} h` : ''} />
        <Kpi label="Devolvidas no mês" value={k.devolvidas_mes ?? '—'} active={sit === 'devolvidas'} onClick={() => setSit('devolvidas')} />
      </div>
      <div className="card row" style={{ padding: 16 }}>
        <input type="search" className="input" style={{ flex: 1, minWidth: 180 }} placeholder="🔍 Buscar por local, chave ou solicitante..." aria-label="Buscar empréstimo" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ width: 'auto' }} aria-label="Situação" value={sit} onChange={(e) => setSit(e.target.value)}>
          <option value="abertos">Em uso</option><option value="atrasadas">Atrasadas</option><option value="devolvidas">Devolvidas</option><option value="todas">Todas</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={() => setRetirada(true)}>+ Registrar retirada</button>
      </div>
      <Async state={st} skeleton={<SkeletonRows n={5} />}>
        {(d) => (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 820 }}>
              <thead><tr><th>Local</th><th>Solicitante</th><th>Retirada</th><th>Devolução</th><th>Situação</th><th>Ações</th></tr></thead>
              <tbody>
                {d.items.map((x) => (
                  <tr key={x.id}>
                    <td><strong>{x.local}</strong><span className="muted" style={{ display: 'block', fontSize: 11.5 }}>{x.chaveCodigo}</span></td>
                    <td>{x.solicitante}{x.solicitanteDoc && <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>{x.solicitanteDoc}</span>}</td>
                    <td style={{ fontSize: 12 }}>{fmtDateTime(x.retiradaEm)}<span className="muted" style={{ display: 'block', fontSize: 11.5 }}>Entregue por {x.entreguePor}</span></td>
                    <td style={{ fontSize: 12 }}>{x.devolucaoEm ? <>{fmtDateTime(x.devolucaoEm)}<span className="muted" style={{ display: 'block', fontSize: 11.5 }}>Recebida por {x.recebidoPor}</span></> : <span className="muted">Prazo: {fmtDateTime(x.prazo)}</span>}</td>
                    <td><Badge level={SIT_LEVEL[x.situacao]}>{x.situacao}</Badge></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTermo(String(x.id))}>Ver termo</button>
                        {!x.devolucaoEm && <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)' }} onClick={() => setDevolucao(x)}>Registrar devolução</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!d.items.length && <tr><td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center' }} className="muted-3">Nenhum registro nesta situação.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Async>
      {retirada && <RetiradaModal onParear={onParear} onClose={() => setRetirada(false)} onDone={() => done('Retirada registrada com a assinatura do solicitante.')} />}
      {devolucao && <DevolucaoModal onParear={onParear} emp={devolucao} onClose={() => setDevolucao(null)} onDone={() => done('Devolução registrada com a assinatura.')} />}
      {termo && <TermoModal id={termo} onClose={() => setTermo('')} />}
    </div>
  );
}

function Responsavel({ label }) {
  const { user } = useAuth();
  return (
    <Field label={label} hint="Usuário logado — registrado automaticamente.">
      <input className="input" value={user ? user.name : ''} readOnly aria-readonly="true" />
    </Field>
  );
}

function RetiradaModal({ onClose, onDone, onParear }) {
  const chaves = useApi(() => api.get('/chaves'), []);
  const [f, setF] = useState({ chaveId: '', solicitante: '', solicitanteDoc: '', observacao: '' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const livres = (chaves.data || []).filter((c) => c.ativa && !c.emprestimo);
  const chave = livres.find((c) => String(c.id) === String(f.chaveId));
  const dados = { tipo: 'retirada', chaveId: Number(f.chaveId), solicitante: f.solicitante.trim(), solicitanteDoc: f.solicitanteDoc.trim() };
  const pronto = !!chave && dados.solicitante.length >= 3;
  const concluir = async (assinaturaId) => {
    await api.post('/chaves/emprestimos', { ...dados, assinaturaId, observacao: f.observacao.trim() });
    onDone();
  };
  return (
    <Modal title="Entrega e Recebimento de Chaves" sub="Retirada — o solicitante assina eletronicamente" onClose={onClose} wide>
      <div className="stack" style={{ gap: 14 }}>
        <Field label="Retirada de chave referente ao local" htmlFor="ch-chave">
          <select id="ch-chave" className="select" value={f.chaveId} onChange={(e) => set('chaveId', e.target.value)}>
            <option value="">{chaves.loading ? 'Carregando…' : livres.length ? 'Selecione a chave…' : 'Nenhuma chave disponível'}</option>
            {livres.map((c) => <option key={c.id} value={c.id}>{c.local} ({c.codigo})</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
          <Field label="Solicitante" htmlFor="ch-sol"><input id="ch-sol" className="input" value={f.solicitante} maxLength={160} onChange={(e) => set('solicitante', e.target.value)} placeholder="Nome completo" /></Field>
          <Field label="Documento / matrícula (opcional)" htmlFor="ch-doc"><input id="ch-doc" className="input" value={f.solicitanteDoc} maxLength={40} onChange={(e) => set('solicitanteDoc', e.target.value)} /></Field>
          <Field label="Data da Retirada"><input className="input" value={dataBr(Date.now())} readOnly aria-readonly="true" /></Field>
          <Responsavel label="Responsável pela Entrega" />
        </div>
        <Field label="Observação (opcional)" htmlFor="ch-obs"><input id="ch-obs" className="input" value={f.observacao} maxLength={400} onChange={(e) => set('observacao', e.target.value)} /></Field>
        <ColetaAssinatura onParear={() => { onClose(); onParear(); }} dados={dados} pronto={pronto} confirmarLabel="Assinar e registrar retirada" onConcluir={concluir} />
      </div>
    </Modal>
  );
}

function DevolucaoModal({ emp, onClose, onDone, onParear }) {
  const [devolvidoPor, setDev] = useState(emp.solicitante);
  const [obs, setObs] = useState('');
  const dados = { tipo: 'devolucao', emprestimoId: emp.id, devolvidoPor: devolvidoPor.trim() };
  const concluir = async (assinaturaId) => {
    await api.post(`/chaves/emprestimos/${emp.id}/devolucao`, { devolvidoPor: dados.devolvidoPor, assinaturaId, ...(obs.trim() ? { observacao: obs.trim() } : {}) });
    onDone();
  };
  return (
    <Modal title="Entrega e Recebimento de Chaves" sub={`Devolução — ${emp.local} (${emp.chaveCodigo})`} onClose={onClose} wide>
      <div className="stack" style={{ gap: 14 }}>
        <p style={{ fontSize: 12.5 }} className="muted">Retirada em {fmtDateTime(emp.retiradaEm)} por <strong>{emp.solicitante}</strong> · entregue por {emp.entreguePor}.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
          <Field label="Quem devolve (solicitante)" htmlFor="ch-dev"><input id="ch-dev" className="input" value={devolvidoPor} maxLength={160} onChange={(e) => setDev(e.target.value)} /></Field>
          <Field label="Data da Devolução"><input className="input" value={dataBr(Date.now())} readOnly aria-readonly="true" /></Field>
          <Responsavel label="Responsável pelo Recebimento" />
        </div>
        <Field label="Observação (opcional)" htmlFor="ch-dobs"><input id="ch-dobs" className="input" value={obs} maxLength={400} onChange={(e) => setObs(e.target.value)} /></Field>
        <ColetaAssinatura onParear={() => { onClose(); onParear(); }} dados={dados} pronto={dados.devolvidoPor.length >= 3}
          confirmarLabel="Assinar e registrar devolução" onConcluir={concluir} />
      </div>
    </Modal>
  );
}

/** Termo no leiaute do modelo "Entrega e Recebimento de Chaves", com as assinaturas eletrônicas. */
function TermoModal({ id, onClose }) {
  const st = useApi(() => api.get('/chaves/emprestimos/' + encodeURIComponent(id)), [id]);
  useEffect(() => { document.body.classList.add('printing-termo'); return () => document.body.classList.remove('printing-termo'); }, []);
  return (
    <Modal title="Termo de entrega e recebimento" onClose={onClose} wide footer={<>
      <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
      <button type="button" className="btn btn-primary" disabled={!st.data} onClick={() => window.print()}>🖨 Imprimir / PDF</button>
    </>}>
      <Async state={st} skeleton={<SkeletonRows n={4} />}>
        {(e) => (
          <div className="termo-chave">
            <h2>Entrega e Recebimento de Chaves</h2>
            <p className="termo-local">Retirada de chave referente ao local: <span className="termo-valor">{e.local} ({e.chaveCodigo})</span></p>
            <Bloco data={['Data da Retirada', dataBr(e.retiradaEm)]} pessoa={e.solicitante + (e.solicitanteDoc ? ' · ' + e.solicitanteDoc : '')}
              assinatura={e.assinaturaRetirada} resp={['Responsável pela Entrega', e.entreguePor]} />
            <Bloco data={['Data da Devolução', e.devolucaoEm ? dataBr(e.devolucaoEm) : '__/__/____']} pessoa={e.devolucaoEm ? e.devolvidoPor : ''}
              assinatura={e.assinaturaDevolucao} resp={['Responsável pelo Recebimento', e.recebidoPor]} />
            {e.observacao && <p className="termo-obs">Observação: {e.observacao}</p>}
            <p className="termo-legal">Documento assinado eletronicamente (assinatura eletrônica simples — Lei nº 14.063/2020, art. 4º, I). A integridade de cada assinatura é garantida pelo código de verificação (SHA-256 do conteúdo assinado, do traço e da data/hora).</p>
          </div>
        )}
      </Async>
    </Modal>
  );
}

function Bloco({ data, pessoa, assinatura, resp }) {
  const a = assinatura;
  return (
    <div className="termo-bloco">
      <p><span>{data[0]}:</span> <span className="termo-valor">{data[1]}</span></p>
      <div className="termo-assin">
        <span>Assinatura - Solicitante:</span>
        <div className="termo-linha">
          {a ? <img src={a.imagem} alt={'Assinatura de ' + pessoa} /> : <span className="muted-3">—</span>}
        </div>
        {pessoa && <small>{pessoa}</small>}
        {a && <small className="termo-meta">Assinado em {fmtDateTime(a.assinadaEm)} · {a.dispositivo === 'tablet' ? 'no tablet' : 'na tela do computador'} · IP {a.ip || '—'} · Código {a.codigo}</small>}
      </div>
      <p><span>{resp[0]}:</span> <span className="termo-valor">{resp[1] || ''}</span></p>
    </div>
  );
}

function Chaves() {
  const toast = useToast();
  const st = useApi(() => api.get('/chaves'), []);
  const [form, setForm] = useState(null);
  const [q, setQ] = useState('');
  const salvar = async (f) => {
    const body = { codigo: f.codigo || '', local: f.local || '', descricao: f.descricao || '' };
    if (f.id) await api.put('/chaves/' + f.id, body); else await api.post('/chaves', body);
    toast(f.id ? 'Chave atualizada.' : 'Chave cadastrada.'); setForm(null); st.reload();
  };
  const ativar = async (c) => {
    try { await api.patch(`/chaves/${c.id}/ativa`, { ativa: !c.ativa }); toast(c.ativa ? 'Chave desativada.' : 'Chave reativada.'); st.reload(); } catch (e) { toast(e.message, 'error'); }
  };
  const k = q.trim().toLowerCase();
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card row" style={{ padding: 16 }}>
        <input type="search" className="input" style={{ flex: 1, minWidth: 180 }} placeholder="🔍 Buscar chave..." aria-label="Buscar chave" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn btn-primary" onClick={() => setForm({ codigo: '', local: '', descricao: '' })}>+ Nova chave</button>
      </div>
      <Async state={st} skeleton={<SkeletonRows n={6} />}>
        {(rows) => {
          const list = rows.filter((c) => !k || (c.codigo + ' ' + c.local + ' ' + c.descricao).toLowerCase().includes(k));
          if (!list.length) return <Empty icon="🔑" title="Nenhuma chave encontrada" />;
          return (
            <div className="table-wrap">
              <table className="table" style={{ minWidth: 680 }}>
                <thead><tr><th>Código</th><th>Local</th><th>Situação</th><th>Ativa</th><th>Ações</th></tr></thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.codigo}</strong></td>
                      <td>{c.local}{c.descricao && <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>{c.descricao}</span>}</td>
                      <td style={{ fontSize: 12 }}>{c.emprestimo ? <>Com <strong>{c.emprestimo.solicitante}</strong><span className="muted" style={{ display: 'block' }}>desde {fmtDateTime(c.emprestimo.retiradaEm)}</span></> : c.ativa ? <Badge level="success">Disponível</Badge> : <span className="muted">Desativada</span>}</td>
                      <td><Switch on={c.ativa} onChange={() => ativar(c)} label={(c.ativa ? 'Desativar ' : 'Ativar ') + c.codigo} disabled={!!c.emprestimo} title={c.emprestimo ? 'Chave emprestada' : undefined} /></td>
                      <td><button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm(c)}>Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }}
      </Async>
      {form && (
        <FormModal title={form.id ? 'Editar chave' : 'Nova chave'} initial={form} onClose={() => setForm(null)} onSubmit={salvar} submitLabel={form.id ? 'Salvar' : 'Cadastrar'}
          fields={[{ key: 'codigo', label: 'Código', placeholder: 'CH-009' }, { key: 'local', label: 'Local', placeholder: 'Sala, setor ou ambiente' }, { key: 'descricao', label: 'Descrição (opcional)', full: true }]} />
      )}
    </div>
  );
}
