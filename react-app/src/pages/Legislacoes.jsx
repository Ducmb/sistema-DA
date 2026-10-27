import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout.jsx';
import { Async, Modal, Pager, SkeletonCards, Switch, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { fmtDate } from '../lib/format.js';
import { fontSerif } from '../theme.js';

const TC = { 'Base legal': ['var(--accent-soft)', 'var(--accent)'], Decreto: ['var(--info-bg)', 'var(--info-strong)'], 'Resolução': ['#F3EEFD', '#5B21B6'], Portaria: ['var(--warn-bg)', 'var(--warn-title)'], 'Recomendação': ['var(--surface-3)', 'var(--text-2)'] };
const FIELDS = [['numero', 'Número / título', 'text', 'Ex.: Portaria DA nº 02/2026'], ['ementa', 'Ementa', 'text', 'Resumo do que a norma trata'], ['orgao', 'Órgão emissor', 'text', 'Ex.: Diretoria Administrativa'], ['data', 'Data de publicação', 'date', ''], ['link', 'Link para o texto integral', 'url', 'https://'], ['tags', 'Palavras-chave (separadas por vírgula)', 'text', 'licitação, contratos']];
const MAX = 15 * 1024 * 1024;
const TypeBadge = ({ tipo }) => { const c = TC[tipo] || TC['Recomendação']; return <span className="badge" style={{ borderRadius: 999, background: c[0], color: c[1], textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 10.5 }}>{tipo}</span>; };
const isLink = (l) => /^https?:\/\//.test(l || '');

/** Legislações: base normativa com busca, filtros, ativação e PDF anexado. */
export default function Legislacoes() {
  const toast = useToast();
  const st = useApi(() => api.get('/legislacoes'), []);
  const [q, setQ] = useState('');
  const [type, setType] = useState('todos');
  const [status, setStatus] = useState(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  useEffect(() => { if (st.data && status === null) setStatus(st.data.mostrarInativas ? 'todas' : 'ativas'); }, [st.data, status]);
  useEffect(() => setPage(1), [q, type, status]);
  const toggle = async (n) => {
    try { const r = await api.patch(`/legislacoes/${n.id}/ativa`, { ativa: !n.ativa }); st.setData({ ...st.data, items: st.data.items.map((x) => (x.id === n.id ? r : x)) }); toast(r.ativa ? 'Norma reativada' : 'Norma inativada'); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <PageHeader eyebrow="Base normativa" title="Legislações" desc="Resoluções, portarias, bases legais e recomendações usadas pela Diretoria Administrativa. Itens inativos ficam guardados para consulta histórica.">
        {st.data && st.data.canEdit && <button type="button" className="btn btn-primary" onClick={() => setForm({ tipo: type !== 'todos' ? type : 'Portaria', numero: '', ementa: '', orgao: 'Diretoria Administrativa', data: '', link: '', tags: '', texto: '', ativa: true, pdfNome: '' })}>+ Nova norma</button>}
      </PageHeader>
      <main className="page">
        <Async state={st} skeleton={<SkeletonCards n={6} h={200} />}>
          {(d) => {
            const s = status || 'ativas', t = q.trim().toLowerCase();
            const byStatus = d.items.filter((n) => s === 'todas' || (s === 'ativas' ? n.ativa : !n.ativa));
            const list = byStatus.filter((n) => (type === 'todos' || n.tipo === type) && (!t || [n.numero, n.ementa, n.orgao, n.tags, n.texto].join(' ').toLowerCase().includes(t)));
            const pages = Math.max(1, Math.ceil(list.length / d.pagina)), pg = Math.min(page, pages);
            const chip = (key, label, count) => (
              <button key={key} type="button" className="chip" aria-pressed={type === key} onClick={() => setType(key)} style={{ minHeight: 38, fontWeight: 600, fontSize: 12.5, ...(type === key ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' } : {}) }}>{label} · {count}</button>
            );
            return (
              <>
                <div className="row" style={{ gap: 8 }}>{[chip('todos', 'Todas', byStatus.length)].concat(d.tipos.map((tp) => chip(tp, tp, byStatus.filter((n) => n.tipo === tp).length)))}</div>
                <div className="card row" style={{ padding: 14 }}>
                  <input type="search" className="input" style={{ flex: 1, minWidth: 220 }} placeholder="Buscar por número, ementa, órgão ou palavra-chave" aria-label="Buscar legislação" value={q} onChange={(e) => setQ(e.target.value)} />
                  <select className="select" style={{ width: 'auto' }} aria-label="Situação" value={s} onChange={(e) => setStatus(e.target.value)}>
                    <option value="ativas">Somente ativas</option><option value="inativas">Somente inativas</option><option value="todas">Ativas e inativas</option>
                  </select>
                  <span className="muted" style={{ fontSize: 12 }}>{list.length} norma(s)</span>
                </div>
                <div className="grid" style={{ '--min': '320px', gap: 12 }}>
                  {list.slice((pg - 1) * d.pagina, pg * d.pagina).map((n) => (
                    <div key={n.id} className="card stack" style={{ padding: 16, gap: 8, opacity: n.ativa ? 1 : 0.65 }}>
                      <div className="row between">
                        <TypeBadge tipo={n.tipo} />
                        {d.canEdit && <Switch on={n.ativa} label={n.ativa ? 'Inativar norma' : 'Reativar norma'} title={n.ativa ? 'Inativar norma' : 'Reativar norma'} onChange={() => toggle(n)} />}
                      </div>
                      <p style={{ fontFamily: fontSerif, fontSize: 16, fontWeight: 700 }}>{n.numero}</p>
                      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>{n.ementa}</p>
                      <p className="muted" style={{ fontSize: 11.5 }}>{n.orgao || '—'} · {fmtDate(n.data)} · {n.ativa ? 'Ativa' : 'Inativa'}</p>
                      <div className="row" style={{ gap: 4 }}>
                        {n.pdfNome && <span className="badge" style={{ borderRadius: 999, background: 'var(--crit-bg)', color: 'var(--crit-strong)' }}>PDF anexado</span>}
                        {n.tags.split(',').map((x) => x.trim()).filter(Boolean).map((tg) => <span key={tg} className="badge" style={{ borderRadius: 999, background: 'var(--surface-3)', color: 'var(--text-2)', fontWeight: 500 }}>{tg}</span>)}
                      </div>
                      <div className="row" style={{ gap: 8, marginTop: 'auto', paddingTop: 6 }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setView(n)}>Abrir texto</button>
                        {d.canEdit && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...n })}>✎ Editar</button>}
                      </div>
                    </div>
                  ))}
                </div>
                {!list.length && <p className="card muted" style={{ padding: 30, textAlign: 'center', fontSize: 13 }}>Nenhuma norma com esses filtros.</p>}
                <Pager page={pg} pages={pages} onChange={setPage} />
                {form && <NormaForm tipos={d.tipos} initial={form} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); toast(m); st.reload(); }} />}
              </>
            );
          }}
        </Async>
      </main>
      {view && <NormaView n={view} onClose={() => setView(null)} />}
    </>
  );
}

function NormaView({ n, onClose }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(!!n.pdfNome);
  const [fail, setFail] = useState(false);
  useEffect(() => {
    if (!n.pdfNome) return undefined;
    let u = '', alive = true;
    api.blobUrl(`/legislacoes/${n.id}/pdf`).then((x) => { u = x; if (alive) setUrl(x); else URL.revokeObjectURL(x); }).catch(() => alive && setFail(true)).finally(() => alive && setLoading(false));
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [n]);
  const showPdf = n.pdfNome && !fail;
  return (
    <Modal wide title={n.numero} sub={<><TypeBadge tipo={n.tipo} /> <span style={{ marginLeft: 6 }}>{n.orgao || '—'} · {fmtDate(n.data)} · {n.ativa ? 'Ativa' : 'Inativa'}</span></>} onClose={onClose}
      footer={<>
        {url && <a className="btn btn-secondary" href={url} download={n.pdfNome}>Baixar PDF</a>}
        {isLink(n.link) && <a className="btn btn-secondary" style={{ color: 'var(--accent)', borderColor: 'var(--primary)' }} href={n.link} target="_blank" rel="noopener noreferrer">Texto original ↗</a>}
        <button type="button" className="btn btn-primary" onClick={onClose}>Fechar</button>
      </>}>
      {showPdf ? (
        <div style={{ background: 'var(--surface-2)', margin: -4 }}>
          {loading && <p className="muted" style={{ padding: 40, textAlign: 'center', fontSize: 13 }}>Carregando PDF…</p>}
          {url && <iframe src={url} title={n.pdfNome} style={{ width: '100%', height: '68vh', border: 'none', display: 'block' }} />}
        </div>
      ) : (
        <div style={{ fontFamily: fontSerif }}>
          <p style={{ fontSize: 15, fontStyle: 'italic', lineHeight: 1.6, color: 'var(--text-2)', marginBottom: 18 }}>{n.ementa}</p>
          {n.texto.trim()
            ? <p style={{ fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{n.texto}</p>
            : <p className="muted" style={{ fontFamily: 'inherit', fontSize: 13, background: 'var(--surface-2)', borderRadius: 8, padding: 14 }}>{fail ? 'Não foi possível carregar o PDF. ' : 'Nenhum PDF anexado a esta norma. '}Use "Editar" para anexar o PDF ou colar o texto, ou abra o texto original.</p>}
        </div>
      )}
    </Modal>
  );
}

function NormaForm({ tipos, initial, onClose, onSaved }) {
  const [f, setF] = useState(initial);
  const [pdf, setPdf] = useState(null); // { file } ou { remove: true }
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr(''); };
  const pick = (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return setErr('Selecione um arquivo PDF.');
    if (file.size > MAX) return setErr('O PDF deve ter no máximo 15 MB.');
    setPdf({ file }); setErr('');
  };
  const save = async (e) => {
    e.preventDefault();
    if (!f.numero.trim() || !f.ementa.trim()) return setErr('Informe o número/título e a ementa.');
    if (f.link && !isLink(f.link)) return setErr('O link deve começar com http:// ou https://');
    const fd = new FormData();
    ['tipo', 'numero', 'ementa', 'orgao', 'data', 'link', 'tags', 'texto'].forEach((k) => fd.append(k, f[k] || ''));
    fd.append('ativa', String(f.ativa));
    if (pdf && pdf.file) fd.append('pdf', pdf.file);
    if (pdf && pdf.remove) fd.append('removerPdf', 'true');
    setBusy(true);
    try { if (f.id) await api.put('/legislacoes/' + f.id, fd); else await api.post('/legislacoes', fd); onSaved(f.id ? 'Norma atualizada' : 'Norma cadastrada'); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const hasPdf = pdf ? !!pdf.file : !!f.pdfNome;
  const pdfLabel = pdf ? (pdf.file ? pdf.file.name + ' (' + Math.round(pdf.file.size / 1024) + ' KB)' : 'PDF será removido ao salvar') : f.pdfNome || 'Nenhum arquivo anexado';
  return (
    <Modal title={f.id ? 'Editar norma' : 'Nova norma'} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" form="norma-form" className="btn btn-primary" disabled={busy}>Salvar</button></>}>
      <form id="norma-form" className="stack" style={{ gap: 12 }} onSubmit={save} noValidate>
        <div className="field"><label htmlFor="n-tipo">Tipo</label><select id="n-tipo" className="select" value={f.tipo} onChange={set('tipo')}>{tipos.map((t) => <option key={t}>{t}</option>)}</select></div>
        {FIELDS.map(([k, label, type, ph]) => <div key={k} className="field"><label htmlFor={'n-' + k}>{label}</label><input id={'n-' + k} type={type} className="input" value={f[k] || ''} placeholder={ph} onChange={set(k)} /></div>)}
        <div className="field">
          <span style={{ fontSize: 12, fontWeight: 600 }}>PDF da norma</span>
          <div className="row" style={{ gap: 8, border: '1px dashed var(--border-input)', borderRadius: 8, padding: 12 }}>
            <label className="btn btn-secondary btn-sm" style={{ color: 'var(--accent)', borderColor: 'var(--primary)', cursor: 'pointer' }}>{hasPdf ? 'Trocar PDF' : 'Anexar PDF'}<input type="file" accept="application/pdf" onChange={pick} style={{ display: 'none' }} /></label>
            <span style={{ fontSize: 12.5, color: 'var(--text-2)', minWidth: 0, overflowWrap: 'anywhere' }}>{pdfLabel}</span>
            {hasPdf && <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--crit-strong)', marginLeft: 'auto' }} onClick={() => setPdf(f.pdfNome ? { remove: true } : null)}>Remover PDF</button>}
          </div>
          <span className="hint">Somente PDF, até 15 MB. O arquivo é exibido no modal "Abrir texto".</span>
        </div>
        <div className="field"><label htmlFor="n-texto">Texto da norma (opcional, usado quando não houver PDF)</label><textarea id="n-texto" className="input" rows={8} value={f.texto} onChange={set('texto')} placeholder="Cole aqui o texto integral ou os artigos principais" style={{ fontFamily: fontSerif, lineHeight: 1.55, resize: 'vertical', padding: '10px 12px', height: 'auto' }} /></div>
        {err && <p role="alert" style={{ fontSize: 12.5, color: 'var(--crit-strong)' }}>{err}</p>}
      </form>
    </Modal>
  );
}
