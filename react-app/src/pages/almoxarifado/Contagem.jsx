import React, { useEffect, useMemo, useState } from 'react';
import { Async, Badge, SkeletonCards, SkeletonRows, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useApi, useIsMobile } from '../../lib/hooks.js';
import { fmtDateTime, num } from '../../lib/format.js';

const PR_STYLE = { Alta: ['var(--crit-bg)', 'var(--crit-strong)'], 'Média': ['var(--warn-bg)', 'var(--warn)'], Baixa: ['var(--surface-3)', 'var(--text-2)'] };
const COUNT_STYLE = { ok: ['Conferido ✓', 'var(--accent-soft)', 'var(--accent)'], tolerancia: ['Dentro da tolerância', 'var(--info-bg)', 'var(--info)'], divergente: ['Divergência', 'var(--warn-bg)', 'var(--warn)'], corrigido: ['Estoque corrigido', 'var(--info-bg)', 'var(--info)'] };

/** Aba Contagem: indicadores, geração da amostra e Base Completa. */
export default function Contagem() {
  const isMobile = useIsMobile();
  const toast = useToast();
  const res = useApi(() => api.get('/almoxarifado/resumo'), []);
  const base = useApi(() => api.get('/almoxarifado/materiais'), []);
  const [g, setG] = useState({ category: 'todos', method: null, responsible: 'equipe', size: null });
  const [busy, setBusy] = useState(false);
  const r = res.data;
  const method = g.method || (r && r.defaultMethod) || 'alta';
  const max = r ? Math.max(1, r.workforce.total || 1) : 1;
  const size = Math.min(g.size == null ? max : g.size, max);
  const elig = r ? (g.category === 'todos' ? r.stats.total : (r.categories.find((c) => c.value === g.category) || { count: 0 }).count) : 0;

  const gerar = async () => {
    setBusy(true);
    try {
      const x = await api.post('/almoxarifado/escala', { category: g.category, method, responsible: g.responsible === 'equipe' ? 'equipe' : +g.responsible, size });
      toast(`Escala gerada: ${x.count} item(ns) para ${x.people.join(', ')} — veja em Base Completa`);
      base.refresh();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="stack" style={{ gap: 22 }}>
      <Async state={res} skeleton={<SkeletonCards n={3} h={100} />}>
        {() => (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
              {[
                ['Total de itens cadastrados', String(r.stats.total), 'Base do almoxarifado (por código)', 'var(--text)'],
                ['Giro do estoque geral', r.stats.giro.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x', 'Consumo médio mensal ÷ estoque atual', 'var(--accent)'],
                ['Materiais com alerta crítico', String(r.stats.criticos), `Estoque menor que ${r.stats.criticoMeses} mês(es) de consumo`, r.stats.criticos ? 'var(--crit-strong)' : 'var(--accent)']
              ].map(([l, v, s, c]) => (
                <div key={l} className="card lg fade-up" style={{ padding: 18 }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-2)', textTransform: 'uppercase' }}>{l}</p>
                  <p style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: c }}>{v}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 4 }}>{s}</p>
                </div>
              ))}
            </div>

            <section aria-labelledby="ger-title" className="card lg fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 18, animationDelay: '0.1s' }}>
              <div className="row between" style={{ alignItems: 'flex-start', gap: 16 }}>
                <div style={{ minWidth: 220 }}>
                  <h3 id="ger-title" style={{ fontSize: 16, fontWeight: 700 }}>Geração da Amostra</h3>
                  <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>Sorteio da escala semanal de contagem, dentro da capacidade da equipe.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, flex: 1, maxWidth: 640, minWidth: 260 }}>
                  {[['Servidores ativos', r.workforce.employees], ['Itens por sessão', r.workforce.perSession], ['Limite pessoal / semana', r.workforce.perPerson], ['Carga semanal do setor', r.workforce.total + ' contagens']].map(([l, v], i) => (
                    <div key={l} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{l}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: i === 3 ? 'var(--accent)' : 'var(--text)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ height: 1, background: 'var(--primary)', opacity: 0.35 }} />
              <div className="grid" style={{ '--min': '220px', gap: '16px 20px', alignItems: 'end' }}>
                <div className="field"><label htmlFor="ger-cat">Grupo de material / categoria</label>
                  <select id="ger-cat" className="select" value={g.category} onChange={(e) => setG({ ...g, category: e.target.value })}>
                    <option value="todos">Todas as categorias ({r.stats.total})</option>{r.categories.map((c) => <option key={c.value} value={c.value}>{c.value} ({c.count})</option>)}
                  </select>
                </div>
                <div className="field"><label htmlFor="ger-met">Método de amostragem</label>
                  <select id="ger-met" className="select" value={method} onChange={(e) => setG({ ...g, method: e.target.value })}>
                    <option value="alta">Foco em alta prioridade (ciclo semanal) — {r.methods.alta} itens</option>
                    <option value="media">Foco em média prioridade (ciclo quinzenal) — {r.methods.media} itens</option>
                    <option value="baixa">Foco em baixa prioridade (ciclo mensal) — {r.methods.baixa} itens</option>
                    <option value="balanceado">Aleatório balanceado — {r.methods.total} itens</option>
                  </select>
                </div>
                <div className="field"><label htmlFor="ger-resp">Responsável pela contagem</label>
                  <select id="ger-resp" className="select" value={g.responsible} onChange={(e) => setG({ ...g, responsible: e.target.value })}>
                    <option value="equipe">Distribuir entre a equipe ativa</option>{r.team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="row between" style={{ marginBottom: 6, alignItems: 'baseline' }}><label htmlFor="ger-size" style={{ fontSize: 12, fontWeight: 600 }}>Tamanho da amostra</label><span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{size} itens</span></div>
                  <input id="ger-size" type="range" min="1" max={max} value={size} onChange={(e) => setG({ ...g, size: +e.target.value })} style={{ width: '100%', height: 44, accentColor: 'var(--primary)' }} />
                  <div className="row between" style={{ fontSize: 10.5, color: 'var(--text-2)' }}><span>1</span><span>Máx. {max} (carga semanal)</span></div>
                </div>
              </div>
              <div className="row between" style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--accent-soft)', border: '1px solid #CFE3D7' }}>
                <p style={{ fontSize: 13 }}>{elig} item(ns) elegível(is) · serão sorteados {Math.min(size, elig)} para {g.responsible === 'equipe' ? 'a equipe ativa' : (r.team.find((t) => String(t.id) === String(g.responsible)) || {}).name}.</p>
                <button type="button" className="btn btn-primary" disabled={busy || !r.team.length} onClick={gerar}>Gerar escala de contagem da semana</button>
              </div>
              {!r.team.length && <p className="alert-box warning">Nenhum servidor ativo na equipe. Ajuste em Parametrização.</p>}
            </section>
          </>
        )}
      </Async>
      <BaseCompleta st={base} toast={toast} onChange={() => { base.refresh(); res.refresh(); }} />
    </div>
  );
}

function BaseCompleta({ st, toast, onChange }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState('todos');
  const [page, setPage] = useState(0);
  const [drafts, setDrafts] = useState({});
  const d = st.data;
  const assign = useMemo(() => { const m = {}; (d && d.escala ? d.escala.items : []).forEach((i) => { m[i.materialId] = i; }); return m; }, [d]);
  useEffect(() => { if (d && d.escala) setF('escala'); }, [d && d.escala && d.escala.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return <Async state={st} skeleton={<SkeletonRows n={8} />}>{() => null}</Async>;
  const PR = { Alta: 0, 'Média': 1, Baixa: 2 };
  const k = q.trim().toLowerCase();
  const all = d.items.slice().sort((a, b) => (b.verify - a.verify) || (PR[a.priority] - PR[b.priority]) || a.name.localeCompare(b.name, 'pt-BR') || a.code.localeCompare(b.code, 'pt-BR', { numeric: true }))
    .filter((p) => (!k || (p.code + ' ' + p.name + ' ' + ((assign[p.id] || {}).assignee || '')).toLowerCase().includes(k)) && (f === 'todos' || (f === 'escala' ? !!assign[p.id] : !assign[p.id])));
  const PS = d.pageSize, pages = Math.max(1, Math.ceil(all.length / PS)), pg = Math.min(page, pages - 1);
  const rows = all.slice(pg * PS, pg * PS + PS);
  const people = d.escala ? [...new Set(d.escala.items.map((i) => i.assignee))] : [];

  const validate = async (p) => {
    const n = parseFloat(String(drafts[p.id] == null ? '' : drafts[p.id]).replace(',', '.'));
    if (!isFinite(n) || n < 0) { toast('Informe a quantidade contada.', 'error'); return; }
    try {
      const r = await api.post('/almoxarifado/contagens', { materialId: p.id, contado: n });
      setDrafts((x) => { const y = { ...x }; delete y[p.id]; return y; });
      toast(r.status === 'divergente' ? `Divergência registrada (${r.diff > 0 ? '+' : ''}${num(r.diff, 3)})` : 'Contagem conferida');
      onChange();
    } catch (e) { toast(e.message, 'error'); }
  };
  const fix = async (p) => { try { await api.post(`/almoxarifado/contagens/${p.id}/corrigir`); toast('Estoque corrigido para ' + p.count.counted); onChange(); } catch (e) { toast(e.message, 'error'); } };
  const clear = async () => { try { await api.del('/almoxarifado/escala'); setF('todos'); toast('Escala encerrada'); onChange(); } catch (e) { toast(e.message, 'error'); } };

  return (
    <section className="card" style={{ padding: 20 }}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Base Completa ({d.items.length} itens)</h2>
          <p style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>Ordenada por status, prioridade, descrição e código · {PS} por página</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input type="search" className="input" style={{ minWidth: 240, width: 'auto', minHeight: 40 }} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Buscar por código, descrição ou responsável" aria-label="Buscar produto" />
          <select className="select" style={{ width: 'auto', minHeight: 40 }} value={f} onChange={(e) => { setF(e.target.value); setPage(0); }} aria-label="Filtrar base">
            <option value="todos">Todos os itens</option><option value="escala">Somente escala da semana</option><option value="fora">Fora da escala</option>
          </select>
        </div>
      </div>
      {d.escala && (
        <div className="row between" style={{ padding: '10px 14px', marginBottom: 14, borderRadius: 8, background: 'var(--accent-soft)', border: '1px solid #CFE3D7' }}>
          <p style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 600 }}>Escala da semana: {d.escala.items.length} item(ns) · responsável: {people.join(', ')} · gerada em {fmtDateTime(d.escala.generatedAt)}{d.escala.by ? ' por ' + d.escala.by : ''}</p>
          <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)' }} onClick={clear}>Limpar escala</button>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ fontSize: 12, minWidth: 980 }}>
          <thead><tr><th>Código</th><th>Descrição</th><th style={{ textAlign: 'center' }}>Estoque</th><th style={{ textAlign: 'center' }}>Consumo</th><th style={{ textAlign: 'center' }}>Prioridade</th><th style={{ textAlign: 'center' }}>Status</th><th>Escala da semana</th><th>Contagem</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const a = assign[p.id], mine = a && (a.assigneeId === d.me || d.isResponsavel), cs = p.count && COUNT_STYLE[p.count.status];
              return (
                <tr key={p.id} style={{ background: a ? 'var(--surface-2)' : undefined }}>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{p.code}</td>
                  <td>{p.name}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{num(p.stock, p.stock % 1 ? 3 : 0)}</td>
                  <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-2)' }}>{p.avgConsumption.toFixed(2)}</td>
                  <td style={{ textAlign: 'center' }}><Badge bg={PR_STYLE[p.priority][0]} color={PR_STYLE[p.priority][1]} style={{ borderRadius: 3 }}>{p.priority}</Badge></td>
                  <td style={{ textAlign: 'center' }}><Badge bg={p.verify ? 'var(--warn-bg)' : 'var(--accent-soft)'} color={p.verify ? 'var(--warn)' : 'var(--accent)'} style={{ borderRadius: 3 }}>{p.verify ? 'Sugerido' : 'OK'}</Badge></td>
                  <td>{a ? <Badge bg="var(--accent-soft)" color="var(--accent)">{a.assignee}</Badge> : <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                  <td style={{ minWidth: 200 }}>
                    {a && mine && (
                      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <input type="number" min="0" step="1" className="input" style={{ width: 80, minHeight: 34, textAlign: 'right', padding: '0 8px' }} value={drafts[p.id] == null ? '' : drafts[p.id]} placeholder="Qtd."
                          aria-label={'Quantidade contada de ' + p.name} onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') validate(p); }} />
                        <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)', minHeight: 34 }} onClick={() => validate(p)}>Validar →</button>
                      </div>
                    )}
                    {a && !mine && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Só {a.assignee}</span>}
                    {p.count && cs && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                        <Badge bg={cs[1]} color={cs[2]} style={{ borderRadius: 4 }}>{cs[0]}{p.count.status === 'divergente' || p.count.status === 'tolerancia' ? ': ' + (p.count.diff > 0 ? '+' : '') + num(p.count.diff, p.count.diff % 1 ? 3 : 0) : ''}</Badge>
                        <span style={{ fontSize: 10.5, color: 'var(--text-2)' }}>Contado {num(p.count.counted)} · sistema {num(p.count.stock)} · {p.count.by} em {fmtDateTime(p.count.at)}</span>
                        {p.count.status === 'divergente' && d.canFix && <button type="button" className="btn btn-sm" style={{ border: '1px solid #F3D9A4', color: 'var(--warn)', background: 'var(--surface)', width: 'fit-content', minHeight: 32 }} title="Ajustar o saldo do sistema para a quantidade contada" onClick={() => fix(p)}>Corrigir estoque para {num(p.count.counted)} →</button>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!all.length && <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>Nenhum produto encontrado.</p>}
      <Pages total={all.length} page={pg} pages={pages} ps={PS} onPage={setPage} label="Paginação da Base Completa" />
    </section>
  );
}

export function Pages({ total, page, pages, ps, onPage, label = 'Paginação' }) {
  const nums = [];
  for (let k = Math.max(0, page - 2); k <= Math.min(pages - 1, page + 2); k++) nums.push(k);
  return (
    <div className="row between" style={{ paddingTop: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{total ? `Mostrando ${page * ps + 1}–${Math.min(total, page * ps + ps)} de ${total}` : ''}</span>
      {pages > 1 && (
        <nav aria-label={label} className="row" style={{ gap: 6 }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Página anterior">‹ Anterior</button>
          {nums.map((k) => <button key={k} type="button" className={'btn btn-sm ' + (k === page ? 'btn-primary' : 'btn-secondary')} style={{ minWidth: 36 }} aria-current={k === page ? 'page' : undefined} onClick={() => onPage(k)}>{k + 1}</button>)}
          <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label="Próxima página">Próxima ›</button>
        </nav>
      )}
    </div>
  );
}
