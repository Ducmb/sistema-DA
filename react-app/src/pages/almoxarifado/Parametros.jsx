import React, { useEffect, useState } from 'react';
import { Async, SkeletonCards, Switch, useToast } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/hooks.js';
import { fmtDateTime, initials } from '../../lib/format.js';

const W = [['alta', 'Prioridade Alta (Curva A)'], ['media', 'Prioridade Média (Curva B)'], ['baixa', 'Prioridade Baixa (Curva C)']];
const pick = (p) => ({ team: p.team.map((m) => ({ userId: m.userId, active: m.active, name: m.name })), days: p.days, weights: { ...p.weights }, calcBase: p.calcBase, perSession: p.perSession, sessionsPerWeek: p.sessionsPerWeek, tolerancePct: p.tolerancePct, recountPct: p.recountPct });
function summary(d) {
  const employees = d.team.filter((m) => m.active).length, porDias = d.calcBase === 'dias';
  const perPerson = (+d.perSession || 0) * (porDias ? d.days.length : +d.sessionsPerWeek || 0);
  return { employees, perPerson, total: employees * perPerson, baseLabel: porDias ? d.days.length + ' dia(s) de contagem' : (+d.sessionsPerWeek || 0) + ' sessão(ões) por semana' };
}

/** Aba Parametrização (restrita ao responsável pelo Serviço de Almoxarifado e Patrimônio). */
export default function Parametros() {
  const toast = useToast();
  const st = useApi(() => api.get('/almoxarifado/params'), []);
  const [draft, setDraft] = useState(null);
  const [newMember, setNewMember] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (st.data) setDraft(pick(st.data)); }, [st.data]);

  const p = st.data;
  const ro = p && !p.isResponsavel;
  const upd = (fn) => { setDraft((d) => { const x = JSON.parse(JSON.stringify(d)); fn(x); return x; }); setErr(''); };
  const dirty = draft && p && JSON.stringify(draft) !== JSON.stringify(pick(p));
  const sum = draft ? draft.weights.alta + draft.weights.media + draft.weights.baixa : 0;
  const save = async () => {
    setBusy(true);
    try { st.setData(await api.put('/almoxarifado/params', { ...draft, team: draft.team.map(({ userId, active }) => ({ userId, active })) })); toast('Parâmetros salvos — carga semanal: ' + summary(draft).total + ' itens'); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const reset = async () => { try { st.setData(await api.post('/almoxarifado/params/reset')); toast('Parâmetros restaurados'); } catch (e) { setErr(e.message); } };

  return (
    <Async state={st} skeleton={<SkeletonCards n={4} h={220} />}>
      {() => !draft ? null : (
        <div className="stack" style={{ gap: 20 }}>
          <div className="row" style={{ padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)' }}>
            <span aria-hidden="true" style={{ fontSize: 16 }}>🔒</span>
            <p style={{ fontSize: 12.5, flex: 1, minWidth: 200 }}>Área administrativa restrita ao <strong>responsável pelo Serviço de Almoxarifado e Patrimônio</strong>. As regras abaixo alimentam a distribuição de carga e a geração da escala semanal.{ro && ' Você pode consultar, mas não alterar.'}</p>
            <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Última alteração: {p.lastSaved ? fmtDateTime(p.lastSaved.at) + ' — ' + (p.lastSaved.by || '') : '—'}</span>
          </div>
          <fieldset disabled={ro} style={{ border: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 20, alignItems: 'start' }}>
            <section className="card lg">
              <h3 className="card-title">Equipe da escala de contagem</h3>
              <p className="card-sub" style={{ marginBottom: 14 }}>Servidores que recebem itens na escala semanal</p>
              <div className="stack" style={{ gap: 8 }}>
                {draft.team.map((m, i) => (
                  <div key={m.userId} className="row" style={{ gap: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, flexWrap: 'nowrap' }}>
                    <div className="avatar" style={{ width: 36, height: 36, fontSize: 12, background: m.active ? '#1C543A' : 'var(--surface-3)', color: m.active ? '#fff' : 'var(--text-2)' }}>{initials(m.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontWeight: 600 }}>{m.name}</p><p style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{m.active ? 'Ativo na escala' : 'Fora da escala'}</p></div>
                    <Switch on={m.active} label="Ativar ou retirar da escala" disabled={ro} onChange={() => upd((x) => { x.team[i].active = !x.team[i].active; })} />
                    <button type="button" className="close-btn" style={{ color: 'var(--crit)', border: '1px solid var(--border-input)', background: 'var(--surface)' }} aria-label={'Remover ' + m.name + ' da equipe'} onClick={() => upd((x) => { x.team.splice(i, 1); })}>✕</button>
                  </div>
                ))}
                <div className="row" style={{ gap: 8, marginTop: 4, flexWrap: 'nowrap' }}>
                  <select className="select" value={newMember} onChange={(e) => setNewMember(e.target.value)} aria-label="Servidor a adicionar">
                    <option value="">Nome do servidor</option>{p.candidates.filter((c) => !draft.team.some((m) => m.userId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" className="btn btn-primary" disabled={!newMember} onClick={() => { const c = p.candidates.find((x) => x.id === +newMember); upd((x) => x.team.push({ userId: c.id, name: c.name, active: true })); setNewMember(''); }}>Adicionar</button>
                </div>
              </div>
            </section>

            <section className="card lg">
              <h3 className="card-title">Ritmo de contagem</h3>
              <p className="card-sub" style={{ marginBottom: 14 }}>Define a capacidade semanal do setor</p>
              <div className="grid" style={{ '--min': '160px', gap: 14 }}>
                <div className="field"><label htmlFor="p-sess">Itens por sessão</label><input id="p-sess" type="number" min="1" max="50" className="input" value={draft.perSession} onChange={(e) => upd((x) => { x.perSession = e.target.value; })} /><span className="hint">Contagens por servidor em cada sessão</span></div>
                <div className="field"><label htmlFor="p-spw">Sessões por semana</label><input id="p-spw" type="number" min="1" max="5" className="input" disabled={draft.calcBase === 'dias'} value={draft.sessionsPerWeek} onChange={(e) => upd((x) => { x.sessionsPerWeek = e.target.value; })} /><span className="hint">Quantas vezes a equipe conta na semana</span></div>
              </div>
              <div className="field" style={{ marginTop: 16 }}>
                <label htmlFor="p-base">Base do cálculo da carga semanal</label>
                <select id="p-base" className="select" value={draft.calcBase} onChange={(e) => upd((x) => { x.calcBase = e.target.value; })}><option value="dias">Dias de contagem selecionados abaixo</option><option value="sessoes">Número de sessões por semana</option></select>
                <span className="hint">Carga por servidor = itens por sessão × dias (ou sessões) da semana.</span>
              </div>
              <div className="row between" style={{ marginTop: 16, marginBottom: 6 }}>
                <p style={{ fontSize: 12, fontWeight: 600 }}>Dias de contagem</p>
                <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)', minHeight: 32 }} onClick={() => upd((x) => { x.days = p.allDays.every((d) => x.days.includes(d)) ? [] : p.allDays.slice(); })}>{p.allDays.every((d) => draft.days.includes(d)) ? 'Limpar dias' : 'Selecionar todos'}</button>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {p.allDays.map((d) => { const on = draft.days.includes(d); return <button key={d} type="button" aria-pressed={on} className="chip" style={{ borderRadius: 8, minWidth: 52, background: on ? 'var(--primary)' : undefined, color: on ? '#fff' : undefined, borderColor: on ? 'var(--primary)' : undefined }} onClick={() => upd((x) => { x.days = on ? x.days.filter((y) => y !== d) : p.allDays.filter((y) => y === d || x.days.includes(y)); })}>{d}</button>; })}
              </div>
            </section>

            <section className="card lg">
              <h3 className="card-title">Pesos por prioridade</h3>
              <p className="card-sub" style={{ marginBottom: 14 }}>Participação de cada curva no sorteio (soma deve ser 100%)</p>
              <div className="stack" style={{ gap: 12 }}>
                {W.map(([k, label]) => (
                  <div key={k}>
                    <div className="row between" style={{ marginBottom: 4 }}><span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span><span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>{draft.weights[k]}%</span></div>
                    <input type="range" min="0" max="100" step="5" value={draft.weights[k]} aria-label={label} onChange={(e) => { const v = +e.target.value; upd((x) => { x.weights[k] = v; }); }} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                  </div>
                ))}
                <p style={{ fontSize: 12.5, fontWeight: 700, color: sum === 100 ? 'var(--accent)' : 'var(--crit-strong)' }}>Soma: {sum}%</p>
              </div>
            </section>

            <section className="card lg">
              <h3 className="card-title">Controle de qualidade</h3>
              <p className="card-sub" style={{ marginBottom: 14 }}>Regras de divergência e recontagem</p>
              <div className="grid" style={{ '--min': '160px', gap: 14 }}>
                <div className="field"><label htmlFor="p-tol">Tolerância de divergência (%)</label><input id="p-tol" type="number" min="0" max="100" className="input" value={draft.tolerancePct} onChange={(e) => upd((x) => { x.tolerancePct = e.target.value; })} /><span className="hint">Acima disso, a contagem é marcada como divergente</span></div>
                <div className="field"><label htmlFor="p-rec">Recontagem por amostra (%)</label><input id="p-rec" type="number" min="0" max="100" className="input" value={draft.recountPct} onChange={(e) => upd((x) => { x.recountPct = e.target.value; })} /><span className="hint">Parte dos itens contados que é recontada</span></div>
              </div>
            </section>
          </fieldset>

          <div className="row between" style={{ gap: 16, padding: '16px 20px', border: '1px solid var(--primary)', borderRadius: 12, background: 'var(--accent-soft)' }}>
            <div className="row" style={{ gap: 24 }}>
              {(() => { const s = summary(draft); return [['Servidores ativos', s.employees], ['Limite por servidor', s.perPerson + ' itens/semana', s.baseLabel], ['Carga semanal do setor', s.total + ' contagens']].map(([l, v, sub], i) => (
                <div key={l}><p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{l}</p><p style={{ fontSize: 18, fontWeight: 800, color: i === 2 ? 'var(--accent)' : 'var(--text)' }}>{v}</p>{sub && <p style={{ fontSize: 11, color: 'var(--text-2)' }}>{sub}</p>}</div>
              )); })()}
            </div>
            {!ro && (
              <div className="row">
                <button type="button" className="btn btn-secondary" onClick={reset}>Restaurar padrão</button>
                <button type="button" className="btn btn-primary" disabled={!dirty || busy} onClick={save}>Salvar parâmetros</button>
              </div>
            )}
          </div>
          {err && <p role="alert" style={{ fontSize: 12.5, color: 'var(--crit-strong)', fontWeight: 600 }}>{err}</p>}
        </div>
      )}
    </Async>
  );
}
