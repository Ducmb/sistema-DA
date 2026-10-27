import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { colors } from '../theme.js';
import L from '../lib/liccont.js';
import { ANOS, getExercicio, setExercicio } from '../lib/exercicio.js';
import { useLocation } from 'react-router-dom';

function useLic() { const [, set] = useState(0); useEffect(() => { const f = () => set(n => n + 1); ['licchange', 'exerciciochange'].forEach(e => window.addEventListener(e, f)); return () => ['licchange', 'exerciciochange'].forEach(e => window.removeEventListener(e, f)); }, []); return L.get(); }
const card = { border: `1px solid ${colors.border}`, borderRadius: 8, padding: 16, backgroundColor: colors.white };
const COLOR = { ok: '#1C543A', na: '#B8C7BF', refazer: '#D97706', pend: '#E0E0DE' };

function Processos() {
  const db = useLic();
  const [actor, setActor] = useState(L.CHEFIA);
  const [open, setOpen] = useState(null);
  const loads = L.loads(); const sug = L.suggestAgent();
  const change = (p, i, v) => {
    if (v === 'refazer') { const j = window.prompt('Justificativa obrigatória para "Refazer":'); if (!j || !j.trim()) return; L.setStage(p.id, i, 'refazer', j.trim(), actor); }
    else L.setStage(p.id, i, v, '', actor);
  };
  const novo = () => {
    if (actor !== L.CHEFIA) { alert('A atribuição precisa ser confirmada pela chefia.'); return; }
    const interno = window.prompt('Nº do processo interno'); if (!interno) return;
    const objeto = window.prompt('Objeto'); if (!objeto) return;
    const agente = window.prompt('Agente (sugestão: menor carga)', sug); if (!agente) return;
    L.addProcess({ interno, objeto, agente, by: actor });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Atuando como{' '}
          <select value={actor} onChange={e => setActor(e.target.value)} style={{ height: 38, borderRadius: 8, border: '1px solid #E0E0E0' }}>
            <option value={L.CHEFIA}>{L.CHEFIA} (Chefia)</option>
            {L.AGENTS.map(a => <option key={a} value={a}>{a} (Agente)</option>)}
          </select>
        </label>
        <button onClick={novo} style={{ height: 38, padding: '0 14px', background: colors.green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>+ Novo processo</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {loads.map(l => <div key={l.agente} style={card}><b>{l.agente}</b>{l.agente === sug && <span style={{ marginLeft: 6, fontSize: 10, color: colors.green }}>Menor carga</span>}<p style={{ fontSize: 22, fontWeight: 800, color: colors.green, margin: '4px 0' }}>{l.ativos}</p><span style={{ fontSize: 12, color: l.atrasados ? '#B91C1C' : '#666' }}>{l.atrasados ? l.atrasados + ' atrasado(s)' : 'Sem atrasos'}</span></div>)}
      </div>
      {db.processes.map(p => { const info = L.procInfo(p); const ro = !L.canEdit(p, actor); return (
        <div key={p.id} style={{ ...card, borderColor: info.atrasado ? '#F5C2C2' : info.refazer ? '#F3D9A4' : colors.border }}>
          <button onClick={() => setOpen(open === p.id ? null : p.id)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <b style={{ color: colors.green }}>{p.interno}</b> <span style={{ fontSize: 12, color: '#666' }}>· {p.agente}{info.atrasado ? ' · atrasado ' + info.delay + ' dias úteis' : ''}</span>
            <p style={{ margin: '4px 0', fontWeight: 600 }}>{p.objeto}</p>
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 20 }}>{p.stages.map((s, i) => <div key={i} title={L.STAGES[i].label} style={{ width: 7, height: i === info.current ? 20 : 14, background: COLOR[s.s], borderRadius: 2, marginLeft: i === 6 ? 8 : 0 }} />)}</div>
            <span style={{ fontSize: 12, color: '#666' }}>{info.currentLabel} · {info.pct}%</span>
          </button>
          {open === p.id && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8, marginTop: 12 }}>
            {p.stages.map((s, i) => <label key={i} style={{ fontSize: 12, border: '1px solid #E8E8E8', borderRadius: 8, padding: 8 }}>{i + 1}. {L.STAGES[i].label}
              <select disabled={ro} value={s.s} onChange={e => change(p, i, e.target.value)} style={{ width: '100%', height: 32, marginTop: 4 }}>
                <option value="pend">Pendente</option><option value="ok">Concluída</option><option value="refazer">Refazer</option><option value="na">Não se aplica</option>
              </select>{s.just && <span style={{ color: '#92400E', fontSize: 11 }}>{s.just}</span>}</label>)}
          </div>}
        </div>); })}
    </div>
  );
}

function Contratos() {
  const db0 = useLic(); const ANO = getExercicio(); const db = { ...db0, contracts: db0.contracts.filter(c => L.inYear(c, ANO)) };
  return (
    <div style={{ ...card, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
        <thead><tr>{['Contratada', 'Contrato', 'Fim', 'Empenhado', 'Saldo', 'Aviso'].map(h => <th key={h} style={{ textAlign: 'left', padding: 8, fontSize: 11, color: '#666' }}>{h}</th>)}</tr></thead>
        <tbody>{db.contracts.map(c => { const ci = L.contractInfo(c); const lv = { critical: ['≤ 30 dias', '#B91C1C'], warning: ['≤ 60 dias', '#92400E'], info: ['≤ 120 dias', '#1E40AF'], vencido: ['Vencido', '#B91C1C'], ok: ['Vigente', '#1C543A'] }[ci.level];
          return <tr key={c.id} style={{ borderTop: '1px solid #F0F0F0' }}><td style={{ padding: 8 }}>{c.contratada}</td><td style={{ padding: 8 }}>{c.contrato}</td><td style={{ padding: 8 }}>{L.fmt(c.fim)} ({ci.dias}d)</td><td style={{ padding: 8 }}>{L.brl(c.empenhado)}</td><td style={{ padding: 8, color: ci.saldoBaixo ? '#B91C1C' : '#1C543A' }}>{L.brl(ci.saldo)} ({Math.round(ci.saldoPct * 100)}%)</td><td style={{ padding: 8, color: lv[1], fontWeight: 700 }}>{lv[0]}</td></tr>; })}</tbody>
      </table>
    </div>
  );
}

function Despesas() {
  const db0 = useLic(); const ANO = getExercicio(); const db = { ...db0, expenses: db0.expenses.filter(e => L.yr(e.dataEmpenho || e.data) === ANO) };
  return (
    <div style={{ ...card, overflowX: 'auto' }}>
      <p style={{ fontSize: 12, color: '#666' }}>Limites ({L.LEGAL.fonte}): compras {L.brl(L.LEGAL.compras)} · engenharia {L.brl(L.LEGAL.engenharia)}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 900 }}>
        <thead><tr>{['Proc.', 'Objeto', 'Classe/Grupo', 'Empenhado', 'Ficha/Sub', 'AUDESP', 'Contrato', 'Acumulado na data'].map(h => <th key={h} style={{ textAlign: 'left', padding: 8, fontSize: 11, color: '#666' }}>{h}</th>)}</tr></thead>
        <tbody>{db.expenses.map(e => { const a = L.accumulated(e); return <tr key={e.id} style={{ borderTop: '1px solid #F0F0F0' }}>
          <td style={{ padding: 8 }}>{e.processo}</td><td style={{ padding: 8 }}>{e.objeto}</td><td style={{ padding: 8 }}>{e.classe ? 'Cl. ' + e.classe : 'Gr. ' + e.grupo}</td><td style={{ padding: 8 }}>{L.brl(e.empenhado)}</td><td style={{ padding: 8 }}>{e.ficha}/{e.sub}</td>
          <td style={{ padding: 8 }}><select value={e.audesp ? 'Enviado' : ''} onChange={ev => L.saveExpense({ ...e, audesp: ev.target.value })}><option value="">Pendente</option><option value="Enviado">Enviado</option></select></td>
          <td style={{ padding: 8 }}><select value={e.contrato} onChange={ev => L.saveExpense({ ...e, contrato: ev.target.value })}><option value="">—</option>{db.contracts.map(c => <option key={c.id} value={c.contrato}>{c.contrato}</option>)}</select></td>
          <td style={{ padding: 8, color: a && a.pct >= 0.8 ? '#B45309' : '#1C543A' }}>{a ? L.brl(a.total) + ' (' + Math.round(a.pct * 100) + '%)' : '—'}</td></tr>; })}</tbody>
      </table>
    </div>
  );
}

function Arranjos() {
  const db = useLic();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
      {db.homenagens.map(h => <div key={h.id} style={card}><b>{h.homenageado}</b><p style={{ fontSize: 12, color: '#444', margin: '4px 0' }}>{h.honraria} · Ver. {h.vereador}</p><p style={{ fontSize: 12, color: '#666' }}>{h.data ? L.fmt(h.data) + ' às ' + h.horario : 'A agendar'} · {h.material}</p><p style={{ fontSize: 11.5, color: '#92400E' }}>{h.status}</p></div>)}
    </div>
  );
}

function Dotacao() {
  const db = useLic(); const ANO = getExercicio();
  const rows = (db.dotacoes || []).filter(d => (d.ano || L.DATA_YEAR) === ANO).map(d => ({ d, i: L.dotacaoInfo(d) })).sort((a, b) => b.i.pct - a.i.pct);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(({ d, i }) => { const c = i.pct > 1 ? '#B91C1C' : i.pct >= 0.8 ? '#B45309' : '#1C543A'; return (
        <div key={d.id} style={{ ...card, borderColor: i.pct >= 0.8 ? '#F3D9A4' : colors.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><b style={{ color: colors.green }}>Ficha {d.ficha} \u00b7 Sub {d.sub}</b><b style={{ color: c }}>Saldo {L.brl(i.saldo)}</b></div>
          <p style={{ fontSize: 13, margin: '4px 0' }}>{d.descricao}</p>
          <div style={{ height: 8, borderRadius: 999, background: '#EDEDEB' }}><div style={{ height: 8, borderRadius: 999, background: c, width: Math.min(100, Math.round(i.pct * 100)) + '%' }} /></div>
          <p style={{ fontSize: 11.5, color: '#666', margin: '4px 0 0' }}>{L.brl(i.empenhado)} empenhado de {L.brl(d.orcado)} \u00b7 {i.itens.length} despesa(s)</p>
        </div>); })}
      {!rows.length && <p style={{ ...card, textAlign: 'center', color: '#666' }}>Nenhuma dota\u00e7\u00e3o cadastrada para {ANO}.</p>}
    </div>
  );
}

const TABS = [['processos', 'Controle de Processos', Processos], ['contratos', 'Contratos', Contratos], ['despesas', 'Despesas & Limites', Despesas], ['dotacao', 'Dota\u00e7\u00e3o Or\u00e7ament\u00e1ria', Dotacao], ['arranjos', 'Arranjos e Placas', Arranjos]];
export default function ComprasControle() {
  const loc = useLocation(); const q = new URLSearchParams(loc.search).get('tab');
  const [tab, setTab] = useState(TABS.some(x => x[0] === q) ? q : 'processos');
  const [ano, setAno] = useState(getExercicio());
  const Cur = TABS.find(t => t[0] === tab)[2];
  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Controle Geral LICCONT</h1>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Exerc\u00edcio fiscal
          <select value={ano} onChange={e => { setExercicio(e.target.value); setAno(+e.target.value); }} style={{ height: 44, padding: '0 12px', border: `1px solid ${colors.green}`, borderRadius: 8, fontSize: 14, fontWeight: 700, color: colors.green, background: '#fff' }}>{ANOS.map(a => <option key={a} value={a}>{a}</option>)}</select>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 6, borderBottom: `2px solid ${colors.border}`, overflowX: 'auto' }}>
        {TABS.map(([k, label]) => <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', color: tab === k ? colors.green : '#999', borderBottom: tab === k ? `2px solid ${colors.green}` : '2px solid transparent', marginBottom: -2 }}>{label}</button>)}
      </div>
      <Cur />
    </Layout>
  );
}
