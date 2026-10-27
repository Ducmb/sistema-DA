import React, { useState } from 'react';
import { Async, ConfirmModal, Modal, SkeletonRows, Switch, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/hooks.js';
import { fmtDate, maskDoc, maskPhone, todayIso } from '../../lib/format.js';
import { errStyle } from './MocoesModule.jsx';

const ST = {
  aguardando: ['Aguardando retirada', 'var(--info-bg)', 'var(--info-strong)'], naoRetirado: ['Retirada não realizada', 'var(--warn-bg)', 'var(--warn-title)'],
  emprestado: ['Emprestado', 'var(--warn-bg)', 'var(--warn-title)'], atrasado: ['Devolução atrasada', 'var(--crit-bg)', 'var(--crit-strong)'],
  devolvido: ['Devolvido', 'var(--accent-soft)', 'var(--accent)'], pendencia: ['Devolvido com pendência', 'var(--crit-bg)', 'var(--crit-strong)']
};
const ALL = ['bauru', 'sp', 'brasil', 'mastros', 'suporte'];

/** Controle de Bandeiras: solicitação, retirada, devolução e conferência. */
export default function Bandeiras({ meta }) {
  const toast = useToast();
  const st = useApi(() => api.get('/mocoes/bandeiras'), []);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('todos');
  const [form, setForm] = useState(null);
  const itens = meta ? meta.itens : [];
  const hoje = todayIso();
  const retirar = async (r) => { try { await api.post(`/mocoes/bandeiras/${r.id}/retirada`); toast('Retirada registrada — ' + r.entidade); st.reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Controle de Bandeiras</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 2, maxWidth: 640 }}>Empréstimo de bandeiras, mastros e suportes a empresas e entidades: solicitação, retirada, devolução e conferência.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setForm({ entidade: '', documento: '', telefone: '', solicitacao: hoje, protocolo: '', retirado: false, retirada: '', devolucao: '', conformidade: '', obs: '', itens: ALL.slice() })}>+ Nova solicitação</button>
      </div>
      <Async state={st} skeleton={<SkeletonRows n={4} />}>
        {(all) => {
          const count = (k) => all.filter((r) => r.situacao === k).length;
          const t = q.trim().toLowerCase();
          const list = all.filter((r) => (filter === 'todos' || r.situacao === filter) && (!t || (r.entidade + ' ' + r.documento + ' ' + maskDoc(r.documento) + ' ' + r.protocolo).toLowerCase().includes(t)));
          const kpi = (label, key, value, color) => (
            <button key={key} type="button" className="kpi" onClick={() => setFilter(key === 'fora' ? 'emprestado' : filter === key ? 'todos' : key)} style={{ borderColor: filter === key ? 'var(--primary)' : undefined }}>
              <span className="k-label" style={{ display: 'block' }}>{label}</span><span className="k-value" style={{ display: 'block', color }}>{value}</span>
            </button>
          );
          return (
            <>
              <div className="grid" style={{ '--min': '170px', gap: 12 }}>
                {kpi('Aguardando retirada', 'aguardando', count('aguardando'), 'var(--info-strong)')}
                {kpi('Retirada não realizada', 'naoRetirado', count('naoRetirado'), count('naoRetirado') ? 'var(--warn-title)' : 'var(--accent)')}
                {kpi('Fora da Câmara', 'fora', count('emprestado') + count('atrasado'), 'var(--warn-title)')}
                {kpi('Devolução atrasada', 'atrasado', count('atrasado'), count('atrasado') ? 'var(--crit-strong)' : 'var(--accent)')}
                {kpi('Devolvidos com pendência', 'pendencia', count('pendencia'), count('pendencia') ? 'var(--crit-strong)' : 'var(--accent)')}
              </div>
              <div className="card row" style={{ padding: 14 }}>
                <input type="search" className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Buscar entidade, CPF/CNPJ ou protocolo 1Doc" aria-label="Buscar empréstimo" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className="select" style={{ width: 'auto' }} aria-label="Filtrar por situação" value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="todos">Todas as situações</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
                </select>
                <span className="muted" style={{ fontSize: 12 }}>{list.length} registro(s)</span>
              </div>
              <div className="table-wrap">
                <table className="table" style={{ minWidth: 1060, fontSize: 12.5 }}>
                  <thead><tr><th>Solicitação</th><th>Empresa / Entidade</th><th>Protocolo 1Doc</th><th>Itens</th><th>Retirada</th><th>Devolução</th><th>Situação</th><th style={{ textAlign: 'right' }}>Ações</th></tr></thead>
                  <tbody>
                    {list.map((r) => {
                      const S = ST[r.situacao];
                      return (
                        <tr key={r.id}>
                          <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.solicitacao)}</td>
                          <td><span style={{ display: 'block', fontWeight: 700 }}>{r.entidade}</span><span className="muted" style={{ display: 'block', fontSize: 11.5, marginTop: 2 }}>{r.documento ? maskDoc(r.documento) : 'Sem CPF/CNPJ'} · {r.telefone || 'sem telefone'}</span></td>
                          <td style={{ fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{r.protocolo || '—'}</td>
                          <td><div className="row" style={{ gap: 4, maxWidth: 260 }}>{itens.filter((i) => r.itens.includes(i.key)).map((i) => <span key={i.key} className="badge" style={{ borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)' }}>{i.short}</span>)}</div></td>
                          <td style={{ whiteSpace: 'nowrap', color: r.retirado ? 'var(--text)' : r.situacao === 'naoRetirado' ? 'var(--warn-title)' : 'var(--info-strong)' }}>{r.retirado ? fmtDate(r.retirada) : r.retirada ? 'Agendada ' + fmtDate(r.retirada) : 'Não agendada'}</td>
                          <td style={{ whiteSpace: 'nowrap', color: r.situacao === 'atrasado' ? 'var(--crit-strong)' : undefined, fontWeight: r.situacao === 'atrasado' ? 700 : 400 }}>{r.devolucao ? fmtDate(r.devolucao) + (r.retirado && !r.conformidade ? ' (prevista)' : '') : '—'}</td>
                          <td><span className="badge" style={{ borderRadius: 999, background: S[1], color: S[2], whiteSpace: 'nowrap' }}>{S[0]}</span></td>
                          <td>
                            <div className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                              {(r.situacao === 'aguardando' || r.situacao === 'naoRetirado') && <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)', borderColor: 'var(--primary)', whiteSpace: 'nowrap' }} onClick={() => retirar(r)}>Registrar retirada</button>}
                              {(r.situacao === 'emprestado' || r.situacao === 'atrasado') && <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)', borderColor: 'var(--primary)', whiteSpace: 'nowrap' }} onClick={() => setForm({ ...r, documento: maskDoc(r.documento), devolucao: r.devolucao && r.devolucao <= hoje ? r.devolucao : hoje, conformidade: 'Sim' })}>Registrar devolução</button>}
                              <button type="button" className="btn btn-secondary btn-sm" aria-label={'Editar registro de ' + r.entidade} onClick={() => setForm({ ...r, documento: maskDoc(r.documento) })}>Editar</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!list.length && <p className="muted" style={{ padding: 28, textAlign: 'center', fontSize: 13 }}>Nenhum registro encontrado.</p>}
              </div>
            </>
          );
        }}
      </Async>
      {form && <BandForm itens={itens} initial={form} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); toast(m); st.reload(); }} />}
    </div>
  );
}

function BandForm({ itens, initial, onClose, onSaved }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const hoje = todayIso();
  const set = (k, mask) => (e) => { const v = mask ? mask(e.target.value) : e.target.value; setF({ ...f, [k]: v }); setErr(''); };
  const save = async (e) => {
    e.preventDefault();
    if (!f.entidade.trim()) return setErr('Informe a empresa ou entidade.');
    if (!f.itens.length) return setErr('Selecione ao menos um item emprestado.');
    try {
      const body = { entidade: f.entidade, documento: f.documento, telefone: f.telefone, solicitacao: f.solicitacao, protocolo: f.protocolo, itens: f.itens, retirado: f.retirado, retirada: f.retirada, devolucao: f.devolucao, conformidade: f.retirado ? f.conformidade : '', obs: f.obs };
      if (f.id) await api.put('/mocoes/bandeiras/' + f.id, body); else await api.post('/mocoes/bandeiras', body);
      onSaved(f.id ? 'Registro atualizado' : 'Solicitação registrada');
    } catch (x) { setErr(x.message); }
  };
  const remove = async () => { try { await api.delete('/mocoes/bandeiras/' + f.id); onSaved('Registro excluído'); } catch (x) { setErr(x.message); setConfirm(false); } };
  const section = (t) => <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.4, paddingBottom: 8, marginBottom: 12, borderBottom: '1px solid var(--primary)' }}>{t}</p>;
  return (
    <>
      <Modal wide title={f.id ? 'Editar empréstimo — ' + f.entidade : 'Nova solicitação de bandeiras'} onClose={onClose}
        footer={<>
          {f.id && <button type="button" className="btn btn-secondary" style={{ color: 'var(--crit-strong)', borderColor: 'var(--crit-bg)', marginRight: 'auto' }} onClick={() => setConfirm(true)}>Excluir</button>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="band-form" className="btn btn-primary">Salvar</button>
        </>}>
        <form id="band-form" className="stack" style={{ gap: 18 }} onSubmit={save} noValidate>
          <div>
            {section('Solicitante')}
            <div className="grid" style={{ '--min': '180px', gap: 12 }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="b-ent">Empresa / Entidade</label><input id="b-ent" className="input" value={f.entidade} onChange={set('entidade')} /></div>
              <div className="field"><label htmlFor="b-doc">CPF / CNPJ</label><input id="b-doc" className="input" inputMode="numeric" value={f.documento} onChange={set('documento', maskDoc)} placeholder="000.000.000-00" /></div>
              <div className="field"><label htmlFor="b-tel">Telefone</label><input id="b-tel" type="tel" className="input" value={f.telefone} onChange={set('telefone', maskPhone)} placeholder="(14) 99999-9999" /></div>
              <div className="field"><label htmlFor="b-sol">Data da solicitação</label><input id="b-sol" type="date" className="input" value={f.solicitacao} onChange={set('solicitacao')} /></div>
              <div className="field"><label htmlFor="b-prot">Protocolo 1Doc</label><input id="b-prot" className="input" value={f.protocolo} onChange={set('protocolo')} placeholder="1633/2026" /></div>
            </div>
          </div>
          <div>
            {section('Itens emprestados')}
            <div className="grid" style={{ '--min': '170px', gap: 8 }}>
              {itens.map((i) => {
                const on = f.itens.includes(i.key);
                return (
                  <label key={i.key} className="row between" style={{ minHeight: 44, padding: '0 12px', border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border-input)'), borderRadius: 8, background: on ? 'var(--accent-soft)' : 'var(--surface)', fontSize: 13, fontWeight: 600, flexWrap: 'nowrap' }}>
                    {i.label}<Switch on={on} label={i.label} onChange={() => { setF({ ...f, itens: on ? f.itens.filter((x) => x !== i.key) : f.itens.concat(i.key) }); setErr(''); }} />
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            {section('Retirada e devolução')}
            <div className="grid" style={{ '--min': '180px', gap: 12 }}>
              <div className="field"><label htmlFor="b-retq">Foi retirado?</label><select id="b-retq" className="select" value={f.retirado ? 'Sim' : 'Não'} onChange={(e) => { const s = e.target.value === 'Sim'; setF({ ...f, retirado: s, retirada: s ? f.retirada || hoje : f.retirada, conformidade: s ? f.conformidade : '' }); setErr(''); }}><option>Não</option><option>Sim</option></select></div>
              <div className="field"><label htmlFor="b-ret">{f.retirado ? 'Data da retirada' : 'Retirada agendada para'}</label><input id="b-ret" type="date" className="input" value={f.retirada} onChange={set('retirada')} /></div>
              <div className="field"><label htmlFor="b-dev">Data da devolução</label><input id="b-dev" type="date" className="input" value={f.devolucao} onChange={set('devolucao')} /></div>
              <div className="field"><label htmlFor="b-conf">Devolvido em conformidade</label><select id="b-conf" className="select" value={f.conformidade} disabled={!f.retirado} onChange={set('conformidade')}><option value="">Ainda não devolvido</option><option>Sim</option><option>Não</option></select></div>
              {f.conformidade === 'Não' && <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="b-obs">O que não está em conformidade?</label><input id="b-obs" className="input" value={f.obs} onChange={set('obs')} placeholder="Ex.: mastro danificado, bandeira de SP não devolvida" /></div>}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>Enquanto "Foi retirado?" estiver como Não, a data da retirada é o agendamento. Antes da devolução, a data de devolução é a prevista e indica atraso.</p>
          </div>
          {err && <p role="alert" style={errStyle}>{err}</p>}
        </form>
      </Modal>
      {confirm && <ConfirmModal title="Excluir registro" message={'Excluir o registro de ' + f.entidade + '?'} confirmLabel="Excluir" danger onConfirm={remove} onClose={() => setConfirm(false)} />}
    </>
  );
}
