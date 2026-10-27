import React, { useState } from 'react';
import { PageHeader } from '../components/Layout.jsx';
import { Async, Kpi, SkeletonRows, useToast } from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useApi, useDebounced } from '../lib/hooks.js';
import { fmtDateTime } from '../lib/format.js';

const LV = { info: ['Informativo', 'var(--info-bg)', 'var(--info)'], warning: ['Atenção', 'var(--warn-bg)', 'var(--warn)'], critical: ['Crítico', 'var(--crit-bg)', 'var(--crit)'] };
const COLS = '150px minmax(0, 1.2fr) minmax(0, 1.2fr) 120px minmax(0, 2fr) 100px';

/** Log e Auditoria — somente administrador. */
export default function AuditLog() {
  const toast = useToast();
  const [f, setF] = useState({ q: '', module: 'todos', level: 'todos', period: '30' });
  const [sel, setSel] = useState(null);
  const q = useDebounced(f.q);
  const st = useApi((signal) => api.get('/audit' + qs({ ...f, q }), { signal }), [q, f.module, f.level, f.period]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const shown = st.data ? st.data.rows.length : 0;

  const exportCsv = () => api.download('/audit/export.csv' + qs(f)).catch((e) => toast(e.message, 'error'));

  return (
    <>
      <PageHeader eyebrow="Administração do sistema" title="Log e Auditoria" desc="Acessos, falhas de login, acessos negados, alterações de permissão e leituras de dados pessoais (LGPD). Disponível apenas para o administrador.">
        <button type="button" className="btn btn-primary" onClick={exportCsv}>Exportar CSV ({st.data ? st.data.kpis.total : 0})</button>
      </PageHeader>
      <main className="page">
        {st.data && (
          <div className="grid" style={{ '--min': '170px', gap: 12 }}>
            <Kpi label="Registros no período" value={st.data.kpis.total} onClick={() => setF({ ...f, q: '', level: 'todos', module: 'todos' })} />
            <Kpi label="Falhas de login" value={st.data.kpis.falhas} color="var(--warn)" onClick={() => setF({ ...f, q: 'Falha de login', module: 'todos', level: 'todos' })} />
            <Kpi label="Acessos negados" value={st.data.kpis.negados} color="var(--warn)" onClick={() => setF({ ...f, q: 'Acesso negado', module: 'todos', level: 'todos' })} />
            <Kpi label="Eventos críticos" value={st.data.kpis.criticos} color="var(--crit)" onClick={() => setF({ ...f, level: 'critical', q: '', module: 'todos' })} />
          </div>
        )}
        <div className="card row" style={{ padding: 14 }}>
          <input type="search" className="input" style={{ flex: 1, minWidth: 200, width: 'auto' }} value={f.q} onChange={set('q')} placeholder="Buscar usuário, ação ou detalhe" aria-label="Buscar no log" />
          <select className="select" style={{ width: 'auto' }} value={f.module} onChange={set('module')} aria-label="Filtrar por módulo">
            <option value="todos">Todos os módulos</option>
            {(st.data ? st.data.modules : []).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select className="select" style={{ width: 'auto' }} value={f.level} onChange={set('level')} aria-label="Filtrar por gravidade">
            <option value="todos">Todas as gravidades</option><option value="info">Informativo</option><option value="warning">Atenção</option><option value="critical">Crítico</option>
          </select>
          <select className="select" style={{ width: 'auto' }} value={f.period} onChange={set('period')} aria-label="Período">
            <option value="1">Últimas 24 h</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="todos">Todo o período</option>
          </select>
          <span className="muted" style={{ fontSize: 12 }}>{shown} registro(s){st.data && st.data.kpis.total > shown ? ` (exibindo os ${shown} mais recentes)` : ''}</span>
        </div>
        <Async state={st} skeleton={<SkeletonRows n={8} />}>
          {(d) => (
            <div className="table-wrap">
              <div style={{ minWidth: 820 }}>
                <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '10px 16px', background: 'var(--surface-2)', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  <span>Data e hora</span><span>Usuário</span><span>Ação</span><span>Módulo</span><span>Detalhe</span><span>Gravidade</span>
                </div>
                {d.rows.map((a) => {
                  const l = LV[a.level] || LV.info;
                  return (
                    <React.Fragment key={a.id}>
                      <button type="button" onClick={() => setSel(sel === a.id ? null : a.id)} aria-expanded={sel === a.id}
                        style={{ width: '100%', textAlign: 'left', border: 'none', borderTop: '1px solid var(--divider)', background: sel === a.id ? 'var(--accent-soft)' : 'var(--surface)', padding: '12px 16px', display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center', fontSize: 12.5 }}>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtDateTime(a.ts)}</span>
                        <span><span style={{ display: 'block', fontWeight: 600 }}>{a.user}</span><span style={{ fontSize: 11, color: 'var(--text-2)' }}>{a.role}</span></span>
                        <span style={{ fontWeight: 600 }}>{a.action}</span>
                        <span style={{ color: 'var(--text-2)' }}>{a.moduleLabel}</span>
                        <span style={{ color: 'var(--text-2)', wordBreak: 'break-word' }}>{a.detail}</span>
                        <span className="badge" style={{ background: l[1], color: l[2] }}>{l[0]}</span>
                      </button>
                      {sel === a.id && (
                        <div style={{ borderTop: '1px solid var(--primary)', padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, background: 'var(--surface)' }}>
                          {[['Registro', a.id], ['Data e hora', fmtDateTime(a.ts)], ['Usuário', a.user], ['Perfil', a.role], ['Ação', a.action], ['Módulo', a.moduleLabel], ['Detalhe', a.detail || '—'], ['Dispositivo', a.device || '—'], ['Endereço IP', a.ip || '—']].map(([k, v]) => (
                            <div key={k}><p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{k}</p><p style={{ fontSize: 13, marginTop: 4, wordBreak: 'break-word' }}>{v}</p></div>
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
                {!d.rows.length && <p style={{ padding: 30, textAlign: 'center', color: 'var(--text-2)' }}>Nenhum registro com esses filtros.</p>}
              </div>
            </div>
          )}
        </Async>
      </main>
    </>
  );
}
