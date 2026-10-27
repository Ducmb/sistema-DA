import React, { useState } from 'react';
import { Async, Badge, Kpi, SkeletonRows, useToast } from '../../components/ui.jsx';
import FormModal from '../../components/FormModal.jsx';
import { api } from '../../lib/api.js';
import { useApi, useQueryState } from '../../lib/hooks.js';
import { useExercicio } from '../../lib/cadastros.jsx';
import { brl, fmtDate } from '../../lib/format.js';

const M = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const COLS = 'minmax(0, 2fr) 90px 110px 120px 120px minmax(0, 1.4fr) 150px';
const FIELDS = [
  { key: 'contratada', label: 'Contratada' }, { key: 'contrato', label: 'Nº do contrato' }, { key: 'processo', label: 'Processo DA' },
  { key: 'assinatura', label: 'Data da assinatura', type: 'date' }, { key: 'fim', label: 'Final do contrato', type: 'date' },
  { key: 'empenhado', label: 'Valor empenhado (R$)', type: 'number' }, { key: 'aditamentos', label: 'Aditamentos', type: 'number', step: '1' }
];

/** Compras › Contratos do exercício: vigência, saldo de empenho, notas mensais e histórico. */
export default function Contratos() {
  const toast = useToast();
  const [ano] = useExercicio();
  const st = useApi(() => api.get('/compras/contratos?ano=' + ano), [ano]);
  const [sel, setSel] = useQueryState('contrato', '');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('todos');
  const [form, setForm] = useState(null);

  const d = st.data;
  const BADGE = d ? {
    critical: [`Vence em ≤ ${d.avisos.vermelho} dias`, 'critical'], warning: [`Vence em ≤ ${d.avisos.amarelo} dias`, 'warning'], info: [`Vence em ≤ ${d.avisos.azul} dias`, 'info'],
    vencido: ['Vencido', 'critical'], ok: ['Vigente', 'success']
  } : {};
  const all = d ? d.items : [];
  const pick = all.find((c) => String(c.id) === sel);
  const k = q.trim().toLowerCase();
  const list = pick ? [pick] : all.filter((c) => (!k || (c.contratada + ' ' + c.contrato + ' ' + c.processo).toLowerCase().includes(k))
    && (filter === 'todos' || (filter === 'vencer' && c.info.dias <= d.avisos.azul) || (filter === 'saldo' && c.info.saldoBaixo) || (filter === 'notas' && c.faltantes.length > 0)));

  const save = async (f) => {
    const body = { ...f, empenhado: +f.empenhado || 0, aditamentos: +f.aditamentos || 0 };
    const r = f.id ? await api.put('/compras/contratos/' + f.id, body) : await api.post('/compras/contratos', body);
    setForm(null); toast(f.id ? 'Contrato atualizado' : 'Contrato cadastrado'); setSel(String(r.id)); st.refresh();
  };
  const setNota = async (c, m, v) => {
    try { await api.put(`/compras/contratos/${c.id}/notas/${ano}/${m}`, { valor: +v || 0 }); st.refresh(); toast('Nota de ' + M[m] + ' registrada'); } catch (e) { toast(e.message, 'error'); }
  };
  const bars = (arr, color) => { const mx = Math.max(1, ...arr.map((v) => v || 0)); return arr.map((v, i) => ({ label: M[i], h: Math.max(2, Math.round(((v || 0) / mx) * 64)), color: v ? color : 'var(--border)', tip: M[i] + ': ' + (v ? brl(v) : 'sem lançamento') })); };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Contratos {ano}</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2, maxWidth: 760 }}>Notas fiscais em ciclo mensal a partir da assinatura: nota não recebida gera aviso no Painel. Avisos de fim de vigência: azul aos {d ? d.avisos.azul : 120} dias, amarelo aos {d ? d.avisos.amarelo : 60} e vermelho aos {d ? d.avisos.vermelho : 30}. Saldo de empenho abaixo de {d ? d.avisos.saldoMin : 20}% também gera aviso.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setForm({ contratada: '', contrato: '', processo: '', assinatura: '', fim: '', empenhado: '', aditamentos: '0' })}>+ Adicionar contrato</button>
      </div>
      <Async state={st} skeleton={<SkeletonRows n={8} />}>
        {() => (
          <>
            <div className="grid" style={{ '--min': '170px', gap: 12 }}>
              <Kpi label="Contratos ativos" value={d.kpis.ativos} />
              <Kpi label={`Vencem em ${d.avisos.azul} dias`} value={d.kpis.vencer} color={d.kpis.vencer ? 'var(--warn)' : undefined} />
              <Kpi label={`Saldo abaixo de ${d.avisos.saldoMin}%`} value={d.kpis.saldoBaixo} color={d.kpis.saldoBaixo ? 'var(--crit)' : undefined} />
              <Kpi label="Total empenhado" value={brl(d.kpis.empenhado)} color="var(--text)" />
            </div>
            <div className="card row" style={{ padding: 14 }}>
              <input type="search" className="input" style={{ flex: 1, minWidth: 200, width: 'auto' }} value={q} onChange={(e) => { setQ(e.target.value); setSel(''); }} placeholder="Buscar por contratada, contrato ou processo" aria-label="Buscar contrato" />
              {pick && (
                <span className="row" style={{ gap: 8, minHeight: 40, padding: '0 6px 0 12px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700 }}>
                  Exibindo apenas o contrato {pick.contrato} — {pick.contratada}
                  <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: 30, borderRadius: 999 }} onClick={() => setSel('')} aria-label="Mostrar todos os contratos">Mostrar todos ✕</button>
                </span>
              )}
              <select className="select" style={{ width: 'auto' }} value={filter} onChange={(e) => { setFilter(e.target.value); setSel(''); }} aria-label="Filtrar contratos">
                <option value="todos">Todos</option><option value="vencer">Vencem em até {d.avisos.azul} dias</option><option value="saldo">Saldo abaixo de {d.avisos.saldoMin}%</option><option value="notas">Com nota não recebida</option>
              </select>
            </div>
            <div className="table-wrap">
              <div style={{ minWidth: 880 }}>
                <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '10px 16px', background: 'var(--surface-2)', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  <span>Contratada</span><span>Contrato</span><span>Processo DA</span><span>Fim</span><span>Empenhado</span><span>Saldo de empenho</span><span>Aviso</span>
                </div>
                {list.map((c) => {
                  const b = BADGE[c.info.level], p = Math.round(c.info.saldoPct * 100), color = c.info.saldoBaixo ? 'var(--crit)' : 'var(--accent)';
                  return (
                    <button key={c.id} type="button" onClick={() => setSel(String(c.id) === sel ? '' : String(c.id))} style={{ width: '100%', textAlign: 'left', border: 'none', borderTop: '1px solid var(--divider)', background: String(c.id) === sel ? 'var(--accent-soft)' : 'var(--surface)', padding: '12px 16px', display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{c.contratada}</span>
                      <span className="mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>{c.contrato}</span>
                      <span className="muted">{c.processo || '—'}</span>
                      <span><span style={{ display: 'block' }}>{fmtDate(c.fim)}</span><span style={{ fontSize: 11, color: 'var(--text-2)' }}>{c.info.dias < 0 ? 'vencido há ' + -c.info.dias + ' dias' : 'em ' + c.info.dias + ' dias'}</span></span>
                      <span>{brl(c.empenhado)}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ fontWeight: 600, color }}>{brl(c.info.saldo)} · {p}%</span><span className="progress"><span style={{ display: 'block', height: 6, borderRadius: 999, background: color, width: Math.max(0, Math.min(100, p)) + '%' }} /></span></span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><Badge level={b[1]}>{b[0]}</Badge>{c.faltantes.length > 0 && <Badge level="warning">{c.faltantes.length} nota(s) não recebida(s)</Badge>}</span>
                    </button>
                  );
                })}
                {!list.length && <p style={{ padding: 30, textAlign: 'center', color: 'var(--text-2)' }}>Nenhum contrato com esses filtros.</p>}
              </div>
            </div>
            {pick && (
              <section className="card" style={{ borderColor: 'var(--primary)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="row between">
                  <div><h3 style={{ fontSize: 16, fontWeight: 700 }}>{pick.contratada}</h3><p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>Contrato {pick.contrato} · Processo {pick.processo || '—'} · {pick.aditamentos ? pick.aditamentos + ' aditamento(s)' : 'Sem aditamentos'}</p></div>
                  <div className="row" style={{ gap: 8 }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm({ ...pick, empenhado: String(pick.empenhado), aditamentos: String(pick.aditamentos) })}>✎ Editar contrato</button>
                    <button type="button" className="close-btn" onClick={() => setSel('')} aria-label="Fechar detalhe">✕</button>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.4, paddingBottom: 8, marginBottom: 10, borderBottom: '1px solid var(--primary)' }}>Lançamento das notas {ano} · gasto {brl(pick.info.gasto)} · assinatura {fmtDate(pick.assinatura)}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8 }}>
                    {pick.mensal.map((v, i) => {
                      const ini = `${ano}-${String(i + 1).padStart(2, '0')}-01`, fimMes = new Date(Date.UTC(ano, i + 1, 0)).toISOString().slice(0, 10);
                      const active = fimMes >= pick.assinatura && ini <= pick.fim, falta = pick.faltantes.includes(i), ok = v > 0;
                      const stl = ok ? ['Lançada', 'var(--accent)'] : falta ? ['Não recebida', 'var(--crit)'] : active ? ['A receber', 'var(--text-2)'] : ['Fora da vigência', 'var(--text-3)'];
                      return (
                        <div key={i} style={{ border: '1px solid ' + (falta ? '#F5C2C2' : 'var(--border)'), background: falta ? 'var(--crit-bg)' : ok ? 'var(--accent-soft)' : 'var(--surface)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div className="row between" style={{ gap: 4, flexWrap: 'nowrap' }}><span style={{ fontSize: 12, fontWeight: 700 }}>{M[i]}</span><span style={{ fontSize: 10, fontWeight: 700, color: stl[1] }}>{stl[0]}</span></div>
                          <input key={pick.id + '-' + i + '-' + v} type="number" min="0" step="0.01" className="input" defaultValue={ok ? v : ''} placeholder="—" aria-label={'Valor da nota de ' + M[i]} style={{ minHeight: 36, fontSize: 12.5, padding: '0 8px' }}
                            onBlur={(e) => { if ((+e.target.value || 0) !== (v || 0)) setNota(pick, i, e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
                {pick.historico && pick.historico.mensal && (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.4, paddingBottom: 8, marginBottom: 10, borderBottom: '1px solid var(--primary)' }}>Histórico {pick.historico.ano}</p>
                    <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>{pick.historico.assinatura ? `Assinatura ${fmtDate(pick.historico.assinatura)} · Vigência ${fmtDate(pick.historico.inicio)} a ${fmtDate(pick.historico.fim)} · ` : ''}gasto {brl(pick.historico.mensal.reduce((a, x) => a + (x || 0), 0))}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 6, alignItems: 'end', height: 84 }}>
                      {bars(pick.historico.mensal, '#7FA693').map((m) => (
                        <div key={m.label} title={m.tip} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                          <div style={{ width: '100%', maxWidth: 26, height: m.h, background: m.color, borderRadius: '3px 3px 0 0' }} />
                          <span style={{ fontSize: 10.5, color: 'var(--text-2)' }}>{m.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </Async>
      {form && <FormModal title={form.id ? 'Editar contrato' : 'Adicionar contrato'} fields={FIELDS} initial={form} onClose={() => setForm(null)} onSubmit={save} />}
    </div>
  );
}
