import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout.jsx';
import { Async, SkeletonCards, useToast } from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useApi } from '../lib/hooks.js';

const KPI_COLOR = { ok: 'var(--accent)', warning: 'var(--warn)', critical: 'var(--crit-strong)', neutral: 'var(--text)' };
const PERIODOS = [['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias'], ['365', 'Últimos 365 dias'], ['ano', 'Este ano'], ['custom', 'Customizar']];

/** Analytics & Relatórios: visão consolidada calculada a partir dos dados dos módulos. */
export default function AnalyticsModule() {
  const toast = useToast();
  const { can } = useAuth();
  const [periodo, setPeriodo] = useState('');
  const [faixa, setFaixa] = useState({ de: '', ate: '' });
  const custom = periodo === 'custom';
  const pronto = !custom || (faixa.de && faixa.ate && faixa.de <= faixa.ate);
  const params = custom ? { periodo, de: faixa.de, ate: faixa.ate } : { periodo };
  // Só consulta com um período completo; enquanto o usuário escolhe as datas, mantém o último resultado
  const [efetivo, setEfetivo] = useState('');
  const chave = pronto ? qs(params) : efetivo;
  useEffect(() => { if (pronto) setEfetivo(qs(params)); }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useApi(() => api.get('/analytics' + chave), [chave]);
  const exportar = async () => {
    try { await api.download('/analytics/export.csv' + qs(custom ? params : { periodo: periodo || (st.data && st.data.periodo) })); toast('Relatório exportado'); } catch (e) { toast(e.message, 'error'); }
  };
  const Go = ({ href, mod, children, ...p }) => (can(mod) ? <Link to={href} {...p}>{children}</Link> : <div {...p}>{children}</div>);
  return (
    <>
      <PageHeader section="Analytics & Relatórios" title="Analytics & Relatórios">
        <select className="select" style={{ width: 'auto' }} aria-label="Período" value={periodo || (st.data ? st.data.periodo : '30')} onChange={(e) => setPeriodo(e.target.value)}>
          {PERIODOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {custom && (
          <>
            <input type="date" className="input" style={{ width: 'auto' }} aria-label="Data inicial" value={faixa.de} max={faixa.ate || undefined} onChange={(e) => setFaixa({ ...faixa, de: e.target.value })} />
            <input type="date" className="input" style={{ width: 'auto' }} aria-label="Data final" value={faixa.ate} min={faixa.de || undefined} onChange={(e) => setFaixa({ ...faixa, ate: e.target.value })} />
          </>
        )}
        <button type="button" className="btn btn-primary" disabled={!pronto} onClick={exportar}>📊 Exportar</button>
      </PageHeader>
      <main className="page">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Visão consolidada</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 2, maxWidth: 720 }}>Indicadores calculados a partir dos dados lançados nos módulos. Para detalhes e ações, use o link de cada bloco.</p>
        </div>
        <Async state={st} skeleton={<SkeletonCards n={6} h={120} />}>
          {(d) => (
            <>
              <div className="grid" style={{ '--min': '190px', gap: 12 }}>
                {d.kpis.map((k) => (
                  <Go key={k.label} href={k.href} mod={k.module} className="card" style={{ display: 'block', padding: 14, textDecoration: 'none', color: 'inherit' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{k.label}</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: KPI_COLOR[k.level], marginTop: 4 }}>{k.value}</p>
                    <p className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{k.sub}</p>
                  </Go>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, alignItems: 'start' }}>
                {d.blocks.map((b) => (
                  <section key={b.title} className="card stack" style={{ padding: 18, gap: 12 }}>
                    <div className="row between" style={{ paddingBottom: 10, borderBottom: '1px solid var(--primary)', flexWrap: 'nowrap' }}>
                      <h3 style={{ fontSize: 14.5, fontWeight: 700 }}>{b.title}</h3>
                      {can(b.module) && <Link to={b.href} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>{b.linkLabel} →</Link>}
                    </div>
                    {b.rows.map((r) => (
                      <div key={r.label} className="stack" style={{ gap: 4 }}>
                        <div className="row between" style={{ fontSize: 12.5, flexWrap: 'nowrap' }}><span style={{ fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{r.label}</span><span style={{ color: r.color, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.value}</span></div>
                        <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-3)' }}><div style={{ height: 6, borderRadius: 999, background: r.color, width: r.pct + '%' }} /></div>
                      </div>
                    ))}
                    {b.note && <p style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{b.note}</p>}
                    {b.empty && <p className="muted" style={{ fontSize: 12.5 }}>Sem dados lançados.</p>}
                  </section>
                ))}
              </div>
            </>
          )}
        </Async>
      </main>
    </>
  );
}
