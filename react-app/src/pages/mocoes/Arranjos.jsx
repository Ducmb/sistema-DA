import React, { useState } from 'react';
import { Async, Modal, SkeletonCards, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/hooks.js';
import { fmtDate, todayIso } from '../../lib/format.js';
import { errStyle } from './MocoesModule.jsx';

const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const FIELDS = [['homenageado', 'Homenageado', 'text'], ['honraria', 'Honraria', 'text'], ['vereadorId', 'Vereador autor', 'vereador'], ['material', 'Material (placa, arranjo, medalha)', 'text'], ['processo', 'Processo do pedido', 'text'], ['decreto', 'Decreto', 'text'], ['data', 'Data da entrega', 'date'], ['horario', 'Horário', 'text'], ['obs', 'Observações', 'text']];
const chip = (label, done) => ({ label, bg: done ? 'var(--accent-soft)' : 'var(--warn-bg)', color: done ? 'var(--accent)' : 'var(--warn-title)' });

/** Itens (placa/arranjo/medalha) derivados do material e da situação da entrega. */
function itens(h) {
  const s = h.status || '', out = [];
  const placa = /PLACA ENTREGUE|^ENTREGUE/i.test(s), tudo = /^ENTREGUE/i.test(s);
  if (/placa/i.test(h.material)) out.push(chip('Placa ' + (placa ? 'entregue' : 'encomendada'), placa));
  if (/arranjo/i.test(h.material)) out.push(chip('Arranjo ' + (tudo ? 'entregue' : 'encomendado'), tudo));
  if (/medalha/i.test(h.material)) out.push(chip('Medalha', tudo));
  if (/EVENTO FORA/i.test(s)) out.push({ label: 'Evento fora', bg: 'var(--info-bg)', color: 'var(--info-strong)' });
  return out;
}

/** Arranjos e Placas: logística de entrega das homenagens. */
export default function Arranjos({ meta, vereadores }) {
  const toast = useToast();
  const st = useApi(() => api.get('/mocoes/entregas'), []);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('todos');
  const [form, setForm] = useState(null);
  const hoje = todayIso();
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Arranjos e Placas</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Logística de entrega das homenagens. As datas agendadas aparecem no Calendário Integrado do Protocolo.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setForm({ homenageado: '', honraria: '', vereadorId: '', material: 'Placa', processo: '', decreto: '', data: '', horario: '19h', status: 'PLACA ENCOMENDADA', obs: '' })}>+ Nova entrega</button>
      </div>
      <Async state={st} skeleton={<SkeletonCards n={6} h={150} />}>
        {(all) => {
          const t = q.trim().toLowerCase();
          const list = all.filter((h) => (!t || (h.homenageado + ' ' + h.vereador + ' ' + h.decreto).toLowerCase().includes(t))
            && (filter === 'todos' || (filter === 'proximas' && h.data && h.data >= hoje) || (filter === 'agendar' && !h.data) || (filter === 'pendentes' && /ENCOMENDAD/i.test(h.status))));
          return (
            <>
              <div className="card row" style={{ padding: 14 }}>
                <input type="search" className="input" style={{ flex: 1, minWidth: 200 }} list="dl-ver-arr" placeholder="Buscar homenageado, vereador ou decreto" aria-label="Buscar entrega" value={q} onChange={(e) => setQ(e.target.value)} />
                <datalist id="dl-ver-arr">{vereadores.map((v) => <option key={v.id} value={v.nome} />)}</datalist>
                <select className="select" style={{ width: 'auto' }} aria-label="Filtrar entregas" value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="todos">Todas</option><option value="proximas">Próximas entregas</option><option value="agendar">A agendar</option><option value="pendentes">Com item pendente</option>
                </select>
                <span className="muted" style={{ fontSize: 12 }}>{list.length} entrega(s)</span>
              </div>
              <div className="grid" style={{ '--min': '300px', gap: 12 }}>
                {list.map((h) => {
                  const past = h.data && h.data < hoje;
                  return (
                    <div key={h.id} className="card stack" style={{ padding: 16, gap: 10 }}>
                      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 54, height: 54, borderRadius: 8, background: !h.data ? 'var(--warn-bg)' : past ? 'var(--surface-3)' : 'var(--primary)', color: !h.data ? 'var(--warn-title)' : past ? 'var(--text-2)' : '#fff' }}>
                          <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{h.data ? h.data.slice(8, 10) : '—'}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' }}>{h.data ? MON[+h.data.slice(5, 7) - 1] : 'agendar'}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 700 }}>{h.homenageado}</p>
                          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{h.honraria} · Ver. {h.vereador}</p>
                          <p className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{h.data ? fmtDate(h.data) + (h.horario ? ' às ' + h.horario : '') + (past ? ' · realizada' : '') : 'Data e horário a agendar'}</p>
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)' }} aria-label={'Editar entrega de ' + h.homenageado} onClick={() => setForm({ ...h, data: h.data || '' })}>Editar</button>
                      </div>
                      <div className="row" style={{ gap: 6 }}>{itens(h).map((it) => <span key={it.label} className="badge" style={{ borderRadius: 999, background: it.bg, color: it.color }}>{it.label}</span>)}</div>
                      <p className="muted" style={{ fontSize: 11.5 }}>Processo {h.processo || '—'} · Decreto {h.decreto || '—'}</p>
                      {h.obs && <p style={{ fontSize: 11.5, color: 'var(--warn-title)' }}>{h.obs}</p>}
                    </div>
                  );
                })}
              </div>
              {!list.length && <p className="muted" style={{ textAlign: 'center', padding: 28 }}>Nenhuma entrega encontrada.</p>}
            </>
          );
        }}
      </Async>
      {form && <EntregaForm meta={meta} vereadores={vereadores} initial={form} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); toast(m); st.reload(); }} />}
    </div>
  );
}

function EntregaForm({ meta, vereadores, initial, onClose, onSaved }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault();
    if (!f.homenageado.trim()) return setErr('Informe o homenageado.');
    if (!f.vereadorId) return setErr('Selecione o vereador autor.');
    try {
      const body = { ...f, vereadorId: +f.vereadorId };
      delete body.id; delete body.vereador;
      if (f.id) await api.put('/mocoes/entregas/' + f.id, body); else await api.post('/mocoes/entregas', body);
      onSaved(f.id ? 'Entrega atualizada' : 'Entrega cadastrada');
    } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title={f.id ? 'Editar entrega' : 'Nova entrega'} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" form="ent-form" className="btn btn-primary">Salvar</button></>}>
      <form id="ent-form" className="stack" style={{ gap: 12 }} onSubmit={save} noValidate>
        <div className="grid" style={{ '--min': '200px', gap: 12 }}>
          {FIELDS.map(([k, label, type]) => (
            <div key={k} className="field"><label htmlFor={'ent-' + k}>{label}</label>
              {type === 'vereador'
                ? <select id={'ent-' + k} className="select" value={f[k]} onChange={(e) => { setF({ ...f, [k]: e.target.value }); setErr(''); }}><option value="">Selecione o vereador autor…</option>{vereadores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select>
                : <input id={'ent-' + k} type={type} className="input" value={f[k] || ''} onChange={(e) => { setF({ ...f, [k]: e.target.value }); setErr(''); }} />}
            </div>
          ))}
        </div>
        <div className="field"><label htmlFor="ent-st">Situação</label><select id="ent-st" className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{(meta ? meta.entregaStatus : [f.status]).map((s) => <option key={s}>{s}</option>)}</select></div>
        <p className="hint">Sem data, a entrega aparece como "a agendar" nos prazos críticos.</p>
        {err && <p role="alert" style={errStyle}>{err}</p>}
      </form>
    </Modal>
  );
}
