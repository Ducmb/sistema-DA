import React, { useRef, useState } from 'react';
import { Async, Badge, SkeletonCards, SkeletonRows, useToast } from '../../components/ui.jsx';
import FormModal from '../../components/FormModal.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/hooks.js';
import { useExercicio } from '../../lib/cadastros.jsx';
import { brl, fmtDate, fmtDateTime, num } from '../../lib/format.js';

const pctF = (p) => (p * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
const parseBRL = (s) => Number(String(s).replace(/[^\d,]/g, '').replace(',', '.')) || 0;
const DESP_FIELDS = [
  { key: 'processo', label: 'Processo' }, { key: 'objeto', label: 'Objeto' }, { key: 'descricao', label: 'Descrição' }, { key: 'catmat', label: 'CATMAT' },
  { key: 'classe', label: 'Classe' }, { key: 'catser', label: 'CATSER' }, { key: 'grupo', label: 'Grupo' }, { key: 'modalidade', label: 'Modalidade', type: 'select', options: ['Dispensa', 'Inexigibilidade', 'Licitação', 'Pregão Eletrônico', 'Adesão a ARP'] },
  { key: 'empenhado', label: 'Valor empenhado (R$)', type: 'number' }, { key: 'dataEmpenho', label: 'Data do empenho', type: 'date' }, { key: 'ficha', label: 'Ficha' }, { key: 'sub', label: 'Sub' }
];
const COLS = '90px minmax(240px, 2fr) 150px 100px 110px 90px 80px 130px 130px 150px 160px';

/** Compras › Limites Legais: limites de dispensa, simulador, despesas/verbinha e catálogo compras.gov.br. */
export default function Limites() {
  const toast = useToast();
  const lim = useApi(() => api.get('/compras/limites'), []);
  const [sim, setSim] = useState({ itemId: '', valor: '' });
  const [res, setRes] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const timer = useRef(null);
  const simulate = (s) => {
    setSim(s); setRes(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => runSim(s), 350);
  };
  const runSim = async (s) => {
    const v = parseBRL(s.valor), id = +(s.itemId || (lim.data && lim.data.itens[0] && lim.data.itens[0].id));
    if (!(v > 0) || !id) return;
    try { setRes({ ...(await api.post('/compras/limites/simular', { itemId: id, valor: v })), valor: v, item: lim.data.itens.find((i) => i.id === id) }); } catch (e) { toast(e.message, 'error'); }
  };
  const sync = async () => {
    setSyncing(true);
    try { const st = await api.post('/compras/catalogo/sync'); lim.setData((d) => ({ ...d, catalogo: st })); toast('Catálogo CATMAT/CATSER: ' + st.status.toLowerCase()); } catch (e) { toast(e.message, 'error'); } finally { setSyncing(false); }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Async state={lim} skeleton={<SkeletonCards n={3} h={160} />}>
        {(d) => (
          <div className="grid" style={{ '--min': '240px' }}>
            {[['Art. 75, I — Lei 14.133/2021', d.legal.engenharia, 'Obras, serviços de engenharia e manutenção de veículos'], ['Art. 75, II — Lei 14.133/2021', d.legal.compras, 'Outros serviços e compras']].map(([art, v, scope]) => (
              <div key={art} className="card">
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{art}</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', margin: '6px 0 4px' }}>{brl(v)}</p>
                <p style={{ fontSize: 12.5 }}>{scope}</p>
                <p style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 8 }}>{d.legal.fonte} — valores atualizados anualmente em Configurações</p>
              </div>
            ))}
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 700, paddingBottom: 10, marginBottom: 14, borderBottom: '1px solid var(--primary)' }}>Verificar Nova Contratação Direta</h3>
              <div className="stack" style={{ gap: 14 }}>
                <div className="field"><label htmlFor="sim-item">Item do catálogo (CATMAT/CATSER)</label>
                  <select id="sim-item" className="select" value={sim.itemId || (d.itens[0] && d.itens[0].id)} onChange={(e) => simulate({ ...sim, itemId: e.target.value })}>{d.itens.map((i) => <option key={i.id} value={i.id}>{i.catalogo} {i.codigo} — {i.nome}</option>)}</select>
                </div>
                <div className="field"><label htmlFor="sim-valor">Valor da contratação (R$)</label><input id="sim-valor" className="input" inputMode="decimal" value={sim.valor} onChange={(e) => simulate({ ...sim, valor: e.target.value })} placeholder="0,00" /></div>
                {res && (
                  <div role="status" style={{ border: '1px solid ' + (res.ok ? 'var(--primary)' : 'var(--crit-strong)'), borderRadius: 8, padding: 14, background: res.ok ? 'var(--accent-soft)' : 'var(--crit-bg)' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: res.ok ? 'var(--accent)' : 'var(--crit)' }}>{res.ok ? '✓ Contratação direta permitida (art. 75)' : '⚠ Excede o limite — licitação obrigatória'}</p>
                    <p style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>
                      Saldo disponível no exercício para {res.chave}{res.eng ? ' (engenharia)' : ''}: {brl(Math.max(res.saldo, 0))}. Já contratado: {brl(res.acumulado)}
                      {res.ok ? `. Saldo após esta contratação: ${brl(res.saldoApos)}.` : '. Contratar este valor por dispensa caracterizaria fracionamento de despesa.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Async>

      <Despesas toast={toast} />

      {lim.data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, alignItems: 'start' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Catálogo Compras.gov.br</p>
            <div className="row" style={{ gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: syncing ? '#3B82F6' : lim.data.catalogo.modo === 'api' ? 'var(--primary)' : '#F59E0B' }} /><span style={{ fontSize: 13, fontWeight: 700 }}>{syncing ? 'Sincronizando…' : lim.data.catalogo.status}</span></div>
            <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Última sincronização: {lim.data.catalogo.lastSync ? fmtDateTime(lim.data.catalogo.lastSync) + ' · ' + lim.data.catalogo.por : 'nunca (rotina diária às 03h)'}</p>
            <button type="button" className="btn btn-primary" style={{ marginTop: 'auto' }} disabled={syncing} onClick={sync}>{syncing ? 'Sincronizando…' : '↻ Sincronizar catálogo'}</button>
          </div>
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, paddingBottom: 10, marginBottom: 14, borderBottom: '1px solid var(--primary)' }}>Base Cadastral Sincronizada</h3>
            <div className="grid" style={{ '--min': '110px', gap: 10, marginBottom: 14 }}>
              {[['Grupos', 'grupos'], ['Classes', 'classes'], ['PDMs', 'pdms'], ['Itens CATMAT', 'catmat'], ['Itens CATSER', 'catser']].map(([l, k]) => (
                <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}><p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{l}</p><p style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{num(lim.data.catalogo.counts[k])}</p></div>
              ))}
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Endpoints — API de Dados Abertos Compras.gov.br</p>
            {lim.data.catalogo.endpoints.map((ep) => (
              <div key={ep.key} className="row between" style={{ padding: '7px 0', borderBottom: '1px solid var(--divider)', flexWrap: 'nowrap' }}>
                <code style={{ fontSize: 11.5, wordBreak: 'break-all' }}>{ep.path}</code>
                <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color: syncing ? 'var(--info-strong)' : ep.status === 'ok' ? 'var(--accent)' : ep.status === 'falha' ? 'var(--crit)' : 'var(--text-2)' }}>{syncing ? '⏳ consultando' : ep.status === 'ok' ? '✓ atualizado' : ep.status === 'falha' ? '✕ falhou' : '—'}</span>
              </div>
            ))}
            <p style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.5 }}>A sincronização roda no servidor (rotina diária) — a API pública não é consumida pelo navegador. Base: https://dadosabertos.compras.gov.br</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Despesas({ toast }) {
  const [ano] = useExercicio();
  const st = useApi(() => api.get('/compras/despesas?ano=' + ano), [ano]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const d = st.data;
  const color = (p) => (p >= 1 ? 'var(--crit)' : p >= (d ? d.legal.atencao : 0.8) ? 'var(--warn)' : 'var(--accent)');
  const code = (e) => (e.classe ? `CATMAT ${e.catmat || '—'} · Cl. ${e.classe}` : e.grupo ? `CATSER ${e.catser || '—'} · Gr. ${e.grupo}` : '—');
  const patch = async (e, body) => { try { await api.patch('/compras/despesas/' + e.id, body); st.refresh(); } catch (er) { toast(er.message, 'error'); } };
  const save = async (f) => {
    const body = { ...f, empenhado: +f.empenhado };
    ['id', 'acumulado', 'audesp', 'tcn', 'contratoId', 'contrato', 'reserva', 'data'].forEach((k) => delete body[k]);
    if (f.id) await api.put('/compras/despesas/' + f.id, body); else await api.post('/compras/despesas', body);
    setForm(null); toast(f.id ? 'Despesa atualizada' : 'Despesa incluída'); st.refresh();
  };
  const k = q.trim().toLowerCase();
  const rows = d ? d.rows.filter((e) => !k || (e.objeto + ' ' + e.processo + ' ' + code(e)).toLowerCase().includes(k)) : [];
  const tcnPend = d ? d.rows.filter((e) => e.tcn === '').length : 0;

  return (
    <Async state={st} skeleton={<SkeletonRows n={8} />}>
      {() => (
        <>
          <section className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, paddingBottom: 10, marginBottom: 6, borderBottom: '1px solid var(--primary)' }}>Acumulado por Classe (CATMAT) e Grupo (CATSER) — {ano}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14 }}>Soma das despesas empenhadas e da Verbinha no exercício, comparada ao limite de dispensa ({d.legal.fonte}): compras e serviços {brl(d.legal.compras)} · obras e serviços de engenharia {brl(d.legal.engenharia)}.</p>
            <div className="grid" style={{ '--min': '240px', gap: 10 }}>
              {d.groups.map((g) => {
                const s = g.pct >= 1 ? ['Bloqueado', 'critical'] : g.pct >= d.legal.atencao ? ['Atenção', 'warning'] : ['Regular', 'success'];
                return (
                  <div key={g.chave} style={{ border: '1px solid ' + (g.pct >= d.legal.atencao ? '#F3D9A4' : 'var(--border)'), borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="row between" style={{ gap: 8, flexWrap: 'nowrap' }}><span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>{g.chave}</span><Badge level={s[1]}>{s[0]}</Badge></div>
                    <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{g.descricao}</p>
                    <div className="progress" style={{ height: 8 }}><div style={{ width: Math.min(100, Math.round(g.pct * 100)) + '%', background: color(g.pct) }} /></div>
                    <p style={{ fontSize: 12 }}><strong>{brl(g.total)}</strong> de {brl(g.limite)} ({pctF(g.pct)})</p>
                    <p style={{ fontSize: 11, color: 'var(--text-2)' }}>Despesas {brl(g.despesas)} · Verbinha {brl(g.verbinha)}</p>
                  </div>
                );
              })}
              {!d.groups.length && <p className="muted">Nenhuma despesa no exercício.</p>}
            </div>
          </section>

          <section className="card">
            <div className="row between" style={{ paddingBottom: 10, marginBottom: 12, borderBottom: '1px solid var(--primary)' }}>
              <div className="row"><h3 style={{ fontSize: 15, fontWeight: 700 }}>Despesas {ano}</h3>{tcnPend > 0 && <Badge level="warning">{tcnPend} TCN pendente(s) — alerta no Painel após {d.tcnPrazo} dias úteis do empenho</Badge>}</div>
              <div className="row">
                <input type="search" className="input" style={{ minWidth: 220, width: 'auto' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar objeto, processo ou código" aria-label="Buscar despesa" />
                <button type="button" className="btn btn-primary" onClick={() => setForm({ modalidade: 'Dispensa', dataEmpenho: new Date().toISOString().slice(0, 10) })}>+ Incluir despesa</button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 1540 }}>
                <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: '8px 10px', background: 'var(--surface-2)', fontSize: 10.5, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  <span>Proc.</span><span>Objeto</span><span>Código</span><span>Modalidade</span><span>Empenhado</span><span>Empenho</span><span>Ficha/Sub</span><span>AUDESP</span><span>TCN</span><span>Contrato</span><span>Acumulado na data</span>
                </div>
                {rows.map((e) => {
                  const a = e.acumulado;
                  return (
                    <div key={e.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, padding: 10, borderTop: '1px solid var(--divider)', alignItems: 'center', fontSize: 12.5 }}>
                      <button type="button" title="Ver e editar despesa" aria-label={'Ver e editar a despesa do processo ' + e.processo} onClick={() => setForm({ ...e, empenhado: String(e.empenhado) })} style={{ justifySelf: 'start', minHeight: 36, padding: 0, border: 'none', background: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 700, textAlign: 'left' }}>{e.processo}</button>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}><span style={{ display: 'block', fontWeight: 600 }}>{e.objeto}</span><span style={{ fontSize: 11, color: 'var(--text-2)' }}>{e.descricao}</span></span>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-2)', overflowWrap: 'anywhere' }}>{code(e)}</span>
                      <span className="muted">{e.modalidade}</span>
                      <span style={{ fontWeight: 600 }}>{brl(e.empenhado)}</span>
                      <span className="muted">{fmtDate(e.dataEmpenho)}</span>
                      <span className="muted">{(e.ficha || '—') + ' / ' + (e.sub || '—')}</span>
                      <select className="select" aria-label="Preenchimento AUDESP" value={e.audesp} onChange={(ev) => patch(e, { audesp: ev.target.value })} style={{ minHeight: 34, fontSize: 12, padding: '0 6px', background: e.audesp === 'Enviado' ? 'var(--accent-soft)' : e.audesp === 'NA' ? 'var(--surface-3)' : 'var(--surface)' }}>
                        <option value="">Pendente</option><option value="Enviado">Enviado</option><option value="NA">Não se aplica</option>
                      </select>
                      <select className="select" aria-label="TCN" value={e.tcn} onChange={(ev) => patch(e, { tcn: ev.target.value })} style={{ minHeight: 34, fontSize: 12, padding: '0 6px', background: e.tcn === 'Enviado' ? 'var(--accent-soft)' : e.tcn === 'NA' ? 'var(--surface-3)' : 'var(--warn-bg)' }}>
                        <option value="">Pendente</option><option value="Enviado">Enviado</option><option value="NA">Não se aplica</option>
                      </select>
                      <select className="select" aria-label="Contrato vinculado" value={e.contratoId || ''} onChange={(ev) => patch(e, { contratoId: ev.target.value ? +ev.target.value : null })} style={{ minHeight: 34, fontSize: 12, padding: '0 6px' }}>
                        <option value="">Sem contrato</option>{d.contractOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: a ? color(a.pct) : 'var(--text-2)' }}>{a ? brl(a.total) + ' · ' + pctF(a.pct) : '—'}</span>
                        <span className="progress" style={{ height: 5 }}><span style={{ display: 'block', height: 5, borderRadius: 999, background: a ? color(a.pct) : 'transparent', width: a ? Math.min(100, Math.round(a.pct * 100)) + '%' : 0 }} /></span>
                      </span>
                    </div>
                  );
                })}
                {!rows.length && <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>Nenhuma despesa encontrada.</p>}
              </div>
            </div>
          </section>

          <section className="card">
            <h3 style={{ fontSize: 15, fontWeight: 700, paddingBottom: 10, marginBottom: 12, borderBottom: '1px solid var(--primary)' }}>Verbinha (adiantamentos) — {brl(d.verbinha.reduce((a, v) => a + v.valor, 0))}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
              {d.verbinha.map((v) => (
                <div key={v.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{v.origem} · {fmtDate(v.data)}</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{v.classe ? 'Classe ' + v.classe : 'Grupo ' + v.grupo}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{brl(v.valor)}</span>
                </div>
              ))}
              {!d.verbinha.length && <p className="muted">Nenhum adiantamento no exercício.</p>}
            </div>
          </section>
          {form && (
            <FormModal wide cols="170px" title={form.id ? 'Despesa — processo ' + form.processo : 'Incluir despesa'} submitLabel={form.id ? 'Salvar alterações' : 'Incluir'} fields={DESP_FIELDS} initial={form} onClose={() => setForm(null)} onSubmit={save}>
              <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Informe a Classe (CATMAT) para materiais ou o Grupo (CATSER) para serviços. O acumulado é recalculado automaticamente.</p>
            </FormModal>
          )}
        </>
      )}
    </Async>
  );
}
