import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { colors } from '../theme.js';
import L from '../lib/liccont.js';
import { getSectors } from '../lib/sectors.js';

function Bars({ rows, fmt }) {
  const mx = Math.max(1, ...rows.map(r => r[1]));
  return rows.map(([label, v, c]) => (
    <div key={label} style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}><span style={{ fontWeight: 600 }}>{label}</span><b style={{ color: c || colors.green }}>{fmt ? fmt(v) : v}</b></div>
      <div style={{ height: 6, borderRadius: 999, background: '#EDEDEB', marginTop: 4 }}><div style={{ height: 6, borderRadius: 999, background: c || colors.green, width: Math.round(v / mx * 100) + '%' }} /></div>
    </div>));
}

export default function AnalyticsModule() {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump(n => n + 1); ['licchange', 'sectorschange'].forEach(e => window.addEventListener(e, f)); return () => ['licchange', 'sectorschange'].forEach(e => window.removeEventListener(e, f)); }, []);
  const db = L.get();
  const procs = db.processes.map(p => ({ p, i: L.procInfo(p) }));
  const ativos = procs.filter(x => !x.i.concluido);
  const contr = db.contracts.map(c => ({ c, ci: L.contractInfo(c) }));
  const dot = (db.dotacoes || []).map(d => ({ d, i: L.dotacaoInfo(d) }));
  const orc = dot.reduce((a, x) => a + x.d.orcado, 0), emp = dot.reduce((a, x) => a + x.i.empenhado, 0);
  const sectors = getSectors();
  const kpis = [
    ['Processos ativos', ativos.length, procs.filter(x => x.i.atrasado).length + ' com etapa atrasada', '/compras/controle'],
    ['Valor estimado em curso', L.brl(ativos.reduce((a, x) => a + (x.p.valor || 0), 0)), 'Soma dos processos ativos', '/compras/controle'],
    ['Contratos vencendo', contr.filter(x => x.ci.dias >= 0 && x.ci.dias <= 120).length, 'Nos pr\u00f3ximos 120 dias', '/compras/controle?tab=contratos'],
    ['Execu\u00e7\u00e3o da dota\u00e7\u00e3o', orc ? Math.round(emp / orc * 100) + '%' : '\u2014', L.brl(emp) + ' de ' + L.brl(orc), '/compras/controle?tab=dotacao'],
    ['Alertas ativos', L.alerts().length, 'Contratos, TCN, Refazer e atrasos', '/notificacoes']
  ];
  const blocks = [
    ['Processos ativos por setor requisitante', '/compras/controle', <Bars rows={sectors.map(s => [s, ativos.filter(x => x.p.setor === s).length])} />],
    ['Valor estimado por setor', '/compras/controle', <Bars rows={sectors.map(s => [s, ativos.filter(x => x.p.setor === s).reduce((a, x) => a + (x.p.valor || 0), 0)])} fmt={L.brl} />],
    ['Processos por modo de contrata\u00e7\u00e3o', '/compras/controle', <Bars rows={L.MODOS.map(m => [m, procs.filter(x => x.p.modo === m).length])} />],
    ['Contratos mais pr\u00f3ximos do fim', '/compras/controle?tab=contratos', <Bars rows={contr.slice().sort((a, b) => a.ci.dias - b.ci.dias).slice(0, 5).map(x => [x.c.contrato + ' \u00b7 ' + x.c.contratada.split(' ').slice(0, 2).join(' '), Math.max(0, x.ci.dias), x.ci.dias <= 30 ? '#B91C1C' : x.ci.dias <= 60 ? '#B45309' : '#1E40AF'])} fmt={v => v + ' dias'} />],
    ['Carga por agente de contrata\u00e7\u00e3o', '/compras/controle', <Bars rows={L.loads().map(l => [l.agente, l.ativos, l.atrasados ? '#B45309' : colors.green])} />],
    ['Gest\u00e3o de Pessoal', '/rh', <p style={{ fontSize: 12.5, color: '#444', margin: 0 }}>Quadro de servidores, afastamentos e f\u00e9rias por setor ficam no pr\u00f3prio m\u00f3dulo.</p>]
  ];
  const card = { border: `1px solid ${colors.border}`, borderRadius: 8, padding: 16, background: '#fff' };
  return (
    <Layout>
      <div><h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Analytics &amp; Relat\u00f3rios</h1><p style={{ fontSize: 13, color: '#666', margin: '4px 0 0' }}>Vis\u00e3o consolidada calculada com os dados dos m\u00f3dulos. Use os links para detalhes e a\u00e7\u00f5es.</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        {kpis.map(([l, v, sub, to]) => <Link key={l} to={to} style={{ ...card, textDecoration: 'none', color: 'inherit' }}><p style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', margin: 0 }}>{l}</p><p style={{ fontSize: 22, fontWeight: 800, color: colors.green, margin: '4px 0' }}>{v}</p><p style={{ fontSize: 11.5, color: '#666', margin: 0 }}>{sub}</p></Link>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        {blocks.map(([t, to, body]) => <div key={t} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingBottom: 10, marginBottom: 12, borderBottom: `1px solid ${colors.green}` }}><b style={{ fontSize: 14.5 }}>{t}</b><Link to={to} style={{ fontSize: 12.5, fontWeight: 700, color: colors.green, textDecoration: 'none', whiteSpace: 'nowrap' }}>Abrir \u2192</Link></div>
          {body}
        </div>)}
      </div>
    </Layout>
  );
}
