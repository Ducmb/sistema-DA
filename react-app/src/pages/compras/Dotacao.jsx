import React, { useState } from 'react';
import { Async, Badge, Kpi, SkeletonRows, useToast } from '../../components/ui.jsx';
import FormModal from '../../components/FormModal.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/hooks.js';
import { useExercicio } from '../../lib/cadastros.jsx';
import { brl, fmtDate } from '../../lib/format.js';

const FIELDS = [{ key: 'ficha', label: 'Ficha' }, { key: 'sub', label: 'Sub' }, { key: 'descricao', label: 'Descrição da dotação', full: true }, { key: 'orcado', label: 'Valor orçado (R$)', type: 'number' }];

/** Compras › Saldo de Dotação Orçamentária (Ficha/Sub × despesas empenhadas). */
export default function Dotacao() {
  const toast = useToast();
  const [ano] = useExercicio();
  const st = useApi(() => api.get('/compras/dotacoes?ano=' + ano), [ano]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(null);
  const all = st.data ? st.data.items : [];
  const k = q.trim().toLowerCase();
  const list = all.filter((d) => !k || (d.ficha + ' ' + d.sub + ' ' + d.descricao).toLowerCase().includes(k));
  const orc = all.reduce((a, x) => a + x.orcado, 0), emp = all.reduce((a, x) => a + x.info.empenhado, 0), crit = all.filter((x) => x.info.pct >= 0.8).length;

  const save = async (f) => {
    const body = { ficha: f.ficha, sub: f.sub || '—', descricao: f.descricao, orcado: +f.orcado, ano };
    if (f.id) await api.put('/compras/dotacoes/' + f.id, body); else await api.post('/compras/dotacoes', body);
    setForm(null); toast(f.id ? 'Dotação atualizada' : 'Dotação cadastrada'); st.refresh();
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Saldo de Dotação Orçamentária — {ano}</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2, maxWidth: 680 }}>Cada dotação (Ficha/Sub) soma automaticamente as despesas empenhadas cadastradas em Limites Legais. Saldo abaixo de 20% fica em atenção; negativo, bloqueado.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setForm({ ficha: '', sub: '', descricao: '', orcado: '' })}>+ Nova dotação</button>
      </div>
      <Async state={st} skeleton={<SkeletonRows n={6} />}>
        {() => (
          <>
            <div className="grid" style={{ '--min': '170px', gap: 12 }}>
              <Kpi label="Total orçado" value={brl(orc)} color="var(--text)" />
              <Kpi label="Total empenhado" value={brl(emp)} />
              <Kpi label="Saldo disponível" value={brl(orc - emp)} color={orc - emp < 0 ? 'var(--crit)' : undefined} />
              <Kpi label="Dotações em atenção" value={crit} color={crit ? 'var(--warn)' : undefined} />
            </div>
            <div className="card row" style={{ padding: 14 }}>
              <input type="search" className="input" style={{ flex: 1, minWidth: 200, width: 'auto' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ficha, sub ou descrição" aria-label="Buscar dotação" />
              <span className="muted" style={{ fontSize: 12 }}>{list.length} dotação(ões)</span>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {list.map((d) => {
                const p = d.info.pct, lv = p > 1 ? ['Saldo negativo', 'critical', 'var(--crit)'] : p >= 0.8 ? ['Atenção', 'warning', 'var(--warn)'] : ['Regular', 'success', 'var(--accent)'];
                const isOpen = open === d.id;
                return (
                  <div key={d.id} className="card" style={{ padding: 0, overflow: 'hidden', borderColor: p >= 0.8 ? '#F3D9A4' : undefined }}>
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : d.id)} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '14px 16px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center' }}>
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div className="row" style={{ gap: 8 }}><span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>Ficha {d.ficha} · Sub {d.sub}</span><Badge level={lv[1]}>{lv[0]}</Badge><span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{d.info.itens.length} item(ns) de despesa</span></div>
                        <p style={{ fontSize: 13.5, fontWeight: 600 }}>{d.descricao}</p>
                        <div className="progress" style={{ height: 8 }}><div style={{ width: Math.min(100, Math.round(p * 100)) + '%', background: lv[2] }} /></div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 11, color: 'var(--text-2)' }}>Saldo</p>
                        <p style={{ fontSize: 15, fontWeight: 800, color: lv[2] }}>{brl(d.info.saldo)}</p>
                        <p style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{brl(d.info.empenhado)} de {brl(d.orcado)}</p>
                      </div>
                    </button>
                    {isOpen && (
                      <div style={{ borderTop: '1px solid var(--divider)', padding: '12px 16px', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div className="row end"><button type="button" className="btn btn-outline btn-sm" onClick={() => setForm({ ...d, orcado: String(d.orcado) })}>✎ Editar dotação</button></div>
                        {d.info.itens.map((it) => (
                          <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr) 110px 110px', gap: 10, fontSize: 12.5, padding: '6px 0', borderBottom: '1px solid var(--divider)' }}>
                            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{it.processo}</span><span>{it.objeto}</span><span className="muted">{fmtDate(it.dataEmpenho)}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{brl(it.empenhado)}</span>
                          </div>
                        ))}
                        {!d.info.itens.length && <p className="muted" style={{ fontSize: 12 }}>Nenhuma despesa vinculada a esta dotação.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
              {!list.length && <p className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-2)' }}>Nenhuma dotação cadastrada para {ano}.</p>}
            </div>
          </>
        )}
      </Async>
      {form && <FormModal title={form.id ? 'Editar dotação' : 'Nova dotação'} fields={FIELDS} initial={form} onClose={() => setForm(null)} onSubmit={save} />}
    </div>
  );
}
