import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Async, Modal, Segmented, SkeletonCards, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useApi, useIsMobile, useQueryState } from '../../lib/hooks.js';
import { fmtDate, todayIso } from '../../lib/format.js';
import PrazoInput from './PrazoInput.jsx';

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const dm = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
const span = (e) => Math.round((new Date(e.end + 'T12:00') - new Date(e.start + 'T12:00')) / 864e5) + 1;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const LV = { critical: ['Crítico', 'var(--crit-bg)', 'var(--crit-strong)'], warning: ['Atenção', 'var(--warn-bg)', 'var(--warn-title)'] };

/** Calendário integrado (todos os módulos acessíveis) e lista de prazos críticos. */
export default function Calendario({ modoInicial }) {
  const [modo, setModo] = useQueryState('modo', modoInicial || 'mes');
  const cal = useApi(() => api.get('/protocolo/calendario'), []);
  const [hidden, setHidden] = useState(null);
  useEffect(() => { if (cal.data && !hidden) setHidden(Object.fromEntries(cal.data.modules.map((m) => [m.key, !m.on]))); }, [cal.data, hidden]);
  const h = hidden || {};
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div><Segmented label="Modo de visualização" value={modo} onChange={setModo} options={[{ value: 'mes', label: 'Calendário' }, { value: 'lista', label: 'Lista de prazos críticos' }]} /></div>
      {modo === 'lista'
        ? <ListaPrazos hidden={h} onChange={cal.reload} />
        : (
          <Async state={cal} skeleton={<SkeletonCards n={2} h={420} />}>
            {(d) => <Mes data={d} hidden={h} setHidden={setHidden} />}
          </Async>
        )}
    </div>
  );
}

function Mes({ data, hidden, setHidden }) {
  const mobile = useIsMobile();
  const hoje = todayIso();
  const [ym, setYm] = useState(() => hoje.slice(0, 7));
  const [sel, setSel] = useState(hoje);
  const y = +ym.slice(0, 4), mi = +ym.slice(5, 7) - 1;
  const go = (n) => { const d = new Date(y, mi + n, 1); setYm(isoOf(d).slice(0, 7)); };
  const vis = useMemo(() => data.events.filter((e) => !hidden[e.module]), [data, hidden]);
  const first = new Date(y, mi, 1), start = new Date(y, mi, 1 - first.getDay());
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const days = [];
    for (let k = 0; k < 7; k++) {
      const d = new Date(start); d.setDate(start.getDate() + w * 7 + k);
      const iso = isoOf(d);
      days.push({ iso, num: d.getDate(), inMonth: d.getMonth() === mi, evs: vis.filter((e) => e.start <= iso && e.end >= iso) });
    }
    if (w === 5 && days.every((x) => !x.inMonth)) break;
    weeks.push(days);
  }
  const max = mobile ? 4 : 3;
  const selEvents = vis.filter((e) => e.start <= sel && e.end >= sel);
  const upcoming = vis.filter((e) => e.end >= hoje).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 8);
  const selD = new Date(sel + 'T12:00:00');
  return (
    <>
      <div className="card stack" style={{ padding: '14px 16px', gap: 12 }}>
        <div className="row between">
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ width: 44, padding: 0, fontSize: 16 }} aria-label="Mês anterior" onClick={() => go(-1)}>‹</button>
            <h2 style={{ fontSize: 18, fontWeight: 800, minWidth: 170, textAlign: 'center' }} aria-live="polite">{cap(first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</h2>
            <button type="button" className="btn btn-secondary" style={{ width: 44, padding: 0, fontSize: 16 }} aria-label="Próximo mês" onClick={() => go(1)}>›</button>
            <button type="button" className="btn btn-secondary" style={{ color: 'var(--accent)', borderColor: 'var(--primary)' }} onClick={() => { setYm(hoje.slice(0, 7)); setSel(hoje); }}>Hoje</button>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setHidden({})}>Mostrar todos</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setHidden(Object.fromEntries(data.modules.map((m) => [m.key, true])))}>Ocultar todos</button>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {data.modules.map((m) => {
            const on = !hidden[m.key];
            return (
              <button key={m.key} type="button" aria-pressed={on} className="chip" onClick={() => setHidden({ ...hidden, [m.key]: on })}
                style={{ display: 'flex', alignItems: 'center', gap: 8, borderColor: on ? m.color : undefined, background: on ? m.color + '14' : undefined, color: on ? 'var(--text)' : 'var(--text-3)', fontWeight: 600 }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: on ? m.color : 'var(--border-input)' }} />{m.label}<span className="muted" style={{ fontSize: 11 }}>{m.count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden', gridColumn: mobile ? undefined : 'span 2' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((w) => <span key={w} style={{ padding: '10px 6px', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', textAlign: 'center' }}>{w}</span>)}
          </div>
          {weeks.map((days, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {days.map((d) => {
                const isSel = d.iso === sel, isToday = d.iso === hoje;
                return (
                  <button key={d.iso} type="button" onClick={() => setSel(d.iso)} aria-label={fmtDate(d.iso) + (d.evs.length ? ' — ' + d.evs.length + ' evento(s)' : '')} aria-pressed={isSel}
                    style={{ minHeight: mobile ? 64 : 104, padding: 6, border: 'none', borderRight: '1px solid var(--divider)', borderBottom: '1px solid var(--divider)', background: isSel ? 'var(--accent-soft)' : d.inMonth ? 'var(--surface)' : 'var(--surface-2)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, boxShadow: isSel ? 'inset 0 0 0 2px var(--primary)' : 'none', color: 'inherit' }}>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, background: isToday ? 'var(--primary)' : 'transparent', color: isToday ? '#fff' : d.inMonth ? 'var(--text)' : 'var(--text-3)' }}>{d.num}</span>
                    {mobile
                      ? <span style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>{d.evs.slice(0, max).map((e, k) => <span key={k} style={{ width: 6, height: 6, borderRadius: '50%', background: e.color }} />)}</span>
                      : d.evs.slice(0, max).map((e, k) => <span key={k} style={{ display: 'block', fontSize: 10.5, fontWeight: 600, lineHeight: 1.3, padding: '2px 5px', borderRadius: 4, background: e.color + '1A', color: e.color, borderLeft: '3px solid ' + e.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>)}
                    {d.evs.length > max && <span className="muted" style={{ fontSize: 10.5, fontWeight: 700 }}>+{d.evs.length - max} mais</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--primary)' }}>{cap(selD.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>
            {selEvents.map((e, i) => {
              const n = span(e), lv = LV[e.level];
              return (
                <div key={i} className="row" style={{ gap: 10, padding: '10px 0', borderBottom: '1px solid var(--divider)', alignItems: 'stretch', flexWrap: 'nowrap' }}>
                  <span style={{ width: 4, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: e.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>{e.moduleLabel}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{e.title}</p>
                    <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>{n > 1 ? dm(e.start) + ' a ' + dm(e.end) + ' · ' + n + ' dias' : 'Prazo em ' + dm(e.start)}</p>
                    <Link to={e.href} style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', display: 'inline-block', marginTop: 4 }}>Abrir módulo →</Link>
                  </div>
                  {lv && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: lv[1], color: lv[2], height: 'fit-content', whiteSpace: 'nowrap' }}>{lv[0]}</span>}
                </div>
              );
            })}
            {!selEvents.length && <p className="muted" style={{ fontSize: 12.5, padding: '8px 0' }}>Nenhum prazo neste dia para os módulos visíveis.</p>}
          </div>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--primary)' }}>Próximos prazos</h3>
            {upcoming.map((e, i) => {
              const d = e.start < hoje ? hoje : e.start, n = span(e);
              return (
                <div key={i} className="row" style={{ gap: 10, padding: '8px 0', borderBottom: '1px solid var(--divider)', flexWrap: 'nowrap' }}>
                  <div style={{ width: 42, textAlign: 'center', flexShrink: 0 }}><p style={{ fontSize: 16, fontWeight: 800, color: e.color, lineHeight: 1 }}>{d.slice(8, 10)}</p><p className="muted" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{MON[+d.slice(5, 7) - 1]}</p></div>
                  <div style={{ minWidth: 0 }}><p style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</p><p className="muted" style={{ fontSize: 11.5 }}>{e.moduleLabel} · {n > 1 ? n + ' dias (até ' + dm(e.end) + ')' : 'prazo único'}</p></div>
                </div>
              );
            })}
            {!upcoming.length && <p className="muted" style={{ fontSize: 12.5 }}>Nenhum prazo futuro.</p>}
          </div>
        </div>
      </div>
    </>
  );
}

function ListaPrazos({ hidden, onChange }) {
  const toast = useToast();
  const st = useApi(() => api.get('/protocolo/prazos-criticos'), []);
  const own = useApi(() => api.get('/protocolo/prazos'), []);
  const [form, setForm] = useState(null);
  const reload = () => { st.reload(); own.reload(); onChange(); };
  const concluir = async (r) => { try { await api.post(`/protocolo/prazos/${r.ref}/concluir`); toast('Prazo concluído'); reload(); } catch (e) { toast(e.message, 'error'); } };
  const editar = (r) => { const z = (own.data || []).find((x) => x.id === r.ref); if (z) setForm({ id: z.id, ref: z.refTipo + ':' + z.refId, descricao: z.descricao, vencimento: z.vencimento }); };
  return (
    <Async state={st} skeleton={<SkeletonCards n={3} h={90} />}>
      {(d) => {
        const rows = d.rows.filter((r) => !hidden[r.module]);
        const n = (b) => rows.filter((r) => r.bucket === b).length;
        const BK = { vencido: ['Vencido', 'var(--crit-strong)', 'var(--crit-bg)'], urgente: ['Até ' + d.janelaUrgente + ' dias', 'var(--warn)', 'var(--warn-bg)'], proximo: ['Até ' + d.janelaProxima + ' dias', 'var(--info-strong)', 'var(--info-bg)'], agendar: ['A agendar', 'var(--warn-title)', 'var(--warn-bg)'] };
        return (
          <div className="stack" style={{ gap: 20 }}>
            <div className="grid" style={{ '--min': '220px' }}>
              {[['vencido', 'Vencidos'], ['urgente', 'Próximos ' + d.janelaUrgente + ' dias'], ['proximo', 'Próximos ' + d.janelaProxima + ' dias']].map(([b, l]) => (
                <div key={b} style={{ padding: 16, borderRadius: 8, border: '1px solid ' + BK[b][1], background: BK[b][2] }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: BK[b][1], textTransform: 'uppercase', marginBottom: 8 }}>{l}</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: BK[b][1] }}>{n(b)}</p>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="row between" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase' }}>Lista de Prazos Críticos — todos os módulos · {n('agendar')} a agendar</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ ref: '', descricao: '', vencimento: '' })}>+ Novo prazo</button>
              </div>
              {rows.map((r, i) => (
                <div key={i} className="row" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: r.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>{r.moduleLabel}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{r.title}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: BK[r.bucket][1] }}>{r.date ? fmtDate(r.date) : 'Sem data'}</p>
                    <span className="badge" style={{ color: BK[r.bucket][1], background: BK[r.bucket][2] }}>{BK[r.bucket][0]}</span>
                  </div>
                  {r.own
                    ? <div className="row" style={{ gap: 8 }}><button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)' }} onClick={() => editar(r)}>Editar</button><button type="button" className="btn btn-primary btn-sm" title="Marcar como concluído" onClick={() => concluir(r)}>✓ Concluir</button></div>
                    : <Link to={r.href} className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)', borderColor: 'var(--primary)', textDecoration: 'none' }}>Abrir →</Link>}
                </div>
              ))}
              {!rows.length && <p className="muted" style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13 }}>Nenhum prazo vencido ou nos próximos dias.</p>}
            </div>
            {form && <PrazoForm initial={form} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); toast(m); reload(); }} />}
          </div>
        );
      }}
    </Async>
  );
}

function PrazoForm({ initial, onClose, onSaved }) {
  const docs = useApi(() => api.get('/protocolo/documentos'), []);
  const procs = useApi(() => api.get('/protocolo/processos'), []);
  const refs = (docs.data ? docs.data.items.map((d) => ({ value: 'documento:' + d.id, label: d.protocolo + ' — ' + d.assunto })) : [])
    .concat(procs.data ? procs.data.map((p) => ({ value: 'processo:' + p.id, label: p.codigo + ' — ' + p.titulo })) : []);
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  useEffect(() => { if (!f.ref && refs.length) setF((x) => ({ ...x, ref: refs[0].value })); }, [refs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (e) => {
    e.preventDefault();
    if (!f.ref || !f.descricao.trim() || !f.vencimento) return setErr('Informe o documento/processo, a descrição e a data.');
    const [refTipo, refId] = f.ref.split(':');
    try {
      const body = { refTipo, refId: +refId, descricao: f.descricao, vencimento: f.vencimento };
      if (f.id) await api.put('/protocolo/prazos/' + f.id, body); else await api.post('/protocolo/prazos', body);
      onSaved(f.id ? 'Prazo atualizado' : 'Prazo cadastrado');
    } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title={f.id ? 'Editar prazo' : 'Novo prazo'} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" form="pz-form" className="btn btn-primary">Salvar prazo</button></>}>
      <form id="pz-form" className="stack" style={{ gap: 14 }} onSubmit={save} noValidate>
        <div className="field"><label htmlFor="pz-ref">Documento ou processo</label>
          <select id="pz-ref" className="select" value={f.ref} onChange={(e) => { setF({ ...f, ref: e.target.value }); setErr(''); }}>{refs.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
        <div className="field"><label htmlFor="pz-desc">Descrição</label><input id="pz-desc" className="input" value={f.descricao} onChange={(e) => { setF({ ...f, descricao: e.target.value }); setErr(''); }} placeholder="Ex.: Parecer jurídico" /></div>
        <PrazoInput id="pz-data" label="Data do prazo" value={f.vencimento} onChange={(v) => { setF((x) => ({ ...x, vencimento: v })); setErr(''); }} />
        {err && <p role="alert" style={{ fontSize: 12.5, color: 'var(--crit-strong)', background: 'var(--crit-bg)', padding: '8px 12px', borderRadius: 6 }}>{err}</p>}
      </form>
    </Modal>
  );
}
