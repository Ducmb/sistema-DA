import React, { useState } from 'react';
import { Async, Badge, Empty, Field, Modal, SkeletonCards, Switch, useToast } from '../../components/ui.jsx';
import { api, qs } from '../../lib/api.js';
import { useApi, useDebounced } from '../../lib/hooks.js';
import { EMAIL_RE, fmtDate, initials, maskPhone } from '../../lib/format.js';

const maskCnpj = (v) => String(v || '').replace(/\D/g, '').slice(0, 14)
  .replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
const EV_COLOR = { success: 'var(--primary)', info: '#3B82F6', warning: '#F59E0B', critical: '#DC2626' };

/** Compras › Fornecedores (multissegmento, ativar/inativar, exportação de e-mails para cotação). */
export default function Fornecedores() {
  const toast = useToast();
  const [f, setF] = useState({ q: '', segmento: 'todos', status: 'ativos' });
  const q = useDebounced(f.q);
  const st = useApi((signal) => api.get('/compras/fornecedores' + qs({ ...f, q }), { signal }), [q, f.segmento, f.status]);
  const [form, setForm] = useState(null);
  const [hist, setHist] = useState(null);
  const [exp, setExp] = useState(false);
  const items = st.data ? st.data.items : [];
  const emails = items.filter((s) => s.active).map((s) => s.email).filter(Boolean);

  const toggle = async (s) => {
    try { await api.patch(`/compras/fornecedores/${s.id}/ativo`, { ativo: !s.active }); toast(s.name + (s.active ? ' inativado' : ' reativado')); st.refresh(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card row" style={{ padding: 16 }}>
        <input type="search" className="input" style={{ flex: 1, minWidth: 180, width: 'auto' }} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Buscar por nome ou CNPJ..." aria-label="Buscar fornecedor" />
        <select className="select" style={{ width: 'auto', minWidth: 200 }} value={f.segmento} onChange={(e) => setF({ ...f, segmento: e.target.value })} aria-label="Filtrar por segmento">
          <option value="todos">Todos os segmentos</option>{(st.data ? st.data.segments : []).map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Filtrar por situação">
          <option value="ativos">Somente ativos</option><option value="inativos">Somente inativos</option><option value="todos">Ativos e inativos</option>
        </select>
        <span className="muted" style={{ fontSize: 12 }}>{items.length} fornecedor(es)</span>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button type="button" className="btn btn-outline" disabled={!emails.length} onClick={() => setExp(true)}>📧 Exportar e-mails p/ cotação</button>
          <button type="button" className="btn btn-primary" onClick={() => setForm({ name: '', cnpj: '', contact: '', email: '', segments: f.segmento !== 'todos' ? [f.segmento] : [], segment: '', since: String(new Date().getFullYear()) })}>+ Adicionar Fornecedor</button>
        </div>
      </div>
      <Async state={st} skeleton={<SkeletonCards n={6} h={180} />}>
        {() => !items.length ? <Empty title="Nenhum fornecedor encontrado para o filtro atual." /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
            {items.map((s) => (
              <div key={s.id} className="card" style={{ padding: 16, opacity: s.active ? 1 : 0.65 }}>
                <div className="row between" style={{ marginBottom: 10 }}>
                  <Badge bg={s.active ? 'var(--accent-soft)' : 'var(--surface-3)'} color={s.active ? 'var(--accent)' : 'var(--text-2)'}>{s.active ? 'Ativo' : 'Inativo'}</Badge>
                  <Switch on={s.active} label={s.active ? 'Inativar fornecedor' : 'Reativar fornecedor'} title={s.active ? 'Inativar fornecedor' : 'Reativar fornecedor'} onChange={() => toggle(s)} />
                </div>
                <div className="row" style={{ gap: 12, marginBottom: 12, flexWrap: 'nowrap' }}>
                  <div className="avatar" style={{ width: 40, height: 40, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600 }}>{initials(s.name)}</div>
                  <div style={{ minWidth: 0 }}><p style={{ fontWeight: 600 }}>{s.name}</p><p style={{ fontSize: 11, color: 'var(--text-3)' }}>CNPJ: {s.cnpj}</p></div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  <p><strong>Contato:</strong> {s.contact || '—'}</p>
                  <p style={{ overflowWrap: 'anywhere' }}><strong>E-mail:</strong> {s.email}</p>
                  <div className="row" style={{ gap: 4 }}><strong>Segmentos:</strong>{s.segments.map((g) => <Badge key={g} bg="var(--accent-soft)" color="var(--accent)">{g}</Badge>)}</div>
                  <p><strong>Ativo desde:</strong> {s.since || '—'}</p>
                </div>
                <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'nowrap' }}>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1, color: 'var(--accent)' }} onClick={() => setForm({ ...s, segment: '' })}>✎ Editar</button>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1, color: 'var(--accent)' }} onClick={() => setHist(s.id)}>🕘 Ver Histórico</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Async>
      {form && <FornecedorForm form={form} setForm={setForm} segments={st.data ? st.data.segments : []} onSaved={(m) => { setForm(null); toast(m); st.refresh(); }} />}
      {hist && <Historico id={hist} onClose={() => setHist(null)} />}
      {exp && <ExportEmails emails={emails} filters={f} onClose={() => setExp(false)} toast={toast} />}
    </div>
  );
}

function FornecedorForm({ form, setForm, segments, onSaved }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setForm({ ...form, [k]: v }); setErr(''); };
  const allSegs = [...new Set([...segments, ...form.segments])];
  const toggleSeg = (g) => set('segments', form.segments.includes(g) ? form.segments.filter((x) => x !== g) : [...form.segments, g]);
  const save = async () => {
    const segs = [...new Set([...form.segments, form.segment.trim()].filter(Boolean))];
    if (!form.name.trim() || !segs.length) { setErr('Informe razão social e segmento.'); return; }
    if (form.cnpj.replace(/\D/g, '').length !== 14) { setErr('CNPJ deve ter 14 dígitos.'); return; }
    if (!EMAIL_RE.test(form.email)) { setErr('E-mail inválido.'); return; }
    setBusy(true);
    const body = { name: form.name, cnpj: form.cnpj, contact: form.contact, email: form.email, segments: segs, since: form.since };
    try {
      if (form.id) await api.put('/compras/fornecedores/' + form.id, body); else await api.post('/compras/fornecedores', body);
      onSaved(form.id ? 'Fornecedor atualizado' : 'Fornecedor cadastrado');
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title={form.id ? 'Editar Fornecedor' : 'Adicionar Fornecedor'} sub="Cadastro de fornecedores habilitados" onClose={() => setForm(null)} footer={<>
      <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>Salvar fornecedor</button>
    </>}>
      <Field label="Razão social" htmlFor="fo-nome"><input id="fo-nome" className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Papéis e Cia Ltda" /></Field>
      <div className="grid" style={{ '--min': '180px', gap: 12 }}>
        <Field label="CNPJ" htmlFor="fo-cnpj"><input id="fo-cnpj" className="input" inputMode="numeric" value={form.cnpj} onChange={(e) => set('cnpj', maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" /></Field>
        <Field label="Telefone" htmlFor="fo-tel"><input id="fo-tel" className="input" value={form.contact} onChange={(e) => set('contact', maskPhone(e.target.value))} placeholder="(00) 0000-0000" /></Field>
      </div>
      <Field label="E-mail para cotações" htmlFor="fo-email"><input id="fo-email" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="cotacao@fornecedor.com.br" /></Field>
      <div className="grid" style={{ '--min': '180px', gap: 12 }}>
        <div className="field">
          <span className="label">Segmentos (selecione um ou mais)</span>
          <div className="row" style={{ gap: 6 }}>{allSegs.map((g) => <button key={g} type="button" className="chip" aria-pressed={form.segments.includes(g)} onClick={() => toggleSeg(g)}>{g}</button>)}</div>
          <input className="input" value={form.segment} onChange={(e) => set('segment', e.target.value)} aria-label="Novo segmento"
            onKeyDown={(e) => { if (e.key !== 'Enter') return; e.preventDefault(); const v = form.segment.trim(); if (v) setForm({ ...form, segments: [...new Set([...form.segments, v])], segment: '' }); }}
            placeholder="Novo segmento — digite e tecle Enter" />
        </div>
        <Field label="Ativo desde (ano)" htmlFor="fo-desde"><input id="fo-desde" className="input" inputMode="numeric" maxLength={4} value={form.since} onChange={(e) => set('since', e.target.value.replace(/\D/g, ''))} placeholder="2026" /></Field>
      </div>
      {segments.length > 0 && <p className="hint">Segmentos existentes: {segments.join(' · ')}</p>}
      {err && <p role="alert" style={{ fontSize: 12.5, color: 'var(--crit-strong)', fontWeight: 600 }}>{err}</p>}
    </Modal>
  );
}

function Historico({ id, onClose }) {
  const st = useApi(() => api.get(`/compras/fornecedores/${id}/historico`), [id]);
  return (
    <Modal title="Histórico do Fornecedor" sub="Cotações, contratos e ocorrências" onClose={onClose} footer={<button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>}>
      <Async state={st}>
        {(d) => (
          <>
            <div className="row" style={{ gap: 12, paddingBottom: 12, borderBottom: '1px solid var(--divider)', flexWrap: 'nowrap' }}>
              <div className="avatar" style={{ width: 40, height: 40, background: 'var(--accent-soft)', color: 'var(--accent)' }}>{initials(d.supplier.name)}</div>
              <div><p style={{ fontSize: 14, fontWeight: 700 }}>{d.supplier.name}</p><p style={{ fontSize: 12, color: 'var(--text-2)' }}>{d.supplier.segments.join(' · ')} · CNPJ {d.supplier.cnpj}</p></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[['Cotações', d.stats.cotacoes], ['Contratos', d.stats.contratos], ['Ocorrências', d.stats.ocorrencias]].map(([l, v]) => (
                <div key={l} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}><p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{l}</p><p style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{v}</p></div>
              ))}
            </div>
            <div>
              {d.events.map((ev) => (
                <div key={ev.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--divider)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: EV_COLOR[ev.level], marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}><p style={{ fontSize: 13, fontWeight: 600 }}>{ev.title}</p><p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{ev.detail}</p></div>
                  <span style={{ fontSize: 11.5, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{fmtDate(ev.date)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Async>
    </Modal>
  );
}

function ExportEmails({ emails, filters, onClose, toast }) {
  const text = emails.join('; ');
  const copy = () => { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(emails.length + ' e-mails copiados')).catch(() => toast('Não foi possível copiar. Selecione o texto manualmente.', 'error')); };
  const mailto = () => { window.location.href = 'mailto:?bcc=' + encodeURIComponent(emails.join(';')) + '&subject=' + encodeURIComponent('Solicitação de cotação — Câmara Municipal'); };
  const csv = () => api.download('/compras/fornecedores/export.csv' + qs(filters)).catch((e) => toast(e.message, 'error'));
  return (
    <Modal title="Exportar e-mails para cotação" onClose={onClose} footer={<>
      <button type="button" className="btn btn-secondary" onClick={csv}>⬇ Baixar CSV</button>
      <button type="button" className="btn btn-secondary" onClick={mailto}>✉ Abrir no e-mail</button>
      <button type="button" className="btn btn-primary" onClick={copy}>📋 Copiar lista</button>
    </>}>
      <p style={{ fontSize: 12.5 }}>{emails.length} e-mail(s) de fornecedores <strong>ativos</strong> do segmento <strong>{filters.segmento === 'todos' ? 'Todos' : filters.segmento}</strong>, separados por ponto e vírgula — cole no campo Cco (cópia oculta) do e-mail de cotação.</p>
      <textarea className="textarea mono" readOnly rows={5} value={text} style={{ fontSize: 12.5, background: 'var(--surface-2)' }} aria-label="Lista de e-mails" onFocus={(e) => e.target.select()} />
    </Modal>
  );
}
