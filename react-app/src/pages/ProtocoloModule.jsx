import React, { useState } from 'react';
import { PageHeader } from '../components/Layout.jsx';
import { Async, Badge, Modal, SkeletonCards, SkeletonRows, Tabs, useToast } from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useApi, useDebounced, useQueryState } from '../lib/hooks.js';
import { fmtDate } from '../lib/format.js';
import Calendario from './protocolo/Calendario.jsx';
import PrazoInput from './protocolo/PrazoInput.jsx';

const TABS = [{ key: 'documentos', label: 'Documentos' }, { key: 'processos', label: 'Processos' }, { key: 'fluxo', label: 'Fluxo' }, { key: 'calendario', label: '📅 Calendário Integrado' }];
const DOC_LEVEL = { Registrado: 'info', 'Em Processamento': 'warning', Finalizado: 'success' };
const PRIO_LEVEL = { Alta: 'critical', 'Média': 'warning', Baixa: 'success' };

/** Protocolo: documentos, processos, fluxo padrão e calendário integrado de prazos. */
export default function ProtocoloModule() {
  const [tab, setTab] = useQueryState('tab', 'documentos');
  const meta = useApi(() => api.get('/protocolo/meta'), []);
  const t = tab === 'prazos' ? 'calendario' : TABS.some((x) => x.key === tab) ? tab : 'documentos';
  return (
    <>
      <PageHeader section="Protocolo" title="Protocolo" />
      <main className="page">
        <Tabs tabs={TABS} value={t} onChange={setTab} label="Seções do protocolo" />
        <div className="fade-up" key={t}>
          {t === 'documentos' && <Documentos meta={meta.data} />}
          {t === 'processos' && <Processos meta={meta.data} />}
          {t === 'fluxo' && <Fluxo />}
          {t === 'calendario' && <Calendario modoInicial={tab === 'prazos' ? 'lista' : undefined} />}
        </div>
      </main>
    </>
  );
}

function Documentos({ meta }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('todos');
  const dq = useDebounced(q);
  const st = useApi(() => api.get('/protocolo/documentos' + qs({ q: dq, status: status === 'todos' ? '' : status })), [dq, status]);
  const [form, setForm] = useState(null);
  const move = async (d, dir) => {
    try { await api.post(`/protocolo/documentos/${d.id}/etapa`, { dir }); toast(d.protocolo + (dir > 0 ? ' avançou no fluxo' : ' voltou uma etapa')); st.reload(); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card row" style={{ padding: 16 }}>
        <input type="search" className="input" style={{ flex: 1, minWidth: 180 }} placeholder="🔍 Buscar documento..." aria-label="Buscar documento" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ width: 'auto' }} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todos">Todos os Status</option>{(meta ? meta.fluxo : []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {st.data && <span className="muted-3" style={{ fontSize: 12 }}>{st.data.items.length} de {st.data.total}</span>}
        <button type="button" className="btn btn-primary" onClick={() => setForm({ assunto: '', interessado: '', setor: meta && meta.setores[0] ? meta.setores[0] : '', prazo: '', prazoDesc: '' })}>+ Protocolar Documento</button>
      </div>
      <Async state={st} skeleton={<SkeletonRows n={5} />}>
        {(d) => (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 720 }}>
              <thead><tr><th>Protocolo</th><th>Assunto</th><th>Interessado</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {d.items.map((x) => (
                  <tr key={x.id}>
                    <td><button type="button" className="link-btn" title="Ver e editar documento" onClick={() => setForm(x)}>{x.protocolo}</button></td>
                    <td>{x.assunto}{x.setor && <span className="muted" style={{ display: 'block', fontSize: 11.5 }}>{x.setor}</span>}{x.prazo && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--warn)' }}>Prazo: {fmtDate(x.prazo)} · {x.prazoDesc}</span>}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{x.interessado}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{fmtDate(x.data)}</td>
                    <td><Badge level={DOC_LEVEL[x.status]} bg={DOC_LEVEL[x.status] ? undefined : 'var(--surface-3)'} color={DOC_LEVEL[x.status] ? undefined : 'var(--text-2)'}>{x.status}</Badge></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {x.prev && <button type="button" className="btn btn-secondary btn-sm" title={'Voltar para ' + x.prev} onClick={() => move(x, -1)}>← Voltar</button>}
                        {x.next && <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)' }} onClick={() => move(x, 1)}>{x.next} →</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!d.items.length && <tr><td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center' }} className="muted-3">Nenhum documento encontrado com os filtros atuais.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Async>
      {form && <DocForm meta={meta} initial={form} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); toast(m); st.reload(); }} />}
    </div>
  );
}

function DocForm({ meta, initial, onClose, onSaved }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr(''); };
  const ok = f.assunto.trim() && f.interessado.trim();
  const submit = async (e) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    try {
      const body = { assunto: f.assunto, interessado: f.interessado, setor: f.setor, prazo: f.prazo || '', prazoDesc: f.prazoDesc || '' };
      const r = f.id ? await api.put('/protocolo/documentos/' + f.id, body) : await api.post('/protocolo/documentos', body);
      onSaved('Documento ' + r.protocolo + (f.id ? ' atualizado' : ' protocolado'));
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={f.id ? 'Editar documento ' + f.protocolo : 'Protocolar Documento'} sub={f.id ? 'Status atual: ' + f.status : 'O documento entra com status Registrado'} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" form="doc-form" className="btn btn-primary" disabled={!ok || busy}>{f.id ? 'Salvar alterações' : 'Protocolar'}</button></>}>
      <form id="doc-form" className="stack" style={{ gap: 14 }} onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="d-ass">Assunto</label><input id="d-ass" className="input" value={f.assunto} onChange={set('assunto')} placeholder="Ex: Solicitação de parecer jurídico" /></div>
        <div className="field"><label htmlFor="d-int">Interessado</label><input id="d-int" className="input" value={f.interessado} onChange={set('interessado')} placeholder="Nome do solicitante" /></div>
        <div className="field"><label htmlFor="d-set">Setor de destino</label><input id="d-set" className="input" list="dl-cc-protocolo" autoComplete="off" value={f.setor} onChange={set('setor')} placeholder="Digite ou selecione o centro de custo" />
          <datalist id="dl-cc-protocolo">{(meta ? meta.setores : []).map((s) => <option key={s} value={s} />)}</datalist></div>
        <div className="grid" style={{ '--min': '180px', gap: 12 }}>
          <PrazoInput id="d-prazo" label="Prazo (opcional)" value={f.prazo} padrao={meta && meta.prazoPadrao} onChange={(v) => setF((x) => ({ ...x, prazo: v }))} />
          <div className="field"><label htmlFor="d-pdesc">Descrição do prazo</label><input id="d-pdesc" className="input" value={f.prazoDesc} onChange={set('prazoDesc')} placeholder="Ex.: Resposta ao ofício" /></div>
        </div>
        {err && <p role="alert" style={{ fontSize: 12.5, color: 'var(--crit-strong)', background: 'var(--crit-bg)', padding: '8px 12px', borderRadius: 6 }}>{err}</p>}
      </form>
    </Modal>
  );
}

function Processos({ meta }) {
  const toast = useToast();
  const st = useApi(() => api.get('/protocolo/processos'), []);
  const [form, setForm] = useState(null);
  const step = async (p, delta) => {
    try { const r = await api.post(`/protocolo/processos/${p.id}/progresso`, { delta }); st.setData(st.data.map((x) => (x.id === p.id ? { ...x, progresso: r.progresso } : x))); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div><button type="button" className="btn btn-primary" onClick={() => setForm({ titulo: '', descricao: '', prioridade: 'Média', responsavel: '', prazo: '', prazoDesc: '' })}>+ Novo Processo</button></div>
      <Async state={st} skeleton={<SkeletonCards n={4} h={180} />}>
        {(list) => (
          <div className="grid" style={{ '--min': '280px' }}>
            {list.map((p) => (
              <div key={p.id} className="card" style={{ padding: 16 }}>
                <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                  <button type="button" className="link-btn" title="Ver e editar processo" onClick={() => setForm(p)}>{p.codigo}</button>
                  <Badge level={PRIO_LEVEL[p.prioridade]}>{p.prioridade}</Badge>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{p.titulo}</p>
                <p className="muted" style={{ fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>{p.descricao}</p>
                {p.prazo && <p style={{ fontSize: 11.5, color: 'var(--warn)', marginBottom: 10 }}>Prazo: {fmtDate(p.prazo)} · {p.prazoDesc}</p>}
                <div style={{ marginBottom: 12 }}>
                  <div className="row between" style={{ marginBottom: 4 }}><span className="muted-3" style={{ fontSize: 11, fontWeight: 600 }}>Progresso</span><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{p.progresso}%</span></div>
                  <div role="progressbar" aria-valuenow={p.progresso} aria-valuemin={0} aria-valuemax={100} aria-label={'Progresso de ' + p.codigo} style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}><div style={{ height: '100%', width: p.progresso + '%', background: 'var(--primary)', transition: 'width .3s' }} /></div>
                </div>
                <div className="row between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8, fontSize: 11 }}>
                  <span className="muted-3">Responsável: {p.responsavel || '—'}</span>
                  <div className="row" style={{ gap: 6 }}>
                    {p.progresso > 0 && <button type="button" className="btn btn-secondary btn-sm" title="Voltar 10%" onClick={() => step(p, -10)}>← −10%</button>}
                    {p.progresso < 100 && <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)' }} onClick={() => step(p, 10)}>+10% →</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Async>
      {form && <ProcForm meta={meta} initial={form} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); toast(m); st.reload(); }} />}
    </div>
  );
}

function ProcForm({ meta, initial, onClose, onSaved }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr(''); };
  const submit = async (e) => {
    e.preventDefault();
    if (!f.titulo.trim()) return;
    setBusy(true);
    try {
      const body = { titulo: f.titulo, descricao: f.descricao === 'Sem descrição.' ? '' : f.descricao, prioridade: f.prioridade, responsavel: f.responsavel, prazo: f.prazo || '', prazoDesc: f.prazoDesc || '' };
      const r = f.id ? await api.put('/protocolo/processos/' + f.id, body) : await api.post('/protocolo/processos', body);
      onSaved('Processo ' + r.codigo + (f.id ? ' atualizado' : ' criado'));
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={f.id ? 'Editar processo ' + f.codigo : 'Novo Processo'} sub={f.id ? 'Progresso atual: ' + f.progresso + '%' : 'Inicia na fase de Autuação com 0% de progresso'} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" form="proc-form" className="btn btn-primary" disabled={!f.titulo.trim() || busy}>{f.id ? 'Salvar alterações' : 'Criar processo'}</button></>}>
      <form id="proc-form" className="stack" style={{ gap: 14 }} onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="p-tit">Título</label><input id="p-tit" className="input" value={f.titulo} onChange={set('titulo')} placeholder="Ex: Revisão de contrato de limpeza" /></div>
        <div className="field"><label htmlFor="p-desc">Descrição</label><input id="p-desc" className="input" value={f.descricao} onChange={set('descricao')} placeholder="Resumo do objetivo do processo" /></div>
        <div className="grid" style={{ '--min': '160px', gap: 12 }}>
          <div className="field"><label htmlFor="p-prio">Prioridade</label><select id="p-prio" className="select" value={f.prioridade} onChange={set('prioridade')}>{['Alta', 'Média', 'Baixa'].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="field"><label htmlFor="p-resp">Responsável</label><input id="p-resp" className="input" value={f.responsavel} onChange={set('responsavel')} placeholder="Nome" /></div>
        </div>
        <div className="grid" style={{ '--min': '180px', gap: 12 }}>
          <PrazoInput id="p-prazo" label="Prazo (opcional)" value={f.prazo} padrao={meta && meta.prazoPadrao} onChange={(v) => setF((x) => ({ ...x, prazo: v }))} />
          <div className="field"><label htmlFor="p-pdesc">Descrição do prazo</label><input id="p-pdesc" className="input" value={f.prazoDesc} onChange={set('prazoDesc')} placeholder="Ex.: Resposta ao ofício" /></div>
        </div>
        {err && <p role="alert" style={{ fontSize: 12.5, color: 'var(--crit-strong)', background: 'var(--crit-bg)', padding: '8px 12px', borderRadius: 6 }}>{err}</p>}
      </form>
    </Modal>
  );
}

function Fluxo() {
  const F = [['Autuação', 'Registro', 'var(--primary)', '#fff'], ['Análise', 'Revisão', 'var(--primary)', '#fff'], ['Parecer', 'Em Análise', '#F59E0B', '#fff'], ['Arquivamento', 'Finalização', 'var(--border)', 'var(--text-3)']];
  return (
    <section className="card lg">
      <h3 className="card-title" style={{ marginBottom: 20 }}>Fluxo Padrão de Documentos</h3>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
        {F.map(([n, s, bg, fg], i) => (
          <React.Fragment key={n}>
            {i > 0 && <div aria-hidden="true" style={{ flexGrow: 1, minWidth: 16, height: 2, background: i < 3 ? 'linear-gradient(90deg, var(--primary) 50%, var(--border) 50%)' : 'var(--border)' }} />}
            <div className="stack" style={{ alignItems: 'center', gap: 8, minWidth: 90 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: n.length > 9 ? 9.5 : 12, textAlign: 'center' }}>{n}</div>
              <p className="muted-3" style={{ fontSize: 11 }}>{s}</p>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 6, borderLeft: '3px solid var(--primary)' }}>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}><strong>Processo Padrão:</strong> Os documentos protocolados seguem um fluxo linear pela Diretoria Administrativa. Cada fase possui responsáveis definidos e prazos específicos. O sistema permite acompanhamento em tempo real e notificações automáticas de vencimentos.</p>
      </div>
    </section>
  );
}
