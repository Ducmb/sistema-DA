import React, { useMemo, useState } from 'react';
import { ErrorBox, Badge, ConfirmModal, Field, Modal, SkeletonRows, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useApi, useQueryState } from '../../lib/hooks.js';
import { brl, fmtDate } from '../../lib/format.js';
import { useCostCenters } from '../../lib/cadastros.jsx';
import { useAuth } from '../../lib/auth.jsx';

const COLOR = { ok: 'var(--primary)', na: '#B8C7BF', refazer: '#D97706', pend: 'var(--track)' };
const STBG = { ok: 'var(--accent-soft)', na: 'var(--surface-2)', refazer: 'var(--warn-bg)', pend: 'var(--surface)' };
const MB = { Dispensa: ['var(--info-bg)', 'var(--info)'], Inexigibilidade: ['var(--purple-bg)', 'var(--purple)'], 'Licitação': ['var(--accent-soft)', 'var(--accent)'] };

/** Compras › Controle de Processos (24 etapas: 6 internas + 18 externas). */
export default function Processos() {
  const { user } = useAuth();
  const toast = useToast();
  const meta = useApi(() => api.get('/compras/meta'), []);
  const st = useApi(() => api.get('/compras/processos'), []);
  const setores = useCostCenters('padrao');
  const [procParam, setProcParam] = useQueryState('proc', '');
  const [f, setF] = useState({ q: '', agent: 'todos', status: procParam ? 'todos' : 'ativos', modo: 'todos', etapa: 'todas' });
  const [openId, setOpenId] = useState(procParam ? +procParam : null);
  const [form, setForm] = useState(null); // { editId, nf }
  const [just, setJust] = useState(null);
  const [manage, setManage] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const m = meta.data;
  const d = st.data;
  const agentName = (id) => (m && (m.agents.find((a) => a.id === id) || {}).name) || '';

  const list = useMemo(() => {
    if (!d) return [];
    const q = f.q.trim().toLowerCase();
    if (procParam && d.items.some((p) => p.id === +procParam)) return d.items.filter((p) => p.id === +procParam);
    return d.items.filter((p) => {
      if (f.agent !== 'todos' && (f.agent === '__none' ? !!p.agenteId : String(p.agenteId) !== f.agent)) return false;
      if (q && !(p.interno + ' ' + p.externo + ' ' + p.objeto + ' ' + p.setor).toLowerCase().includes(q)) return false;
      if (f.modo !== 'todos' && p.modo !== f.modo) return false;
      if (f.etapa !== 'todas' && String(p.concluido ? 'fim' : p.current) !== f.etapa) return false;
      return f.status === 'todos' || (f.status === 'ativos' && !p.concluido) || (f.status === 'atrasados' && p.atrasado) || (f.status === 'refazer' && p.refazer) || (f.status === 'concluidos' && p.concluido);
    });
  }, [d, f, procParam]);

  const replace = (p) => st.setData((x) => ({ ...x, items: x.items.map((i) => (i.id === p.id ? { ...i, ...p } : i)) }));
  const changeStage = async (p, idx, value, justificativa) => {
    if (value === 'refazer' && justificativa === undefined && m.refazerJust) { setJust({ p, idx, text: '' }); return; }
    try {
      replace(await api.put(`/compras/processos/${p.id}/etapas/${idx}`, { status: value, justificativa }));
      toast(value === 'refazer' ? 'Etapa marcada para refazer — alerta enviado ao Painel' : m.stages[idx].label + ' atualizada');
      st.refresh();
    } catch (e) { toast(e.message, 'error'); }
  };
  const transfer = async (p, agenteId, msg) => {
    try { await api.put(`/compras/processos/${p.id}/agente`, { agenteId }); toast(msg || (agenteId ? p.interno + ' transferido para ' + agentName(agenteId) : p.interno + ' ficou sem agente')); st.refresh(); } catch (e) { toast(e.message, 'error'); }
  };
  const openNew = (agenteId) => setForm({ editId: null, nf: { interno: '', objeto: '', modo: 'Dispensa', setor: setores[0] || '', valor: '', agenteId: agenteId || (d && d.suggested) || '' } });

  if (!m || !d) { const e = meta.error ? meta : st.error ? st : null; return e ? <ErrorBox error={e.error} onRetry={() => { meta.reload(); st.reload(); }} /> : <SkeletonRows n={6} />; }
  const max = Math.max(1, ...d.loads.map((l) => l.ativos));

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Controle de Processos</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>Fase interna (6 etapas) e fase externa (18 etapas). Etapa parada há mais de {m.sla} dias úteis fica marcada como atrasada.</p>
        </div>
        <div className="row">
          <label className="row" style={{ gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', flexWrap: 'nowrap' }} title="Definido pelo seu perfil de acesso">Atuando como
            <select className="select" style={{ width: 'auto', minHeight: 40 }} disabled value="eu"><option value="eu">{(user ? user.name : '') + (m.isChefia ? ' (Chefia)' : ' (Agente de contratação)')}</option></select>
          </label>
          {(m.isChefia || !m.chefiaConfirma) && <button type="button" className="btn btn-primary" onClick={() => openNew()}>+ Novo processo</button>}
        </div>
      </div>

      <section className="card">
        <h3 style={{ fontSize: 14, fontWeight: 700, paddingBottom: 10, marginBottom: 14, borderBottom: '1px solid var(--primary)' }}>Carga por agente de contratação</h3>
        <div className="grid" style={{ '--min': '190px', gap: 12 }}>
          {d.loads.map((l) => {
            const on = f.agent === String(l.agenteId);
            return (
              <div key={l.agenteId} style={{ border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'), background: on ? 'var(--accent-soft)' : 'var(--surface)', borderRadius: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <button type="button" aria-pressed={on} title="Filtrar processos deste agente" onClick={() => { setProcParam(''); setF({ ...f, agent: on ? 'todos' : String(l.agenteId) }); }} style={{ textAlign: 'left', border: 'none', background: 'none', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="row between" style={{ flexWrap: 'nowrap' }}><span style={{ fontSize: 13, fontWeight: 700 }}>{l.agente}</span>{m.sugerirAgente && d.suggested === l.agenteId && <Badge color="var(--accent)" bg="var(--accent-soft)">Menor carga</Badge>}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{l.ativos}</span><span style={{ fontSize: 12, color: 'var(--text-2)' }}>ativos de {l.total}</span></div>
                  <div className="progress"><div style={{ width: Math.round((l.ativos / max) * 100) + '%' }} /></div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: l.atrasados ? 'var(--crit)' : 'var(--accent)' }}>{l.atrasados ? l.atrasados + ' com etapa atrasada' : 'Sem atrasos'}</span>
                </button>
                {m.isChefia && <button type="button" onClick={() => setManage(l.agenteId)} style={{ minHeight: 40, border: 'none', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700 }}>Adicionar / remover processos</button>}
              </div>
            );
          })}
        </div>
        {d.unassigned > 0 && (
          <button type="button" onClick={() => { setProcParam(''); setF({ ...f, agent: '__none', status: 'todos' }); }} style={{ marginTop: 12, width: '100%', textAlign: 'left', minHeight: 44, padding: '10px 14px', border: '1px solid #F3D9A4', borderRadius: 8, background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 12.5, fontWeight: 700 }}>
            {d.unassigned} processo(s) sem agente — clique para ver e atribuir a um agente
          </button>
        )}
      </section>

      <div className="card row" style={{ padding: 14 }}>
        <input type="search" className="input" style={{ flex: 1, minWidth: 200, width: 'auto' }} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Buscar por nº do processo ou objeto" aria-label="Buscar processo" />
        <select className="select" style={{ width: 'auto' }} value={f.agent} onChange={(e) => setF({ ...f, agent: e.target.value })} aria-label="Filtrar por agente">
          <option value="todos">Todos os agentes</option><option value="__none">Sem agente</option>{m.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Filtrar por situação">
          <option value="ativos">Em andamento</option><option value="atrasados">Atrasados</option><option value="refazer">Com etapa a refazer</option><option value="concluidos">Concluídos</option><option value="todos">Todos</option>
        </select>
        <select className="select" style={{ width: 'auto' }} value={f.modo} onChange={(e) => setF({ ...f, modo: e.target.value })} aria-label="Filtrar por modo de contratação"><option value="todos">Todos os modos</option>{m.modos.map((x) => <option key={x}>{x}</option>)}</select>
        <select className="select" style={{ width: 'auto', maxWidth: 220 }} value={f.etapa} onChange={(e) => setF({ ...f, etapa: e.target.value })} aria-label="Filtrar por etapa atual">
          <option value="todas">Todas as etapas</option>{m.stages.map((s) => <option key={s.idx} value={s.idx}>{s.idx + 1}. {s.label}{s.idx < 6 ? ' (interna)' : ''}</option>)}<option value="fim">Concluídos</option>
        </select>
        {procParam && (
          <span className="row" style={{ gap: 8, minHeight: 40, padding: '0 6px 0 12px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700 }}>
            Exibindo só {(d.items.find((p) => p.id === +procParam) || {}).interno}
            <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: 30, borderRadius: 999 }} onClick={() => setProcParam('')} aria-label="Mostrar todos os processos">Mostrar todos ✕</button>
          </span>
        )}
        <span className="muted" style={{ fontSize: 12 }}>{list.length} processo(s)</span>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {list.map((p) => {
          const open = openId === p.id, mb = MB[p.modo] || MB.Dispensa;
          return (
            <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden', borderColor: p.atrasado ? '#F5C2C2' : p.refazer ? '#F3D9A4' : undefined }}>
              <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : p.id)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '14px 16px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center' }}>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>{p.interno}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Externo {p.externo}</span>
                    <Badge bg={p.agenteId ? 'var(--surface-3)' : 'var(--warn-bg)'} color={p.agenteId ? 'var(--text-2)' : 'var(--warn)'}>{p.agente || 'Sem agente'}</Badge>
                    <Badge bg={mb[0]} color={mb[1]}>{p.modo}</Badge>
                    {p.atrasado && <Badge level="critical">Atrasado · {p.delay} dias úteis</Badge>}
                    {p.refazer && <Badge level="warning">Refazer</Badge>}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{p.objeto}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Requisitante: <strong>{p.setor}</strong> · Valor estimado: <strong>{brl(p.valor)}</strong></p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22 }} aria-label={`Progresso das 24 etapas: ${p.done} concluída(s)`}>
                    {p.stages.map((s, i) => <div key={i} title={`${i + 1}. ${m.stages[i].label}`} style={{ width: 7, height: i === p.current ? 22 : 16, borderRadius: 2, background: COLOR[s.s], marginLeft: i === 6 ? 8 : 0 }} />)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{p.concluido ? 'Concluído' : p.fase === 'interna' ? 'Fase interna' : 'Fase externa'}</p>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>{p.currentLabel}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{p.pct}% concluído</p>
                </div>
              </button>
              {open && (
                <div style={{ borderTop: '1px solid var(--divider)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-2)' }}>
                  <div className="row">
                    {p.canEdit && <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm({ editId: p.id, nf: { interno: p.interno, externo: p.externo, objeto: p.objeto, modo: p.modo, setor: p.setor, valor: String(p.valor || '') } })}>✎ Editar informações</button>}
                    {m.isChefia && (
                      <>
                        <label className="row" style={{ gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Transferir para
                          <select className="select" style={{ width: 'auto', minHeight: 40 }} value={p.agenteId || ''} onChange={(e) => transfer(p, e.target.value ? +e.target.value : null)} aria-label="Transferir processo">
                            <option value="">Sem agente</option>{m.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </label>
                        <button type="button" className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setConfirmDel(p)}>Remover processo</button>
                      </>
                    )}
                  </div>
                  {!p.canEdit && <p style={{ fontSize: 12, color: 'var(--warn)', background: 'var(--warn-bg)', padding: '8px 12px', borderRadius: 6 }}>Somente leitura: apenas {p.agente || 'o agente responsável'} (responsável) e a chefia podem marcar etapas.</p>}
                  {[['Fase interna', 0, 6], ['Fase externa', 6, 24]].map(([title, a, b]) => (
                    <div key={title}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{title}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                        {p.stages.slice(a, b).map((s, k) => {
                          const i = a + k;
                          return (
                            <div key={i} style={{ border: '1px solid ' + (s.s === 'refazer' ? '#F3D9A4' : 'var(--border)'), background: STBG[s.s], borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div className="row between" style={{ gap: 6, flexWrap: 'nowrap' }}><span style={{ fontSize: 12, fontWeight: 600 }}>{i + 1}. {m.stages[i].label}</span><span style={{ fontSize: 10.5, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{s.date ? fmtDate(s.date) : s.since ? 'desde ' + fmtDate(s.since) : s.note || ''}</span></div>
                              <select className="select" style={{ minHeight: 36, fontSize: 12.5 }} value={s.s} disabled={!p.canEdit} onChange={(e) => changeStage(p, i, e.target.value)} aria-label={'Situação da etapa ' + m.stages[i].label}>
                                <option value="pend">Pendente</option><option value="ok">Concluída</option><option value="refazer">Refazer</option><option value="na">Não se aplica</option>
                              </select>
                              {s.just && <p style={{ fontSize: 11, color: 'var(--warn)' }}>Justificativa: {s.just}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!list.length && <p className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-2)' }}>Nenhum processo com esses filtros.</p>}
      </div>

      {just && (
        <ConfirmModal title='Justificar "Refazer"' message={`Etapa ${just.idx + 1} — ${m.stages[just.idx].label} (${just.p.interno}). A justificativa é obrigatória e gera um alerta amarelo no Painel.`}
          requireText="" textLabel="Justificativa" textPlaceholder="Ex.: Pesquisa de preços com apenas 2 cotações válidas" confirmLabel="Marcar para refazer" onClose={() => setJust(null)} onConfirm={(t) => changeStage(just.p, just.idx, 'refazer', t)} />
      )}
      {confirmDel && (
        <ConfirmModal title="Remover processo" danger confirmLabel="Remover processo" message={`Remover o processo ${confirmDel.interno}? Esta ação fica registrada na auditoria.`}
          onClose={() => setConfirmDel(null)} onConfirm={async () => { await api.del('/compras/processos/' + confirmDel.id); setOpenId(null); toast('Processo removido'); st.refresh(); }} />
      )}
      {form && <ProcessoForm form={form} setForm={setForm} meta={m} data={d} setores={setores} onSaved={(msg) => { setForm(null); toast(msg); st.refresh(); }} />}
      {manage && <ManageAgent agenteId={manage} name={agentName(manage)} data={d} onClose={() => setManage(null)} transfer={transfer} onNew={() => { setManage(null); openNew(manage); }} />}
    </div>
  );
}

function ProcessoForm({ form, setForm, meta, data, setores, onSaved }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nf = form.nf, isEdit = !!form.editId;
  const set = (k) => (e) => { setForm({ ...form, nf: { ...nf, [k]: e.target.value } }); setErr(''); };
  const can = nf.interno.trim() && nf.objeto.trim() && nf.setor && (isEdit || nf.agenteId);
  const submit = async () => {
    setBusy(true);
    const body = { interno: nf.interno, externo: nf.externo, objeto: nf.objeto, modo: nf.modo, setor: nf.setor, valor: +nf.valor || 0 };
    try {
      if (isEdit) { await api.put('/compras/processos/' + form.editId, body); onSaved('Processo atualizado'); }
      else { await api.post('/compras/processos', { ...body, agenteId: +nf.agenteId }); onSaved('Processo atribuído a ' + (meta.agents.find((a) => a.id === +nf.agenteId) || {}).name); }
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  const sug = data.loads.find((l) => l.agenteId === data.suggested);
  return (
    <Modal title={isEdit ? 'Editar processo' : 'Novo processo'} onClose={() => setForm(null)} footer={<>
      <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={!can || busy} onClick={submit}>{isEdit ? 'Salvar alterações' : 'Confirmar atribuição'}</button>
    </>}>
      <Field label="Nº do processo interno" htmlFor="np-int"><input id="np-int" className="input" value={nf.interno} onChange={set('interno')} placeholder="2450/2026" /></Field>
      {isEdit && <Field label="Nº do processo externo" htmlFor="np-ext"><input id="np-ext" className="input" value={nf.externo || ''} onChange={set('externo')} /></Field>}
      <Field label="Objeto" htmlFor="np-obj"><input id="np-obj" className="input" value={nf.objeto} onChange={set('objeto')} placeholder="Aquisição de..." /></Field>
      <Field label="Modo de contratação" htmlFor="np-modo"><select id="np-modo" className="select" value={nf.modo} onChange={set('modo')}>{meta.modos.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Setor requisitante" htmlFor="np-setor"><input id="np-setor" className="input" list="dl-np-setor" autoComplete="off" placeholder="Digite ou selecione o centro de custo" value={nf.setor} onChange={set('setor')} /><datalist id="dl-np-setor">{setores.map((s) => <option key={s} value={s} />)}</datalist></Field>
      <Field label="Valor estimado (R$)" htmlFor="np-valor"><input id="np-valor" type="number" min="0" step="0.01" className="input" value={nf.valor} onChange={set('valor')} placeholder="0,00" /></Field>
      {!isEdit && (
        <Field label="Agente de contratação" htmlFor="np-ag" hint={meta.sugerirAgente && sug ? `Sugestão do sistema: ${sug.agente} (menor número de processos ativos).` : undefined}>
          <select id="np-ag" className="select" value={nf.agenteId} onChange={set('agenteId')}>
            <option value="">Selecione…</option>{data.loads.map((l) => <option key={l.agenteId} value={l.agenteId}>{l.agente} — {l.ativos} ativos</option>)}
          </select>
        </Field>
      )}
      {!isEdit && !meta.isChefia && meta.chefiaConfirma && <p style={{ fontSize: 12, color: 'var(--warn)', background: 'var(--warn-bg)', padding: '8px 12px', borderRadius: 6 }}>A atribuição precisa ser confirmada pela chefia.</p>}
      {err && <div className="alert-box error" role="alert">{err}</div>}
    </Modal>
  );
}

function ManageAgent({ agenteId, name, data, onClose, transfer, onNew }) {
  const [q, setQ] = useState('');
  const own = data.items.filter((p) => p.agenteId === agenteId);
  const others = data.items.filter((p) => p.agenteId !== agenteId);
  const label = (p) => `${p.interno} — ${p.objeto} (${p.agente || 'sem agente'})`;
  const k = q.trim().toLowerCase();
  const exact = others.find((p) => label(p).toLowerCase() === k);
  const hits = k ? others.filter((p) => (p.interno + ' ' + p.externo + ' ' + p.objeto).toLowerCase().includes(k)) : [];
  const pick = exact || (hits.length === 1 ? hits[0] : null);
  return (
    <Modal title={'Processos de ' + name} sub={own.length + ' processo(s) atribuído(s). Ações registradas na auditoria.'} onClose={onClose} wide>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Adicionar processo existente</p>
        <div className="row">
          <input type="search" list="dl-add-proc" className="input" style={{ flex: 1, minWidth: 220, width: 'auto' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nº do processo ou objeto…" aria-label="Processo a adicionar" autoComplete="off" />
          <datalist id="dl-add-proc">{others.map((p) => <option key={p.id} value={label(p)} />)}</datalist>
          <button type="button" className="btn btn-primary" disabled={!pick} title={q && !pick ? 'Refine a busca até restar um único processo' : ''} onClick={() => { transfer(pick, agenteId, pick.interno + ' adicionado a ' + name); setQ(''); }}>Adicionar</button>
        </div>
        <button type="button" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onNew}>+ Criar novo processo para {name}</button>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        {own.map((p) => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
            <div style={{ minWidth: 0 }}><p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>{p.interno} · <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{p.modo} · {p.currentLabel}</span></p><p style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{p.objeto}</p></div>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => transfer(p, null, p.interno + ' retirado de ' + name)}>Remover do agente</button>
          </div>
        ))}
        {!own.length && <p style={{ padding: 16, textAlign: 'center', color: 'var(--text-2)' }}>Nenhum processo atribuído a este agente.</p>}
      </div>
      <p className="hint">"Remover do agente" deixa o processo sem responsável (ele continua no controle). Para excluir o processo, use "Remover processo" dentro dele.</p>
    </Modal>
  );
}
