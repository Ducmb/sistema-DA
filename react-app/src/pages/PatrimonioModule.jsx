import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout.jsx';
import { Async, Badge, Kpi, Modal, SkeletonRows, useToast } from '../components/ui.jsx';
import { api, qs } from '../lib/api.js';
import { useApi, useQueryState } from '../lib/hooks.js';
import { fmtDate, todayIso } from '../lib/format.js';
import { fontSerif } from '../theme.js';

const LEVEL = { Pendente: 'warning', 'Verificar transferência': 'info', Realizado: 'success', Recusado: 'critical' };
const EMPTY = { code: '', description: '', fromUser: '', toUser: '', fromCc: '', toCc: '', date: '' };

/** Patrimônio e Ativos: transferências de responsabilidade e termos por centro de custo. */
export default function PatrimonioModule() {
  const toast = useToast();
  const [view, setView] = useQueryState('view', 'transf');
  const [openId, setOpenId] = useQueryState('transf', '');
  const meta = useApi(() => api.get('/patrimonio/meta'), []);
  const st = useApi(() => api.get('/patrimonio/transferencias'), []);
  const [form, setForm] = useState(null);

  const act = async (fn, msg) => { try { const r = await fn(); toast(msg(r)); st.reload(); } catch (e) { toast(e.message, 'error'); } };
  const move = (t, dir) => act(() => api.post(`/patrimonio/transferencias/${t.id}/etapa`, { dir }), (r) => t.code + ': ' + r.status);
  const decide = (t, sign) => act(() => api.post(`/patrimonio/transferencias/${t.id}/${sign ? 'assinar' : 'recusar'}`), () => sign ? 'Termo assinado — ' + t.code : 'Transferência recusada — ' + t.code);
  const edit = (t) => setForm({ id: t.id, code: t.code, description: t.description, fromUser: t.fromUser, toUser: t.toUser, fromCc: t.fromCc, toCc: t.toCc, date: t.date });
  const selected = st.data && st.data.items.find((t) => String(t.id) === String(openId));
  const pend = st.data ? st.data.termosPendentes : 0;
  const v = view === 'termos' ? 'termos' : 'transf';

  return (
    <>
      <PageHeader section="Patrimônio" title="Patrimônio e Ativos — Transferências">
        <button type="button" className="btn btn-primary" onClick={() => setForm({ ...EMPTY, date: todayIso() })}>+ Nova transferência</button>
      </PageHeader>
      <main className="page">
        {st.data && st.data.myPending && (() => { const t = st.data.myPending; return (
          <div className="row between fade-up" style={{ padding: '18px 20px', borderRadius: 12, border: '1px solid var(--warn)', background: 'var(--warn-bg)', gap: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--warn-title)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Transferência Pendente para Você</p>
              <p style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{t.description} — {t.code}</p>
              <p style={{ fontSize: 12, color: 'var(--warn-title)', marginTop: 2 }}>De: {t.fromUser}</p>
            </div>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={() => decide(t, true)}>✒ Assinar Digitalmente</button>
              <button type="button" className="btn btn-secondary" style={{ color: 'var(--crit)', borderColor: 'var(--crit)' }} onClick={() => decide(t, false)}>✕ Contestar/Recusar</button>
            </div>
          </div>
        ); })()}

        <div role="tablist" aria-label="Seções do patrimônio" className="tabs">
          <button type="button" role="tab" className="tab" aria-selected={v === 'transf'} onClick={() => setView('transf')}>Transferências</button>
          <button type="button" role="tab" className="tab" aria-selected={v === 'termos'} onClick={() => setView('termos')}>Termos de responsabilidade{pend > 0 && <span className="count" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>{pend}</span>}</button>
        </div>

        <div className="fade-up" key={v}>
          {v === 'transf' ? (
            <Async state={st} skeleton={<SkeletonRows n={5} />} empty={{ when: (d) => !d.items.length, icon: '🏛', title: 'Nenhuma transferência registrada' }}>
              {(d) => (
                <div className="table-wrap">
                  <table className="table" style={{ minWidth: 860 }}>
                    <thead><tr><th>Tombamento</th><th>Bem</th><th>De</th><th>Para</th><th>Data</th><th style={{ width: 230 }}>Etapa</th></tr></thead>
                    <tbody>
                      {d.items.map((t) => (
                        <tr key={t.id} className="clickable" onClick={() => setOpenId(String(t.id))}>
                          <td><button type="button" title="Ver e editar transferência" onClick={(e) => { e.stopPropagation(); edit(t); }} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 3, minHeight: 32 }}>{t.code}</button></td>
                          <td>{t.description}</td>
                          <td className="muted">{t.fromUser}{t.fromCc && <span style={{ display: 'block', fontSize: 11, color: '#7C5BD6' }}>{t.fromCc}</span>}</td>
                          <td className="muted">{t.toUser}{t.toCc && <span style={{ display: 'block', fontSize: 11, color: '#7C5BD6' }}>{t.toCc}</span>}</td>
                          <td className="muted-3" style={{ fontSize: 12 }}>{fmtDate(t.date)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="stack" style={{ gap: 6 }}>
                              <Badge level={LEVEL[t.status]} style={{ width: 'fit-content' }}>{t.status}</Badge>
                              {(t.prev || t.next) && (
                                <div className="row" style={{ gap: 6 }}>
                                  {t.prev && <button type="button" className="btn btn-secondary btn-sm" title={'Voltar para ' + t.prev} onClick={() => move(t, -1)}>← Voltar</button>}
                                  {t.next && <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)' }} onClick={() => move(t, 1)}>{t.next} →</button>}
                                </div>
                              )}
                              <div className="row" style={{ gap: 3, flexWrap: 'nowrap' }} aria-hidden="true">
                                {['Pendente', 'Verificar transferência', 'Realizado'].map((s, k) => <span key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: t.index >= 0 && k <= t.index ? 'var(--primary)' : 'var(--border)' }} />)}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Async>
          ) : <Termos onEdit={edit} onChange={st.reload} />}
        </div>
      </main>

      {form && <TransferForm meta={meta.data} initial={form} onClose={() => setForm(null)} onSaved={(msg) => { setForm(null); toast(msg); st.reload(); }} />}
      {selected && <TermoModal t={selected} onClose={() => setOpenId('')} />}
    </>
  );
}

function TransferForm({ meta, initial, onClose, onSaved }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr(''); };
  const submit = async (e) => {
    e.preventDefault();
    const blank = ['code', 'description', 'fromUser', 'toUser', 'date'].some((k) => !String(f[k] || '').trim());
    if (blank) return setErr('Preencha todos os campos.');
    setBusy(true);
    try {
      const body = { code: f.code, description: f.description, fromUser: f.fromUser, toUser: f.toUser, fromCc: f.fromCc, toCc: f.toCc, date: f.date };
      const r = f.id ? await api.put('/patrimonio/transferencias/' + f.id, body) : await api.post('/patrimonio/transferencias', body);
      onSaved('Transferência ' + r.code + (f.id ? ' atualizada' : ' registrada'));
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const input = (id, k, label, props = {}) => (
    <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="input" value={f[k]} onChange={set(k)} {...props} /></div>
  );
  return (
    <Modal title={f.id ? 'Editar transferência' : 'Nova transferência de patrimônio'} sub="A transferência fica Pendente até o novo responsável assinar o termo." onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" form="tr-form" className="btn btn-primary" disabled={busy}>{f.id ? 'Salvar alterações' : 'Registrar transferência'}</button></>}>
      <form id="tr-form" className="stack" style={{ gap: 14 }} onSubmit={submit} noValidate>
        <div className="grid" style={{ '--min': '200px', gap: 12 }}>
          {input('tr-code', 'code', 'Código de tombamento', { placeholder: 'DA-PAT-00000' })}
          {input('tr-date', 'date', 'Data da transferência', { type: 'date' })}
        </div>
        {input('tr-desc', 'description', 'Descrição do bem', { placeholder: 'Ex.: Notebook Dell Latitude 5420' })}
        <div className="grid" style={{ '--min': '200px', gap: 12 }}>
          {input('tr-from', 'fromUser', 'De (responsável atual)', { placeholder: 'Servidor ou setor', list: 'dl-resp', autoComplete: 'off' })}
          {input('tr-to', 'toUser', 'Para (novo responsável)', { placeholder: 'Servidor ou setor', list: 'dl-resp', autoComplete: 'off' })}
        </div>
        <div className="grid" style={{ '--min': '200px', gap: 12 }}>
          {input('tr-fcc', 'fromCc', 'Centro de custo de origem', { placeholder: 'Digite ou selecione', list: 'dl-patcc', autoComplete: 'off' })}
          {input('tr-tcc', 'toCc', 'Centro de custo de destino', { placeholder: 'Digite ou selecione', list: 'dl-patcc', autoComplete: 'off' })}
        </div>
        <datalist id="dl-patcc">{(meta ? meta.patCcs : []).map((c) => <option key={c.id} value={c.nome} />)}</datalist>
        <datalist id="dl-resp">{(meta ? meta.users.map((u) => u.name).concat(meta.patCcs.map((c) => c.nome)) : []).map((n) => <option key={n} value={n} />)}</datalist>
        <p className="hint" style={{ marginTop: -4 }}>Somente centros de custo do tipo Patrimônio (Configurações › Centros de Custo). O termo é assinado pelo servidor de destino.</p>
        {err && <p role="alert" style={{ fontSize: 12.5, color: 'var(--crit-strong)', background: 'var(--crit-bg)', padding: '8px 12px', borderRadius: 6 }}>{err}</p>}
      </form>
    </Modal>
  );
}

function TermoModal({ t, onClose }) {
  const row = (l, v) => <div className="row between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6, flexWrap: 'nowrap' }}><span>{l}</span><strong style={{ textAlign: 'right' }}>{v}</strong></div>;
  return (
    <Modal title="Termo de Transferência de Responsabilidade Patrimonial" onClose={onClose}
      footer={<button type="button" className="btn btn-primary" onClick={onClose}>Fechar</button>}>
      <div style={{ fontFamily: fontSerif }}>
        <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: 'var(--accent)', borderBottom: '2px solid var(--primary)', paddingBottom: 12, marginBottom: 18 }}>CÂMARA MUNICIPAL — DIRETORIA ADMINISTRATIVA</p>
        <p style={{ fontSize: 14.5, lineHeight: 1.8, textAlign: 'justify' }}>
          Pelo presente termo, fica formalizada a transferência de guarda e responsabilidade civil do bem patrimonial abaixo descrito, nos termos do rito fiscal-contábil da Diretoria Administrativa, transferindo-se a posse funcional de <strong>{t.fromUser}</strong> para <strong>{t.toUser}</strong>.
        </p>
        <div className="stack" style={{ gap: 8, marginTop: 18, fontSize: 14 }}>
          {row('Código de Tombamento:', t.code)}
          {row('Descrição do Bem:', t.description)}
          {row('Data da Transferência:', fmtDate(t.date))}
          {row('Status:', t.status)}
          {t.signedAt && row('Assinatura:', (t.signedBy || '') + ' · ' + fmtDate(t.signedAt))}
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.8, textAlign: 'justify', marginTop: 18 }}>
          A responsabilidade legal pelo bem somente se formaliza junto à base geral de ativos do município após assinatura eletrônica autenticada do responsável de destino.
        </p>
      </div>
    </Modal>
  );
}

function Termos({ onEdit, onChange }) {
  const toast = useToast();
  const [mes, setMes] = useQueryState('mes', '');
  const [filtro, setFiltro] = useState('pendentes');
  const st = useApi(() => api.get('/patrimonio/termos' + qs({ mes })), [mes]);
  useEffect(() => { if (!mes && st.data) setMes(st.data.ym); }, [st.data, mes, setMes]);
  const toggle = async (r) => {
    try {
      if (r.emitido) await api.delete(`/patrimonio/termos/${r.id}/${st.data.ym}`); else await api.put(`/patrimonio/termos/${r.id}/${st.data.ym}`);
      toast(r.emitido ? 'Emissão desfeita — ' + r.nome : 'Termo emitido — ' + r.nome); st.reload(); onChange();
    } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <section className="card lg stack" style={{ gap: 14 }}>
      <div className="row between" style={{ alignItems: 'flex-end', paddingBottom: 10, borderBottom: '1px solid var(--primary)', gap: 12 }}>
        <div>
          <h3 className="card-title">Termos de responsabilidade a emitir</h3>
          <p className="card-sub">Centros de custo de patrimônio que tiveram entrada ou saída de bens no mês. Cada movimentação exige um novo termo.</p>
        </div>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field"><label htmlFor="tm-mes">Mês</label><input id="tm-mes" type="month" className="input" value={mes || (st.data ? st.data.ym : '')} onChange={(e) => e.target.value && setMes(e.target.value)} /></div>
          <div className="field"><label htmlFor="tm-st">Situação</label><select id="tm-st" className="select" value={filtro} onChange={(e) => setFiltro(e.target.value)}><option value="pendentes">Termo pendente</option><option value="emitidos">Termo emitido</option><option value="todos">Todos</option></select></div>
        </div>
      </div>
      <Async state={st} skeleton={<SkeletonRows n={4} />}>
        {(d) => {
          const shown = d.rows.filter((r) => filtro === 'todos' || (filtro === 'pendentes' ? !r.emitido : !!r.emitido));
          return (
            <>
              <div className="grid" style={{ '--min': '160px', gap: 10 }}>
                <Kpi label="Centros com movimentação" value={d.rows.length} color="var(--text)" />
                <Kpi label="Termos pendentes" value={d.pendentes} color={d.pendentes ? 'var(--warn)' : 'var(--accent)'} />
                <Kpi label="Movimentações no mês" value={d.movimentos} color="var(--text)" />
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {shown.map((r) => {
                  const e = r.movs.filter((m) => m.dir === 'Entrada').length;
                  return (
                    <div key={r.id} className="stack" style={{ gap: 10, padding: '14px 16px', borderRadius: 8, border: '1px solid ' + (r.emitido ? 'var(--border)' : '#F3D9A4') }}>
                      <div className="row between">
                        <div className="row">
                          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#7C5BD6' }}>{r.codigo}</span>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{r.nome}</span>
                          <span className="muted" style={{ fontSize: 11 }}>{e} entrada(s) · {r.movs.length - e} saída(s)</span>
                        </div>
                        <div className="row">
                          <Badge level={r.emitido ? 'success' : 'warning'}>{r.emitido ? 'Termo emitido em ' + fmtDate(r.emitido) : 'Emitir novo termo'}</Badge>
                          <button type="button" className="btn btn-secondary btn-sm" style={{ color: r.emitido ? 'var(--text-2)' : 'var(--accent)' }} onClick={() => toggle(r)}>{r.emitido ? '← Desfazer' : 'Marcar termo emitido →'}</button>
                        </div>
                      </div>
                      <div className="stack" style={{ gap: 4 }}>
                        {r.movs.map((m, i) => (
                          <p key={i} style={{ fontSize: 12, color: 'var(--text-2)' }}><span style={{ fontWeight: 700, color: m.dir === 'Entrada' ? 'var(--accent)' : 'var(--warn)' }}>{m.dir}</span> · {m.code} — {m.description} · {m.other} · {fmtDate(m.date)} · {m.status}</p>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!shown.length && (
                  <p style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--text-2)', border: '1px dashed var(--border-input)', borderRadius: 8 }}>
                    {d.rows.length ? 'Nenhum centro de custo nesta situação em ' + d.mes + '.' : d.movimentos ? `Nenhuma das ${d.movimentos} movimentação(ões) de ${d.mes} tem centro de custo de patrimônio. Defina os centros abaixo.` : 'Nenhuma movimentação de bens em ' + d.mes + '.'}
                  </p>
                )}
              </div>
              {d.orphans.length > 0 && (
                <div className="stack" style={{ gap: 8, padding: '14px 16px', borderRadius: 8, border: '1px solid #F3D9A4', background: 'var(--warn-bg)' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn-title)' }}>Movimentações sem centro de custo de patrimônio ({d.orphans.length})</p>
                  <p className="muted" style={{ fontSize: 12 }}>Estas transferências não entram no cálculo dos termos até que origem e destino tenham um centro de custo do tipo Patrimônio.</p>
                  {d.orphans.map((o) => (
                    <div key={o.id} className="row between" style={{ paddingTop: 8, borderTop: '1px solid #F3E6C7' }}>
                      <p style={{ fontSize: 12, minWidth: 0 }}><strong>{o.code}</strong> — {o.description} · {(o.fromCc || o.fromUser + ' (sem CC)') + ' → ' + (o.toCc || o.toUser + ' (sem CC)')} · {fmtDate(o.date)} · {o.status}</p>
                      <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)' }} onClick={() => onEdit(o)}>Definir centros de custo →</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        }}
      </Async>
    </section>
  );
}
