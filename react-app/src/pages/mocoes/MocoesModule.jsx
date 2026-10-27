import React, { useState } from 'react';
import { PageHeader } from '../../components/Layout.jsx';
import { Async, Modal, SkeletonRows, useToast } from '../../components/ui.jsx';
import { api, qs } from '../../lib/api.js';
import { useApi, useDebounced, useQueryState } from '../../lib/hooks.js';
import { fmtDate, todayIso } from '../../lib/format.js';
import Arranjos from './Arranjos.jsx';
import Bandeiras from './Bandeiras.jsx';

const ST = { Aprovada: ['var(--accent-soft)', 'var(--accent)'], 'Em Análise': ['var(--warn-bg)', 'var(--warn-title)'], Rejeitada: ['var(--crit-bg)', 'var(--crit-strong)'], Arquivada: ['var(--surface-3)', 'var(--text-2)'] };
export const errStyle = { fontSize: 12.5, color: 'var(--crit-strong)', fontWeight: 600 };

/** Moções & Homenagens: controle de moções, galeria (cota), arranjos/placas e bandeiras. */
export default function MocoesModule() {
  const [tab, setTab] = useQueryState('tab', 'mocoes');
  const meta = useApi(() => api.get('/mocoes/meta'), []);
  const vers = useApi(() => api.get('/vereadores'), []);
  const T = [['mocoes', 'Controle de Moções', '— Portaria DA 01/2026'], ['galeria', 'Galeria de Homenageados', '— Portaria DA 03/2023'], ['arranjos', 'Arranjos e Placas'], ['bandeiras', 'Bandeiras']];
  const t = T.some(([k]) => k === tab) ? tab : 'mocoes';
  return (
    <>
      <PageHeader section="Moções & Homenagens" title="Módulo de Moções & Homenagens" />
      <main className="page">
        <div role="tablist" aria-label="Seções de moções e homenagens" className="row" style={{ gap: 6, borderBottom: '2px solid var(--primary)', flexWrap: 'nowrap', overflowX: 'auto' }}>
          {T.map(([k, l, sub]) => (
            <button key={k} type="button" role="tab" aria-selected={t === k} onClick={() => setTab(k)}
              style={{ minHeight: 44, padding: '0 18px', border: 'none', borderRadius: '8px 8px 0 0', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', background: t === k ? 'var(--primary)' : 'transparent', color: t === k ? '#fff' : 'var(--text-2)' }}>
              {l}{sub && <span style={{ fontWeight: 500, opacity: 0.7 }}> {sub}</span>}
            </button>
          ))}
        </div>
        <div className="fade-up" key={t}>
          {t === 'mocoes' && <Mocoes meta={meta.data} vereadores={vers.data || []} />}
          {t === 'galeria' && <Galeria meta={meta.data} vereadores={vers.data || []} />}
          {t === 'arranjos' && <Arranjos meta={meta.data} vereadores={vers.data || []} />}
          {t === 'bandeiras' && <Bandeiras meta={meta.data} />}
        </div>
      </main>
    </>
  );
}

function Mocoes({ meta, vereadores }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const st = useApi(() => api.get('/mocoes/mocoes' + qs({ q: dq })), [dq]);
  const [form, setForm] = useState(null);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="row between">
        <input type="search" className="input" style={{ flex: 1, maxWidth: 360, minWidth: 0 }} placeholder="Buscar moção por número, assunto ou autor..." aria-label="Buscar moção" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn btn-primary" onClick={() => setForm({ tipo: 'Aplauso', vereadorId: vereadores[0] ? vereadores[0].id : '', assunto: '', data: todayIso(), sessao: '', status: 'Em Análise' })}>+ Registrar Moção</button>
      </div>
      <Async state={st} skeleton={<SkeletonRows n={5} />}>
        {(list) => (
          <div className="table-wrap" style={{ borderRadius: 12 }}>
            <table className="table" style={{ minWidth: 740 }}>
              <thead><tr><th>Nº</th><th>Assunto</th><th>Autor</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 700 }}>{m.numero}</td>
                    <td>{m.assunto}</td>
                    <td className="muted">{m.autor}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{fmtDate(m.data)}<span style={{ display: 'block', fontSize: 11, color: 'var(--accent)' }}>{m.sessao ? 'Sessão ' + fmtDate(m.sessao) : 'Sessão a definir'}</span></td>
                    <td><span className="badge" style={{ borderRadius: 999, background: ST[m.status][0], color: ST[m.status][1] }}>{m.status}</span></td>
                    <td><button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)' }} onClick={() => setForm({ ...m })}>✎ Editar</button></td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={6} className="muted" style={{ padding: '32px 18px', textAlign: 'center' }}>Nenhuma moção encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Async>
      {form && <MocaoForm meta={meta} vereadores={vereadores} initial={form} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); toast(m); st.reload(); }} />}
    </div>
  );
}

function MocaoForm({ meta, vereadores, initial, onClose, onSaved }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr(''); };
  const save = async (e) => {
    e.preventDefault();
    if (!f.assunto.trim() || !f.data) return setErr('Preencha assunto e data.');
    try {
      const body = { tipo: f.tipo, vereadorId: +f.vereadorId, assunto: f.assunto, data: f.data, sessao: f.sessao || '', status: f.status };
      const r = f.id ? await api.put('/mocoes/mocoes/' + f.id, body) : await api.post('/mocoes/mocoes', body);
      onSaved('Moção ' + r.numero + (f.id ? ' atualizada' : ' registrada'));
    } catch (x) { setErr(x.message); }
  };
  const sel = (id, label, k, opts) => <div className="field"><label htmlFor={id}>{label}</label><select id={id} className="select" value={f[k]} onChange={set(k)}>{opts}</select></div>;
  return (
    <Modal title={f.id ? 'Editar Moção ' + f.numero : 'Registrar Moção'} sub="Portaria DA 01/2026 — numeração sequencial automática" onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" form="moc-form" className="btn btn-primary">{f.id ? 'Salvar alterações' : 'Registrar moção'}</button></>}>
      <form id="moc-form" className="stack" style={{ gap: 14 }} onSubmit={save} noValidate>
        <div className="grid" style={{ '--min': '180px', gap: 12 }}>
          {sel('moc-tipo', 'Tipo de moção', 'tipo', (meta ? meta.tipos : ['Aplauso']).map((x) => <option key={x}>{x}</option>))}
          {sel('moc-autor', 'Vereador autor', 'vereadorId', vereadores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>))}
        </div>
        <div className="field"><label htmlFor="moc-ass">Assunto / Ementa</label><input id="moc-ass" className="input" value={f.assunto} onChange={set('assunto')} placeholder="Ex: Moção de Aplauso à Escola Municipal..." /></div>
        <div className="grid" style={{ '--min': '150px', gap: 12 }}>
          <div className="field"><label htmlFor="moc-data">Data de protocolo</label><input id="moc-data" type="date" className="input" value={f.data} onChange={set('data')} /></div>
          <div className="field"><label htmlFor="moc-sessao">Data da sessão</label><input id="moc-sessao" type="date" className="input" value={f.sessao} onChange={set('sessao')} /></div>
          {sel('moc-st', 'Status', 'status', (meta ? meta.status : ['Em Análise']).map((x) => <option key={x}>{x}</option>))}
        </div>
        {err && <p role="alert" style={errStyle}>{err}</p>}
      </form>
    </Modal>
  );
}

function Galeria({ meta, vereadores }) {
  const toast = useToast();
  const st = useApi(() => api.get('/mocoes/galeria'), []);
  const [sel, setSel] = useState('');
  const [nome, setNome] = useState('');
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null);
  return (
    <Async state={st} skeleton={<SkeletonRows n={4} />}>
      {(g) => {
        const vid = sel || (g.vereadores[0] ? String(g.vereadores[0].id) : '');
        const cur = g.vereadores.find((v) => String(v.id) === vid);
        const bloqueado = !!(cur && cur.cotaAtingida);
        const registrar = async () => {
          if (!nome.trim()) return setErr('Informe o nome do homenageado.');
          try { const r = await api.post('/mocoes/galeria', { vereadorId: +vid, homenageado: nome }); setNome(''); toast('Homenagem registrada — quadro ' + r.quadro); st.reload(); } catch (x) { setErr(x.message); }
        };
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 20, alignItems: 'start' }}>
            <div className="table-wrap" style={{ borderRadius: 12 }}>
              <table className="table">
                <thead><tr><th>Homenageado / Vereador Autor</th><th>Legislatura</th><th>Quadro</th><th>Ações</th></tr></thead>
                <tbody>
                  {g.items.map((h) => (
                    <tr key={h.id}>
                      <td><p style={{ fontWeight: 700 }}>{h.homenageado}</p><p className="muted-3" style={{ fontSize: 11.5, marginTop: 2 }}>Vereador: {h.vereador}</p></td>
                      <td className="muted">{h.legislatura}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{h.quadro}</td>
                      <td><button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)' }} onClick={() => setEdit({ ...h })}>✎ Editar</button></td>
                    </tr>
                  ))}
                  {!g.items.length && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 28 }}>Nenhum homenageado registrado.</td></tr>}
                </tbody>
              </table>
            </div>
            <section className="card lg">
              <h3 className="card-title" style={{ marginBottom: 4 }}>Registrar Homenagem</h3>
              <p className="muted-3" style={{ fontSize: 12, marginBottom: 16 }}>Cota: {g.cota} quadro(s) por vereador / legislatura ({g.legislatura})</p>
              <div className="stack" style={{ gap: 14 }}>
                <div className="field"><label htmlFor="gal-ver">Vereador Autor</label>
                  <select id="gal-ver" className="select" value={vid} onChange={(e) => { setSel(e.target.value); setErr(''); }}>
                    {g.vereadores.map((v) => <option key={v.id} value={v.id}>{v.nome} {v.cotaAtingida ? '(cota atingida)' : ''}</option>)}
                  </select></div>
                {bloqueado && (
                  <div role="alert" className="pulse-alert" style={{ border: '1px solid var(--crit)', borderRadius: 8, padding: 14, background: 'var(--crit-bg)' }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--crit-title)' }}>⚠ Limite de Cota Atingido</p>
                    <p style={{ fontSize: 11.5, color: 'var(--crit-strong)', marginTop: 4, lineHeight: 1.4 }}>Este vereador já possui {cur.usadas} quadro(s) oficial(is) registrado(s) na legislatura vigente (Portaria DA 03/2023). O registro está bloqueado.</p>
                  </div>
                )}
                <div className="field"><label htmlFor="gal-nome">Nome do Homenageado</label><input id="gal-nome" className="input" value={nome} disabled={bloqueado} onChange={(e) => { setNome(e.target.value); setErr(''); }} placeholder="Nome completo" /></div>
                {err && <p role="alert" style={errStyle}>{err}</p>}
                <button type="button" className="btn btn-primary" disabled={bloqueado} onClick={registrar}>Registrar Homenagem</button>
              </div>
            </section>
            {edit && <HonForm meta={meta} vereadores={vereadores} initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast('Homenageado atualizado'); st.reload(); }} />}
          </div>
        );
      }}
    </Async>
  );
}

function HonForm({ meta, vereadores, initial, onClose, onSaved }) {
  const [f, setF] = useState(initial);
  const [err, setErr] = useState('');
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr(''); };
  const save = async (e) => {
    e.preventDefault();
    if (!f.homenageado.trim() || !f.quadro.trim()) return setErr('Preencha homenageado e nº do quadro.');
    try { await api.put('/mocoes/galeria/' + f.id, { homenageado: f.homenageado, vereadorId: +f.vereadorId, legislatura: f.legislatura, quadro: f.quadro }); onSaved(); } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title="Editar Homenageado" sub="Portaria DA 03/2023 — cota por vereador/legislatura" onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" form="hon-form" className="btn btn-primary">Salvar alterações</button></>}>
      <form id="hon-form" className="stack" style={{ gap: 14 }} onSubmit={save} noValidate>
        <div className="field"><label htmlFor="hon-nome">Nome do homenageado</label><input id="hon-nome" className="input" value={f.homenageado} onChange={set('homenageado')} placeholder="Nome completo" /></div>
        <div className="field"><label htmlFor="hon-ver">Vereador autor</label><select id="hon-ver" className="select" value={f.vereadorId} onChange={set('vereadorId')}>{vereadores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}</select></div>
        <div className="grid" style={{ '--min': '180px', gap: 12 }}>
          <div className="field"><label htmlFor="hon-leg">Legislatura</label><select id="hon-leg" className="select" value={f.legislatura} onChange={set('legislatura')}>{(meta ? meta.legislaturas : [f.legislatura]).map((l) => <option key={l}>{l}</option>)}</select></div>
          <div className="field"><label htmlFor="hon-q">Nº do quadro</label><input id="hon-q" className="input" value={f.quadro} onChange={set('quadro')} placeholder="Q-000" /></div>
        </div>
        {err && <p role="alert" style={errStyle}>{err}</p>}
      </form>
    </Modal>
  );
}
