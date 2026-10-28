import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout.jsx';
import { Async, Badge, Empty, Field, Modal, SkeletonCards, SkeletonRows, Switch, Tabs, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useApi, useQueryState } from '../lib/hooks.js';
import { fmtDate, fmtDateTime, initials } from '../lib/format.js';
import { useCostCenters } from '../lib/cadastros.jsx';

const SIT_STYLE = { Ativo: ['var(--accent-soft)', 'var(--accent)'], Afastado: ['var(--warn-bg)', 'var(--warn)'], Aposentado: ['var(--info-bg)', 'var(--info-strong)'], Desligado: ['var(--surface-3)', 'var(--text-2)'] };
const ATIVO = (s) => s !== 'Desligado' && s !== 'Aposentado';
const VAC_STYLE = { Aprovado: ['var(--accent-soft)', 'var(--accent)'], Pendente: ['var(--warn-bg)', 'var(--warn)'], Recusado: ['var(--crit-bg)', 'var(--crit)'] };

/** Módulo de Gestão de Pessoal: servidores, férias/licenças, indicadores e usuários & permissões. */
export default function Pessoal() {
  const [tab, setTab] = useQueryState('tab', 'employees');
  const tabs = [{ key: 'employees', label: 'Servidores' }, { key: 'vacation', label: 'Férias e Licenças' }, { key: 'analytics', label: 'Indicadores' }, { key: 'usuarios', label: 'Usuários & Permissões' }];
  return (
    <>
      <PageHeader section="Gestão de Pessoal" title="Módulo de Gestão de Pessoal" />
      <main className="page">
        <Tabs tabs={tabs} value={tab === 'rbac' ? 'usuarios' : tab} onChange={setTab} label="Seções de Gestão de Pessoal" />
        {tab === 'employees' && <Servidores />}
        {tab === 'vacation' && <Ferias />}
        {tab === 'analytics' && <Indicadores />}
        {(tab === 'usuarios' || tab === 'rbac') && <Usuarios />}
      </main>
    </>
  );
}

/* ---------------- Servidores ---------------- */
function Servidores() {
  const toast = useToast();
  const [f, setF] = useState({ situacao: '', setor: '' });
  const st = useApi(() => api.get('/pessoal/servidores'), []);
  const sectors = useCostCenters('padrao');
  const [modal, setModal] = useState(null); // { mode, form }
  const list = (st.data || []).filter((e) => (!f.situacao || e.situacao === f.situacao) && (!f.setor || e.department === f.setor));

  return (
    <div className="fade-up stack" style={{ gap: 16 }}>
      <div className="card row between" style={{ padding: 16 }}>
        <div className="row">
          <select className="select" style={{ width: 'auto' }} value={f.situacao} onChange={(e) => setF({ ...f, situacao: e.target.value })} aria-label="Situação">
            <option value="">Todos os Status</option><option>Ativo</option><option>Afastado</option><option>Aposentado</option><option>Desligado</option>
          </select>
          <select className="select" style={{ width: 'auto', maxWidth: 280 }} value={f.setor} onChange={(e) => setF({ ...f, setor: e.target.value })} aria-label="Setor">
            <option value="">Todos os Setores</option>{sectors.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModal({ mode: 'new', form: { name: '', registration: '', position: '', department: sectors[0] || '', situacao: 'Ativo', email: '' } })}>+ Novo Servidor</button>
      </div>
      <Async state={st} skeleton={<SkeletonRows />} empty={{ when: () => !list.length, title: 'Nenhum servidor encontrado', text: 'Ajuste os filtros.' }}>
        {() => (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 680 }}>
              <thead><tr><th>Servidor</th><th>Cargo</th><th>Setor</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <div className="avatar" style={{ width: 32, height: 32, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12 }}>{initials(e.name)}</div>
                        <div><p style={{ fontWeight: 600 }}>{e.name}</p><p style={{ fontSize: 11, color: 'var(--text-3)' }}>MAT: {e.registration || '—'}</p></div>
                      </div>
                    </td>
                    <td className="muted">{e.position || '—'}</td>
                    <td className="muted">{e.department || '—'}</td>
                    <td><Badge bg={SIT_STYLE[e.situacao][0]} color={SIT_STYLE[e.situacao][1]}>{e.situacao}</Badge></td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModal({ mode: 'view', form: { ...e } })}>Ver</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModal({ mode: 'edit', form: { ...e } })}>Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>
      {modal && <ServidorModal modal={modal} setModal={setModal} sectors={sectors} onSaved={(msg) => { setModal(null); toast(msg); st.refresh(); }} />}
    </div>
  );
}

function ServidorModal({ modal, setModal, sectors, onSaved }) {
  const { isAdmin } = useAuth();
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const { mode, form } = modal;
  const ro = mode === 'view';
  const set = (k) => (e) => { setModal({ ...modal, form: { ...form, [k]: e.target.value } }); setErr({}); };
  const valid = form.name.trim() && form.registration.trim();
  const save = async () => {
    setBusy(true);
    try {
      if (mode === 'new') await api.post('/pessoal/servidores', form); else await api.put('/pessoal/servidores/' + form.id, form);
      onSaved(mode === 'new' ? 'Servidor cadastrado' : 'Servidor atualizado');
    } catch (e) { setErr({ ...e.fields, _: e.message }); } finally { setBusy(false); }
  };
  const title = mode === 'new' ? 'Novo servidor' : mode === 'edit' ? 'Editar servidor' : 'Dados do servidor';
  const emailLocked = ro || (form.hasAccess && !isAdmin);
  return (
    <Modal title={title} onClose={() => setModal(null)} footer={<>
      <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Fechar</button>
      {ro && <button type="button" className="btn btn-outline" onClick={() => setModal({ ...modal, mode: 'edit' })}>Editar</button>}
      {!ro && <button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar'}</button>}
    </>}>
      <Field label="Nome completo" htmlFor="sv-nome" error={err.name}><input id="sv-nome" className="input" value={form.name} onChange={set('name')} readOnly={ro} /></Field>
      <Field label="Matrícula" htmlFor="sv-mat" error={err.registration}><input id="sv-mat" className="input" value={form.registration} onChange={set('registration')} readOnly={ro} /></Field>
      <Field label="Cargo" htmlFor="sv-cargo"><input id="sv-cargo" className="input" value={form.position} onChange={set('position')} readOnly={ro} /></Field>
      <Field label="Setor" htmlFor="sv-setor">
        <input id="sv-setor" className="input" list="dl-cc-servidor" autoComplete="off" placeholder="Digite ou selecione o centro de custo" value={form.department} onChange={set('department')} disabled={ro} />
        <datalist id="dl-cc-servidor">{sectors.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field label="E-mail institucional" htmlFor="sv-email" error={err.email} hint={form.hasAccess && !isAdmin && !ro ? 'Somente o Administrativo altera o e-mail de quem tem acesso ao sistema.' : 'Necessário para conceder acesso ao sistema.'}>
        <input id="sv-email" type="email" className="input" value={form.email} onChange={set('email')} readOnly={emailLocked} />
      </Field>
      <Field label="Situação" htmlFor="sv-sit">
        <select id="sv-sit" className="select" value={form.situacao} onChange={set('situacao')} disabled={ro}><option>Ativo</option><option>Afastado</option><option>Aposentado</option><option>Desligado</option></select>
      </Field>
      {err._ && <div className="alert-box error" role="alert">{err._}</div>}
    </Modal>
  );
}

/* ---------------- Férias e licenças ---------------- */
function Ferias() {
  const toast = useToast();
  const st = useApi(() => Promise.all([api.get('/pessoal/ausencias'), api.get('/pessoal/servidores')]).then(([a, s]) => ({ ...a, servidores: s.filter((x) => ATIVO(x.situacao)) })), []);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const days = form && form.start && form.end && form.end >= form.start ? Math.round((new Date(form.end) - new Date(form.start)) / 864e5) + 1 : 0;

  const submit = async () => {
    if (!form.start || !form.end) { setErr('Informe as datas de início e término.'); return; }
    if (form.end < form.start) { setErr('A data de término deve ser posterior ao início.'); return; }
    if (form.type === 'Férias' && days > 30) { setErr('Férias não podem exceder 30 dias por período.'); return; }
    setBusy(true);
    try { await api.post('/pessoal/ausencias', { ...form, userId: +form.userId }); toast('Solicitação de ' + form.type.toLowerCase() + ' enviada'); setForm(null); st.refresh(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const decide = async (v, status) => {
    try { await api.patch(`/pessoal/ausencias/${v.id}/status`, { status }); toast('Solicitação ' + status.toLowerCase()); st.refresh(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="fade-up stack" style={{ gap: 16 }}>
      <div><button type="button" className="btn btn-primary" disabled={!st.data} onClick={() => { setErr(''); setForm({ userId: st.data.servidores[0] ? st.data.servidores[0].id : '', type: 'Férias', start: '', end: '', notes: '' }); }}>+ Solicitar Férias/Licença</button></div>
      <Async state={st} skeleton={<SkeletonRows />} empty={{ when: (d) => !d.items.length, icon: '🌴', title: 'Nenhuma solicitação registrada' }}>
        {(d) => (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 760 }}>
              <thead><tr><th>Servidor</th><th>Tipo</th><th>Data Início</th><th>Data Fim</th><th>Dias</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {d.items.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.employee}</td>
                    <td className="muted">{v.type}</td>
                    <td className="muted">{fmtDate(v.start)}</td>
                    <td className="muted">{fmtDate(v.end)}</td>
                    <td className="muted">{v.days}</td>
                    <td><Badge bg={VAC_STYLE[v.status][0]} color={VAC_STYLE[v.status][1]}>{v.status}</Badge>{v.decidedBy && <p style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 3 }}>por {v.decidedBy}</p>}</td>
                    <td>
                      {v.status === 'Pendente' && (
                        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => decide(v, 'Aprovado')}>✓ Aprovar</button>
                          <button type="button" className="btn btn-danger btn-sm" aria-label={'Recusar solicitação de ' + v.employee} onClick={() => decide(v, 'Recusado')}>✕</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>
      {form && st.data && (
        <Modal title="Solicitar Férias/Licença" sub="A solicitação entra como Pendente para aprovação da chefia" onClose={() => setForm(null)} footer={<>
          <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? 'Enviando…' : 'Enviar solicitação'}</button>
        </>}>
          <Field label="Servidor" htmlFor="v-emp"><select id="v-emp" className="select" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>{st.data.servidores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Tipo" htmlFor="v-tipo"><select id="v-tipo" className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{st.data.tipos.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <div className="grid" style={{ '--min': '180px', gap: 12 }}>
            <Field label="Data de início" htmlFor="v-ini"><input id="v-ini" type="date" className="input" value={form.start} onChange={(e) => { setForm({ ...form, start: e.target.value }); setErr(''); }} /></Field>
            <Field label="Data de término" htmlFor="v-fim"><input id="v-fim" type="date" className="input" value={form.end} onChange={(e) => { setForm({ ...form, end: e.target.value }); setErr(''); }} /></Field>
          </div>
          {days > 0 && <p style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 600 }}>Período: {days} dia(s)</p>}
          {form.type === 'Férias' && <p className="hint">Férias exigem ao menos {st.data.antecedencia} dias de antecedência.</p>}
          <Field label="Observações" htmlFor="v-obs"><textarea id="v-obs" className="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Informações complementares (opcional)" /></Field>
          {err && <p role="alert" style={{ fontSize: 12.5, color: 'var(--crit-strong)', fontWeight: 600 }}>{err}</p>}
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Indicadores ---------------- */
function Indicadores() {
  const st = useApi(() => api.get('/pessoal/indicadores'), []);
  return (
    <Async state={st} skeleton={<SkeletonCards n={4} />}>
      {(d) => (
        <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 16 }}>
          {d.kpis.map((k) => (
            <div key={k.label} className="card" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>{k.label}</p>
              <p style={{ fontSize: 28, fontWeight: 700 }}>{k.value}</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>{k.detail}</p>
              <p style={{ marginTop: 8, color: k.up ? 'var(--accent)' : (k.trend.startsWith('→') ? 'var(--text-2)' : 'var(--crit-strong)'), fontSize: 12, fontWeight: 600 }}>{k.trend}</p>
            </div>
          ))}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Força de Trabalho por Setor</h3>
            <div className="stack" style={{ gap: 10 }}>
              {d.sectorHeadcount.map((s) => (
                <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="row between" style={{ fontSize: 12.5 }}><span style={{ fontWeight: 600 }}>{s.label}</span><span style={{ fontWeight: 700, color: 'var(--accent)' }}>{s.value}</span></div>
                  <div className="progress" style={{ height: 8 }}><div style={{ width: s.bar }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Async>
  );
}

/* ---------------- Usuários & Permissões (RBAC) ---------------- */
const ROLE_HINT = { Administrativo: 'Vê tudo', Compras: 'Compras & Licitações, Moções', Almoxarifado: 'Almoxarifado, Moções', 'Patrimônio': 'Patrimônio', Gerenciamento: 'Protocolo', Visualizador: 'Analytics e Perfil' };
const CARGO_STYLE = { Diretoria: ['var(--warn-bg)', 'var(--warn)'], Chefia: ['var(--info-bg)', 'var(--info)'], 'Funcionário': ['var(--surface-3)', 'var(--text-2)'] };
const ACTION_STYLE = { 'Acesso Concedido': ['var(--accent-soft)', 'var(--accent)'], 'Usuário Criado': ['var(--info-bg)', 'var(--info)'], 'Acesso Revogado': ['var(--crit-bg)', 'var(--crit)'], 'Perfil removido': ['var(--warn-bg)', 'var(--warn)'] };
// Chaves individuais exibidas na matriz (protótipo PessoalUsuarios)
const SWITCH_MODULES = [['compras', 'Compras'], ['protocolo', 'Protocolo'], ['rh', 'Gestão de Pessoal'], ['almoxarifado', 'Almoxarifado'], ['mocoes', 'Moções & Galeria']];

function Usuarios() {
  const { isAdmin, user: me } = useAuth();
  const toast = useToast();
  const st = useApi(() => api.get('/users'), []);
  const hist = useApi(() => api.get('/users/history'), []);
  const [q, setQ] = useState('');
  const [rf, setRf] = useState('todos');
  const [novo, setNovo] = useState(null);
  const sectors = useCostCenters('padrao');

  const users = st.data ? st.data.users.filter((u) => ATIVO(u.situacao)) : [];
  const term = q.trim().toLowerCase();
  const filtered = users.filter((u) => (!term || u.name.toLowerCase().includes(term) || (u.department || '').toLowerCase().includes(term))
    && (rf === 'todos' || (rf === 'admin' ? u.roles.includes('Administrativo') : !u.roles.includes('Administrativo'))));

  const update = (u) => { st.setData((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? u : x)) })); hist.refresh(); toast('Salvo com sucesso'); };
  const toggleRole = async (u, r) => {
    let roles = u.roles.includes(r) ? u.roles.filter((x) => x !== r) : u.roles.concat(r);
    if (!roles.length) { toast('O servidor precisa de ao menos um perfil.', 'error'); return; }
    try { update(await api.put(`/users/${u.id}/roles`, { roles })); } catch (e) { toast(e.message, 'error'); }
  };
  const toggleAccess = async (u, mod, on) => {
    try { update(await api.put(`/users/${u.id}/access/${mod}`, { allowed: !on })); } catch (e) { toast(e.message, 'error'); }
  };
  const resend = async (u) => { try { await api.post(`/users/${u.id}/invite`); toast('Convite reenviado para ' + u.email); } catch (e) { toast(e.message, 'error'); } };

  const roleCount = useMemo(() => { const c = {}; users.forEach((u) => u.roles.forEach((r) => { c[r] = (c[r] || 0) + 1; })); return c; }, [users]);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="card lg fade-up" style={{ padding: 24 }}>
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Matriz de Controle de Acesso (RBAC)</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>Configurações e privilégios de acesso aos módulos no servidor{!isAdmin && ' — somente o Administrativo altera perfis e permissões'}</p>
          </div>
          {isAdmin && (
            <div className="row">
              <Link to="/configuracoes?tab=centros" className="btn btn-outline">🏢 Setores</Link>
              <button type="button" className="btn btn-primary" onClick={() => setNovo({ name: '', email: '', department: sectors[0] || '', hierarchy: 'Funcionário', roles: ['Visualizador'] })}>👤⁺ Novo Servidor</button>
            </div>
          )}
        </div>
        <div className="row" style={{ marginBottom: 20 }}>
          <div className="search" style={{ flex: 1, minWidth: 200, maxWidth: 'none' }}>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou setor..." aria-label="Buscar servidor" />
            <span className="ico" aria-hidden="true">🔍</span>
          </div>
          <div className="segmented" role="group" aria-label="Filtrar por perfil">
            {[['todos', 'Todos'], ['admin', 'Administrativo'], ['user', 'Usuário']].map(([k, l]) => <button key={k} type="button" aria-pressed={rf === k} onClick={() => setRf(k)}>{l}</button>)}
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>{term || rf !== 'todos' ? `${filtered.length} de ${users.length} servidores` : `${users.length} servidores cadastrados`}</p>
        <Async state={st} skeleton={<SkeletonRows n={4} />}>
          {() => !filtered.length ? <Empty title="Nenhum servidor encontrado">Ajuste a busca ou o filtro de perfil.</Empty> : (
            <div className="stack" style={{ gap: 18 }}>
              {filtered.map((u) => {
                const admin = u.roles.includes('Administrativo');
                const cs = CARGO_STYLE[u.hierarchy] || CARGO_STYLE['Funcionário'];
                return (
                  <div key={u.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
                    <div className="row between" style={{ gap: 16 }}>
                      <div className="row" style={{ gap: 14, minWidth: 0 }}>
                        <div className="avatar" style={{ width: 42, height: 42, fontSize: 14, background: admin ? '#1C543A' : 'var(--surface-3)', color: admin ? '#fff' : 'var(--text-2)' }}>{initials(u.name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 15, fontWeight: 700 }}>{u.name}</p>
                          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>Setor: {u.department || '—'}{u.email ? ' · ' + u.email : ''}</p>
                        </div>
                        <Badge bg={cs[0]} color={cs[1]}>{u.hierarchy}</Badge>
                        {!u.roles.length && <Badge bg="var(--surface-3)" color="var(--text-2)">Sem acesso ao sistema</Badge>}
                        {u.convite_pendente && <Badge level="warning">Convite pendente</Badge>}
                      </div>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end', maxWidth: 440 }}>
                        {st.data.roles.map((r) => {
                          const on = u.roles.includes(r);
                          return <button key={r} type="button" className={'chip' + (r === 'Administrativo' ? ' admin' : '')} aria-pressed={on} disabled={!isAdmin} title={(on ? 'Remover perfil · ' : 'Adicionar perfil · ') + ROLE_HINT[r]} onClick={() => toggleRole(u, r)} style={{ minHeight: 30, fontSize: 10.5, letterSpacing: 0.3, textTransform: 'uppercase' }}>{on ? '✓' : '+'} {r}</button>;
                        })}
                        {isAdmin && u.convite_pendente && <button type="button" className="btn btn-ghost btn-sm" onClick={() => resend(u)}>Reenviar convite</button>}
                      </div>
                    </div>
                    <div style={{ height: 1, background: 'var(--divider)', margin: '18px 0' }} />
                    <div className="grid" style={{ '--min': '180px', gap: 12 }}>
                      {SWITCH_MODULES.map(([k, label]) => {
                        const on = u.modules.includes(k), ov = Object.prototype.hasOwnProperty.call(u.overrides || {}, k);
                        return (
                          <div key={k} className="row between" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', flexWrap: 'nowrap' }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, minWidth: 0 }}>{label}{ov && <span title="Permissão individual (prevalece sobre o perfil)" style={{ color: 'var(--accent)', marginLeft: 4 }}>•</span>}</span>
                            <Switch on={on} label={u.name + ' — ' + label} disabled={!isAdmin || admin || !u.roles.length} title={admin ? 'Administrativo tem acesso a todos os módulos' : undefined} onChange={() => toggleAccess(u, k, on)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Async>
      </section>

      <section className="card lg fade-up" style={{ padding: 24, animationDelay: '0.2s' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Auditoria de Alterações</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 18 }}>Histórico de modificações de permissões e configurações de acesso</p>
        <Async state={hist} skeleton={<SkeletonRows n={4} />} empty={{ when: (d) => !d.length, icon: '🛡', title: 'Nenhuma alteração registrada' }}>
          {(rows) => (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table className="table">
                <thead><tr><th>Administrador</th><th>Data &amp; Hora</th><th>Ação</th><th>Usuário Afetado</th><th>Detalhe</th></tr></thead>
                <tbody>
                  {rows.map((l) => {
                    const s = ACTION_STYLE[l.action] || ['var(--warn-bg)', 'var(--warn)'];
                    return (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600 }}>{l.admin}</td>
                        <td className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtDateTime(l.ts)}</td>
                        <td><span style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11.5, fontWeight: 600, background: s[0], color: s[1], whiteSpace: 'nowrap' }}>{l.action}</span></td>
                        <td>{l.target_user || '—'}</td>
                        <td className="muted">{l.detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Async>
      </section>

      <section style={{ paddingTop: 20, borderTop: '1px solid var(--primary)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Perfis de acesso (por papel)</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '4px 0 16px' }}>Permissões padrão de cada papel. As chaves acima ajustam o acesso de cada servidor individualmente.</p>
        <div className="grid" style={{ '--min': '200px' }}>
          {(st.data ? st.data.roles : []).map((r) => (
            <div key={r} className="card" style={{ padding: 16 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600 }}>{r}</h4>
                <Badge bg="var(--accent-soft)" color="var(--accent)">{roleCount[r] || 0} usuários</Badge>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>{ROLE_HINT[r]}</p>
              {isAdmin && <Link to="/configuracoes?tab=acessos" className="btn btn-secondary btn-sm" style={{ width: '100%' }}>Gerenciar Permissões</Link>}
            </div>
          ))}
        </div>
      </section>

      {novo && <NovoServidorModal form={novo} setForm={setNovo} sectors={sectors} roles={st.data ? st.data.roles : []} me={me} onDone={() => { setNovo(null); st.refresh(); hist.refresh(); toast('Salvo com sucesso'); }} />}
    </div>
  );
}

function NovoServidorModal({ form, setForm, sectors, roles, onDone }) {
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const ok = form.name.trim() && form.email.trim() && form.department.trim();
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setErr({}); };
  const toggle = (r) => {
    const on = form.roles.includes(r);
    if (on && form.roles.length === 1) return;
    setForm({ ...form, roles: on ? form.roles.filter((x) => x !== r) : form.roles.concat(r) });
  };
  const submit = async () => {
    setBusy(true);
    try { await api.post('/users', form); onDone(); } catch (e) { setErr({ ...e.fields, _: e.message }); } finally { setBusy(false); }
  };
  return (
    <Modal title="Cadastrar Novo Servidor" sub="Pré-cadastro administrativo de acesso" onClose={() => setForm(null)} footer={<>
      <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={!ok || busy} onClick={submit}>{busy ? 'Cadastrando…' : 'Cadastrar Servidor'}</button>
    </>}>
      <Field label="Nome Completo" htmlFor="ns-nome" error={err.name}><input id="ns-nome" className="input" value={form.name} onChange={set('name')} placeholder="Ex: Fernanda Souza Lima" /></Field>
      <Field label="E-mail Institucional" htmlFor="ns-email" error={err.email}><input id="ns-email" type="email" className="input" value={form.email} onChange={set('email')} placeholder="nome@camara.local" /></Field>
      <Field label="Setor / Lotação" htmlFor="ns-setor" error={err.department}>
        <input id="ns-setor" className="input" list="dl-cc-novo" autoComplete="off" placeholder="Digite ou selecione o centro de custo" value={form.department} onChange={set('department')} />
        <datalist id="dl-cc-novo">{sectors.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field label="Cargo (Hierarquia no setor)" htmlFor="ns-cargo">
        <select id="ns-cargo" className="select" value={form.hierarchy} onChange={set('hierarchy')}><option value="Diretoria">Diretoria (topo da hierarquia)</option><option value="Chefia">Chefia</option><option value="Funcionário">Funcionário</option></select>
      </Field>
      <div className="field">
        <span className="label">Perfis de acesso</span>
        <div role="group" aria-label="Perfis de acesso" className="row" style={{ gap: 6 }}>
          {roles.map((r) => { const on = form.roles.includes(r); return <button key={r} type="button" className={'chip' + (r === 'Administrativo' ? ' admin' : '')} aria-pressed={on} title={ROLE_HINT[r]} onClick={() => toggle(r)}>{on ? '✓' : '+'} {r}</button>; })}
        </div>
        <p className="hint">Marque um ou mais perfis. O acesso final é a soma dos módulos de cada perfil.</p>
        <p className="hint" style={{ color: 'var(--text-3)' }}>O servidor recebe por e-mail um link para definir a própria senha. Administradores recebem acesso a todos os módulos; os privilégios podem ser ajustados na matriz após o cadastro.</p>
      </div>
      {err._ && <div className="alert-box error" role="alert">{err._}</div>}
    </Modal>
  );
}
