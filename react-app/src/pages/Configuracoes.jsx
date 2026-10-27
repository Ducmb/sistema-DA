import React, { useState } from 'react';
import { PageHeader } from '../components/Layout.jsx';
import { Async, Badge, SkeletonCards, Switch, useToast } from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useApi, useQueryState } from '../lib/hooks.js';
import { norm } from '../lib/nav.js';

const OPT_LABEL = { alta: 'Foco em alta prioridade', media: 'Foco em média prioridade', baixa: 'Foco em baixa prioridade', balanceado: 'Aleatório balanceado' };

/** Configurações do Sistema — parâmetros por módulo, perfis × módulos e centros de custo. */
export default function Configuracoes() {
  const toast = useToast();
  const [tab, setTab] = useQueryState('tab', 'geral');
  const [q, setQ] = useState('');
  const cfg = useApi(() => api.get('/config'), []);
  const nq = norm(q.trim());

  const tabs = cfg.data ? [{ key: 'geral', label: 'Geral', icon: '⚙' }, { key: 'acessos', label: 'Perfis e Acessos', icon: '🔐' }, { key: 'centros', label: 'Centros de Custo', icon: '🏷' }]
    .concat(cfg.data.schema.filter((t) => t.key !== 'geral').map((t) => ({ key: t.key, label: t.label, icon: t.icon }))) : [];
  const changesIn = (key) => {
    const t = cfg.data && cfg.data.schema.find((x) => x.key === key);
    return t ? t.groups.flatMap((g) => g.fields).filter((f) => cfg.data.changed.includes(f.key)).length : 0;
  };
  const isAccess = !nq && tab === 'acessos';
  const isCc = !nq && tab === 'centros';
  const curTab = tabs.find((t) => t.key === tab) || tabs[0];

  const resetTab = async () => {
    try {
      if (isAccess) { await api.post('/config/access/reset'); toast('Acessos padrão restaurados'); window.dispatchEvent(new Event('da:access-reset')); return; }
      cfg.setData(await api.post('/config/reset/' + tab));
      toast(curTab.label + ': padrão restaurado');
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <PageHeader eyebrow="Administração do sistema" title="Configurações do Sistema" desc="Parâmetros de cada módulo, agrupados por tema. As alterações são salvas na hora e ficam registradas no Log e Auditoria. Disponível apenas para o administrador.">
        <input type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar configuração…" aria-label="Buscar configuração" style={{ minWidth: 220, width: 'auto' }} />
        {!isCc && curTab && <button type="button" className="btn btn-secondary" onClick={resetTab}>{isAccess ? 'Restaurar acessos padrão' : 'Restaurar padrão de ' + curTab.label}</button>}
      </PageHeader>
      <main className="page">
        <div role="tablist" aria-label="Módulos" className="tabs">
          {tabs.map((t) => {
            const n = changesIn(t.key), act = !nq && t.key === tab;
            return <button key={t.key} type="button" role="tab" aria-selected={act} className="tab" onClick={() => { setTab(t.key); setQ(''); }}><span aria-hidden="true">{t.icon}</span>{t.label}{n > 0 && <span className="count">{n}</span>}</button>;
          })}
        </div>
        {isAccess ? <AccessMatrix toast={toast} /> : isCc ? <CostCenters toast={toast} /> : (
          <Async state={cfg} skeleton={<SkeletonCards n={3} h={220} />}>
            {(d) => <ParamGroups data={d} tab={tab} q={nq} onSaved={(nd) => { cfg.setData(nd); toast('Configuração salva'); }} toast={toast} />}
          </Async>
        )}
      </main>
    </>
  );
}

function ParamGroups({ data, tab, q, onSaved, toast }) {
  const [drafts, setDrafts] = useState({});
  const [errors, setErrors] = useState({});
  let groups = [];
  if (q) {
    data.schema.forEach((t) => t.groups.forEach((g) => {
      const fs = g.fields.filter((f) => norm(f.label + ' ' + f.hint + ' ' + g.title + ' ' + t.label).includes(q));
      if (fs.length) groups.push({ title: g.title + ' · ' + t.label, meta: fs.length + ' item(ns)', fields: fs, tabLabel: t.label });
    }));
  } else {
    const t = data.schema.find((x) => x.key === tab);
    if (t) groups = t.groups.map((g) => { const n = g.fields.filter((f) => data.changed.includes(f.key)).length; return { title: g.title, meta: n ? n + ' alterado(s)' : g.fields.length + ' item(ns)', fields: g.fields }; });
  }

  const save = async (f, value) => {
    if (JSON.stringify(data.values[f.key]) === JSON.stringify(value)) return;
    try {
      onSaved(await api.put('/config/values/' + encodeURIComponent(f.key), { value }));
      setErrors((e) => { const n = { ...e }; delete n[f.key]; return n; });
    } catch (e) { setErrors((er) => ({ ...er, [f.key]: e.message })); toast(e.message, 'error'); }
  };
  const commitNumber = (f) => {
    if (!Object.prototype.hasOwnProperty.call(drafts, f.key)) return;
    const n = parseFloat(String(drafts[f.key]).replace(',', '.'));
    if (!isFinite(n) || n < f.min || n > f.max) { setErrors((e) => ({ ...e, [f.key]: `Informe um valor entre ${f.min} e ${f.max}.` })); return; }
    setDrafts((d) => { const x = { ...d }; delete x[f.key]; return x; });
    save(f, n);
  };

  if (!groups.length) return <p style={{ padding: 30, textAlign: 'center', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 12 }}>Nenhuma configuração encontrada.</p>;
  return (
    <>
      {q && <p className="muted" style={{ fontSize: 12.5 }}>{groups.reduce((s, g) => s + g.fields.length, 0)} configuração(ões) encontrada(s) em todos os módulos</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 16, alignItems: 'start' }}>
        {groups.map((g) => (
          <section key={g.title} className="card lg" style={{ padding: 20 }}>
            <div className="section-head" style={{ alignItems: 'baseline', marginBottom: 6, paddingBottom: 10 }}>
              <h3 className="card-title">{g.title}</h3><span style={{ fontSize: 11, color: 'var(--text-2)' }}>{g.meta}</span>
            </div>
            {g.fields.map((f) => {
              const v = data.values[f.key], id = 'cfg-' + f.key.replace(/\W/g, '-'), err = errors[f.key];
              const changed = data.changed.includes(f.key);
              return (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--divider)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{f.label}{changed && <Badge color="var(--accent)" bg="var(--accent-soft)">Alterado</Badge>}</label>
                    {f.hint && <p className="hint" style={{ marginTop: 2 }}>{f.hint}</p>}
                    {q && <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>{g.tabLabel}</p>}
                    {err && <p role="alert" className="field-error" style={{ marginTop: 2 }}>{err}</p>}
                  </div>
                  {f.type === 'number' && (
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <input id={id} type="number" className={'input' + (err ? ' invalid' : '')} style={{ width: 120, textAlign: 'right' }} min={f.min} max={f.max} step={f.unit === 'R$' ? '0.01' : (String(f.def).includes('.') ? '0.5' : '1')}
                        value={Object.prototype.hasOwnProperty.call(drafts, f.key) ? drafts[f.key] : v}
                        onChange={(e) => setDrafts({ ...drafts, [f.key]: e.target.value })} onBlur={() => commitNumber(f)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setDrafts((d) => { const x = { ...d }; delete x[f.key]; return x; }); setErrors((er) => { const x = { ...er }; delete x[f.key]; return x; }); } }} />
                      <span style={{ fontSize: 12, color: 'var(--text-2)', minWidth: 60 }}>{f.unit}</span>
                    </div>
                  )}
                  {f.type === 'toggle' && <Switch on={!!v} label={f.label} onChange={(on) => save(f, on)} />}
                  {f.type === 'select' && (
                    <select id={id} className="select" style={{ width: 'auto', minWidth: 180 }} value={v} onChange={(e) => save(f, e.target.value)}>
                      {f.options.map((o) => <option key={o} value={o}>{f.key === 'analytics.periodo' ? 'Últimos ' + o + ' dias' : (OPT_LABEL[o] || o)}</option>)}
                    </select>
                  )}
                  {f.type === 'text' && <input id={id} className="input" style={{ width: 260, maxWidth: '100%' }} defaultValue={v} key={v} onBlur={(e) => save(f, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}

function AccessMatrix({ toast }) {
  const st = useApi(() => api.get('/config/access'), []);
  React.useEffect(() => { const on = () => st.reload(); window.addEventListener('da:access-reset', on); return () => window.removeEventListener('da:access-reset', on); }); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = async (role, mod, on) => {
    try {
      st.setData(await api.put('/config/access', { role, module: mod.key, on: !on }));
      toast((on ? 'Acesso removido: ' : 'Acesso concedido: ') + role + ' › ' + mod.label);
    } catch (e) { toast(e.message, 'error'); }
  };
  const reset = async () => { try { st.setData(await api.post('/config/access/reset')); toast('Acessos padrão restaurados'); } catch (e) { toast(e.message, 'error'); } };
  return (
    <section className="card lg" style={{ padding: 20 }}>
      <div className="section-head" style={{ alignItems: 'flex-end' }}>
        <div>
          <h3 className="card-title">Perfis e acessos por módulo</h3>
          <p className="card-sub">O perfil Administrativo vê tudo e não pode ser alterado. Permissões individuais definidas em Gestão de Pessoal › Usuários prevalecem sobre o perfil.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>Restaurar acessos padrão</button>
      </div>
      <Async state={st}>
        {(d) => (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 760 }}>
              <thead><tr><th>Módulo</th>{d.roles.map((r) => <th key={r} style={{ textAlign: 'center' }}>{r}</th>)}</tr></thead>
              <tbody>
                {d.modules.map((m) => (
                  <tr key={m.key}>
                    <td style={{ fontWeight: 600 }}>{m.label}</td>
                    {d.roles.map((r) => {
                      const on = d.matrix[r].includes(m.key), locked = r === 'Administrativo' || (['auditoria', 'configuracoes'].includes(m.key) && !on);
                      return (
                        <td key={r} style={{ textAlign: 'center' }}>
                          <Switch on={on} disabled={locked} label={r + ' — ' + m.label} title={r === 'Administrativo' ? 'Administrativo vê tudo' : locked ? 'Exclusivo do Administrativo' : on ? 'Remover acesso' : 'Conceder acesso'} onChange={() => toggle(r, m, on)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>
    </section>
  );
}

function CostCenters({ toast }) {
  const [filters, setFilters] = useState({ q: '', tipo: 'todos', situacao: 'ativos' });
  const [form, setForm] = useState({ codigo: '', nome: '', tipo: 'padrao' });
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');
  const st = useApi(() => api.get('/cost-centers' + qs({ situacao: 'todos' })), []);
  const all = st.data ? st.data.items : [];
  const k = norm(filters.q.trim());
  const list = all.filter((x) => (filters.tipo === 'todos' || x.tipo === filters.tipo) && (filters.situacao === 'todos' || (filters.situacao === 'ativos' ? x.ativo : !x.ativo)) && (!k || norm(x.codigo + ' ' + x.nome).includes(k)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const save = async () => {
    try {
      if (editId) await api.put('/cost-centers/' + editId, form); else await api.post('/cost-centers', form);
      toast(editId ? 'Centro de custo atualizado' : 'Centro de custo adicionado');
      setEditId(null); setForm({ codigo: '', nome: '', tipo: 'padrao' }); setErr('');
      st.refresh();
    } catch (e) { setErr(e.message); }
  };
  const toggle = async (x) => {
    try { await api.patch(`/cost-centers/${x.id}/active`, { ativo: !x.ativo }); toast(x.nome + (x.ativo ? ' arquivado' : ' desarquivado')); st.refresh(); } catch (e) { toast(e.message, 'error'); }
  };
  const setF = (key) => (e) => { setForm({ ...form, [key]: e.target.value }); setErr(''); };

  return (
    <section className="card lg stack" style={{ padding: 20, gap: 14 }}>
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h3 className="card-title">Centros de custo</h3>
          <p className="card-sub">Fonte única dos campos de setor e requisitante. <strong>Padrão</strong>: usados em Compras, Protocolo, Gestão de Pessoal e Usuários. <strong>Patrimônio</strong>: usados apenas no módulo de Patrimônio (localização dos bens e termos de responsabilidade). Centros arquivados deixam de aparecer nas buscas, mas o histórico é mantido.</p>
        </div>
      </div>
      <div className="row" style={{ alignItems: 'flex-end', padding: 12, borderRadius: 8, background: 'var(--surface-2)' }}>
        <div className="field"><label htmlFor="cc-tipo">Tipo</label><select id="cc-tipo" className="select" value={form.tipo} onChange={setF('tipo')}><option value="padrao">Padrão</option><option value="patrimonio">Patrimônio</option></select></div>
        <div className="field"><label htmlFor="cc-cod">Código</label><input id="cc-cod" className="input" style={{ width: 120 }} value={form.codigo} onChange={setF('codigo')} placeholder={st.data ? st.data.nextCode[form.tipo] : 'CC-001'} /></div>
        <div className="field" style={{ flex: 1, minWidth: 220 }}><label htmlFor="cc-nome">Nome do centro de custo</label><input id="cc-nome" className="input" value={form.nome} onChange={setF('nome')} placeholder="Ex.: Ouvidoria" onKeyDown={(e) => { if (e.key === 'Enter') save(); }} /></div>
        <button type="button" className="btn btn-primary" onClick={save}>{editId ? 'Salvar alterações' : '+ Adicionar'}</button>
        {editId && <button type="button" className="btn btn-secondary" onClick={() => { setEditId(null); setForm({ codigo: '', nome: '', tipo: 'padrao' }); setErr(''); }}>Cancelar</button>}
      </div>
      {err && <p role="alert" className="field-error" style={{ fontSize: 12.5 }}>{err}</p>}
      <div className="row">
        <input type="search" className="input" style={{ flex: 1, minWidth: 200, width: 'auto' }} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Buscar por código ou nome" aria-label="Buscar centro de custo" />
        <select className="select" style={{ width: 'auto' }} value={filters.tipo} onChange={(e) => setFilters({ ...filters, tipo: e.target.value })} aria-label="Tipo"><option value="todos">Todos os tipos</option><option value="padrao">Padrão</option><option value="patrimonio">Patrimônio</option></select>
        <select className="select" style={{ width: 'auto' }} value={filters.situacao} onChange={(e) => setFilters({ ...filters, situacao: e.target.value })} aria-label="Situação"><option value="ativos">Ativos</option><option value="arquivados">Arquivados</option><option value="todos">Todos</option></select>
        <span className="muted" style={{ fontSize: 12 }}>{list.length} de {all.length} centro(s)</span>
      </div>
      <Async state={st}>
        {() => (
          <div>
            {list.map((x) => (
              <div key={x.id} className="list-row" style={{ opacity: x.ativo ? 1 : 0.6 }}>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', minWidth: 70 }}>{x.codigo}</span>
                <span style={{ flex: 1, minWidth: 160, fontWeight: 600 }}>{x.nome}</span>
                <Badge color={x.tipo === 'patrimonio' ? 'var(--purple)' : 'var(--info)'} bg={x.tipo === 'patrimonio' ? 'var(--purple-bg)' : 'var(--info-bg)'}>{x.tipo === 'patrimonio' ? 'Patrimônio' : 'Padrão'}</Badge>
                <Badge color={x.ativo ? 'var(--accent)' : 'var(--text-2)'} bg={x.ativo ? 'var(--accent-soft)' : 'var(--surface-3)'}>{x.ativo ? 'Ativo' : 'Arquivado'}</Badge>
                <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)' }} onClick={() => { setEditId(x.id); setForm({ codigo: x.codigo, nome: x.nome, tipo: x.tipo }); setErr(''); }}>Editar</button>
                <button type="button" className="btn btn-secondary btn-sm" style={{ color: x.ativo ? 'var(--warn)' : 'var(--accent)' }} onClick={() => toggle(x)}>{x.ativo ? 'Arquivar' : 'Desarquivar'}</button>
              </div>
            ))}
            {!list.length && <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>Nenhum centro de custo encontrado.</p>}
          </div>
        )}
      </Async>
    </section>
  );
}
