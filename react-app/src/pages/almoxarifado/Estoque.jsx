import React, { useEffect, useState } from 'react';
import { Async, Badge, Field, Modal, SkeletonRows, useToast } from '../../components/ui.jsx';
import { api, qs } from '../../lib/api.js';
import { useApi, useDebounced } from '../../lib/hooks.js';
import { fmtDate, fmtDateTime, num } from '../../lib/format.js';
import { Pages } from './Contagem.jsx';

const nf = (v) => num(v, v % 1 ? 3 : 0);
const maskCode = (v) => { const d = String(v).replace(/\D/g, '').slice(0, 10); return [d.slice(0, 1), d.slice(1, 3), d.slice(3, 5), d.slice(5, 9), d.slice(9, 10)].filter(Boolean).join(' '); };
const BADGE = { RME: ['RME · Saída', 'var(--crit-bg)', 'var(--crit)'], BRM: ['BRM · Entrada', 'var(--accent-soft)', 'var(--accent)'] };
const PR_STYLE = { Alta: ['var(--crit-bg)', 'var(--crit-strong)'], 'Média': ['var(--warn-bg)', 'var(--warn)'], Baixa: ['var(--surface-3)', 'var(--text-2)'] };

/** Aba Atualização de Estoque: leitura de RME/BRM, materiais, pendências e documentos computados. */
export default function Estoque() {
  const toast = useToast();
  const st = useApi(() => Promise.all([api.get('/almoxarifado/estoque'), api.get('/almoxarifado/estoque/arquivos-computados')]).then(([a, b]) => ({ ...a, computados: b })), []);
  const mats = useApi(() => api.get('/almoxarifado/materiais'), []);
  const [folders, setFolders] = useState({ RME: null, BRM: null });
  const [syncing, setSyncing] = useState(false);
  const [rep, setRep] = useState(null);
  const [form, setForm] = useState(null);
  const [review, setReview] = useState(false);
  const [hl, setHl] = useState([]);
  const [docsTick, setDocsTick] = useState(0);
  const reload = () => { st.refresh(); mats.refresh(); setDocsTick((t) => t + 1); };

  const pick = (tipo) => (e) => {
    const all = Array.from(e.target.files || []);
    e.target.value = '';
    if (!all.length) return;
    const pdfs = all.filter((f) => /\.pdf$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    const name = all[0].webkitRelativePath ? all[0].webkitRelativePath.split('/')[0] : 'Pasta local';
    if (!pdfs.length) { toast(`A pasta "${name}" não tem arquivos PDF.`, 'error'); return; }
    setFolders((f) => ({ ...f, [tipo]: { name, files: pdfs, total: all.length } }));
    setRep(null);
    toast(`Pasta de ${tipo}s "${name}": ${pdfs.length} PDF(s). Clique em Atualizar estoque.`);
  };
  const computados = new Set(st.data ? st.data.computados : []);
  const localFiles = ['RME', 'BRM'].flatMap((t) => (folders[t] ? folders[t].files.map((f) => ({ name: f.name, modified: new Date(f.lastModified).toISOString(), tipo: t, computado: computados.has(f.name), file: f })) : []));
  const usingLocal = !!(folders.RME || folders.BRM);
  const files = usingLocal ? localFiles : (st.data && st.data.drive.files) || [];

  const run = async () => {
    setSyncing(true); setRep(null);
    try {
      let r;
      if (usingLocal) {
        const results = { processados: [], ignorados: [], erros: [] };
        for (const t of ['RME', 'BRM']) {
          const novos = localFiles.filter((f) => f.tipo === t && !f.computado);
          for (let i = 0; i < novos.length; i += 20) {
            const fd = new FormData();
            fd.append('tipo', t);
            novos.slice(i, i + 20).forEach((f) => fd.append('files', f.file, f.name));
            const x = await api.post('/almoxarifado/estoque/upload', fd);
            ['processados', 'ignorados', 'erros'].forEach((k) => results[k].push(...x[k]));
          }
        }
        r = results;
      } else {
        r = await api.post('/almoxarifado/estoque/sync');
      }
      setRep(r);
      setHl(r.processados.flatMap((d) => d.itens.filter((i) => i.aplicado).map((i) => i.code)));
      toast(r.processados.length ? r.processados.length + ' documento(s) novo(s) computado(s)' : 'Nenhum documento novo na pasta');
      reload();
    } catch (e) { toast(e.message, 'error'); } finally { setSyncing(false); }
  };

  const d = st.data;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="card stack" style={{ gap: 16 }}>
        <div className="row between" style={{ alignItems: 'flex-start', gap: 14 }}>
          <div style={{ minWidth: 0, maxWidth: 640 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Atualização de estoque por RME e BRM</h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.5 }}>A rotina lê os PDFs de <strong>RME</strong> (saídas) e <strong>BRM</strong> (entradas), identifica os documentos ainda não computados e atualiza o saldo dos materiais pelo código cadastrado. {d && d.drive.configured ? 'As pastas do Google Drive são verificadas automaticamente; você também pode enviar uma pasta do computador.' : 'Até a integração com o Google Drive, selecione as pastas do computador.'}</p>
          </div>
          <button type="button" className="btn btn-primary" disabled={syncing || (!usingLocal && !(d && d.drive.configured))} onClick={run} style={{ fontSize: 14 }}>{syncing ? 'Atualizando…' : '↻ Atualizar estoque'}</button>
        </div>
        <Async state={st} skeleton={<SkeletonRows n={3} />}>
          {() => (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
              <div style={{ gridColumn: 'span 2', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, border: '1px solid var(--border)', borderRadius: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Pastas monitoradas · {d.drive.configured ? 'Google Drive' : 'envio do computador'}</p>
                {d.drive.error && <p className="field-error">{d.drive.error}</p>}
                <div className="row" style={{ alignItems: 'stretch' }}>
                  {[['RME', 'Saídas — RMEs', 'Requisições de material', '−', 'var(--warn)', 'var(--warn-bg)'], ['BRM', 'Entradas — BRMs', 'Boletins de recebimento', '+', 'var(--accent)', 'var(--accent-soft)']].map(([t, title, sub, sign, color, bg]) => (
                    <div key={t} style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8, padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: bg }}>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color, fontWeight: 800 }}>{sign}</span>
                        <div><p style={{ fontSize: 13, fontWeight: 700 }}>{title}</p><p style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{sub}</p></div>
                      </div>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>📁 {folders[t] ? folders[t].name : d.drive.configured ? 'Pasta do Google Drive' : 'Não selecionada'}</p>
                        <p style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{folders[t] ? `${folders[t].files.length} PDF(s) · vale até recarregar a página` : sub + (t === 'RME' ? ' (saídas)' : ' (entradas)')}</p>
                      </div>
                      <div className="row" style={{ gap: 8, marginTop: 'auto' }}>
                        <label className="btn btn-outline btn-sm" style={{ position: 'relative', overflow: 'hidden' }}>
                          Selecionar pasta
                          <input type="file" multiple accept="application/pdf,.pdf" aria-label={'Selecionar pasta de ' + t + 's'} onChange={pick(t)} ref={(el) => { if (el) { el.setAttribute('webkitdirectory', ''); el.setAttribute('directory', ''); } }} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                        </label>
                        {folders[t] && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFolders((f) => ({ ...f, [t]: null }))}>Remover</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="stack" style={{ gap: 12, minWidth: 0 }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Última atualização</p>
                  <p style={{ fontSize: 17, fontWeight: 800, marginTop: 6 }}>{fmtDateTime(d.lastSync)}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{d.docsCount} documento(s) computado(s)</p>
                </div>
                <button type="button" disabled={!d.pendentes} onClick={() => setReview(true)} aria-label="Revisar códigos não cadastrados"
                  style={{ textAlign: 'left', border: '1px solid ' + (d.pendentes ? '#F3D9A4' : 'var(--border)'), borderRadius: 8, padding: '12px 14px', background: d.pendentes ? 'var(--warn-bg)' : 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Códigos não cadastrados</span>
                  <span style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: d.pendentes ? 'var(--warn)' : 'var(--accent)' }}>{d.pendentes} item(ns)</span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Aguardando cadastro para entrar no saldo</span>
                  {d.pendentes > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--warn)', marginTop: 6 }}>Revisar e cadastrar →</span>}
                </button>
              </div>
            </div>
          )}
        </Async>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.4, paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--primary)' }}>PDFs na pasta ({files.length})</p>
          {!files.length && <p style={{ fontSize: 12.5, color: 'var(--text-2)', padding: '10px 4px' }}>{usingLocal || (d && d.drive.configured) ? 'Nenhum PDF encontrado nesta pasta.' : 'Selecione as pastas de RME e BRM para listar os PDFs.'}</p>}
          {files.map((f) => (
            <div key={f.tipo + f.name} className="row between" style={{ padding: '9px 4px', borderBottom: '1px solid var(--divider)' }}>
              <span className="row" style={{ gap: 8, fontSize: 13, minWidth: 0 }}><span aria-hidden="true">📄</span><span style={{ overflowWrap: 'anywhere' }}>{f.name}</span><span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>· {f.tipo} · {fmtDateTime(f.modified)}</span></span>
              <Badge bg={f.computado ? 'var(--surface-3)' : 'var(--info-bg)'} color={f.computado ? 'var(--text-2)' : 'var(--info)'}>{f.computado ? 'Computado' : 'Novo'}</Badge>
            </div>
          ))}
        </div>
        {syncing && (
          <div role="status" className="row" style={{ gap: 12, padding: '12px 14px', borderRadius: 8, background: 'var(--accent-soft)' }}>
            <div className="columns-loader" aria-hidden="true" style={{ padding: 0 }}><span /><span /><span /><span /></div>
            <p style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>Lendo os PDFs novos e conferindo os códigos…</p>
          </div>
        )}
        {rep && !syncing && <Relatorio rep={rep} onRegister={(it) => setForm({ code: maskCode(it.code), name: it.desc || '', unit: 'UN', category: 'Papelaria', priority: 'Baixa', stock: '0', avgConsumption: '0' })} />}
      </section>

      <Materiais st={mats} hl={hl} onNew={() => setForm({ code: '', name: '', unit: 'UN', category: 'Papelaria', priority: 'Baixa', stock: '0', avgConsumption: '0' })} />
      <Documentos tick={docsTick} />

      {form && mats.data && <MaterialForm form={form} setForm={setForm} units={mats.data.units} categories={mats.data.categories} onSaved={(r, code) => { setForm(null); setHl((h) => [...h, code]); toast(`Material ${code} cadastrado` + (r.aplicados ? ` e ${r.aplicados} movimento(s) pendente(s) aplicado(s)` : '')); reload(); }} />}
      {review && <Revisao onClose={() => setReview(false)} onDone={(m) => { setReview(false); toast(m); reload(); }} />}
    </div>
  );
}

function Relatorio({ rep, onRegister }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p style={{ fontSize: 13, fontWeight: 700 }}>{rep.processados.length ? `Resultado da atualização: ${rep.processados.length} documento(s) computado(s)` : 'Nenhum documento novo — a pasta já está em dia.'}</p>
      {rep.processados.map((d) => {
        const b = BADGE[d.tipo];
        return (
          <div key={d.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}><Badge bg={b[1]} color={b[2]}>{b[0]}</Badge><span style={{ fontSize: 14, fontWeight: 700 }}>{d.key}</span><span style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtDate(d.data)} · {d.origem || ''}{d.notaFiscal ? ' · NF ' + d.notaFiscal : ''}{d.statusDoc ? ' · status ' + d.statusDoc : ''}</span></div>
            {d.itens.map((l, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, auto) minmax(0,1fr) auto', gap: 10, alignItems: 'center', fontSize: 12.5, padding: '6px 0', borderTop: '1px solid var(--divider)' }}>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{l.code}</span>
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{l.desc || '(sem descrição no documento)'}</span>
                <span className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                  <span style={{ fontWeight: 700, color: d.tipo === 'RME' ? 'var(--crit)' : 'var(--accent)', whiteSpace: 'nowrap' }}>{(d.tipo === 'RME' ? '−' : '+') + nf(l.qtd) + ' ' + (l.unit || '')}</span>
                  {l.aplicado ? <span style={{ fontSize: 11.5, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>saldo {nf(l.antes)} → <strong style={{ color: 'var(--text)' }}>{nf(l.depois)}</strong></span>
                    : <button type="button" className="btn btn-sm" style={{ border: '1px solid #F3D9A4', background: 'var(--warn-bg)', color: 'var(--warn)', minHeight: 32 }} onClick={() => onRegister(l)}>Código não cadastrado · Cadastrar</button>}
                </span>
              </div>
            ))}
          </div>
        );
      })}
      {rep.ignorados.map((x, i) => <p key={'i' + i} style={{ fontSize: 12, color: 'var(--text-2)' }}>• {x.arquivo}: {x.motivo}</p>)}
      {rep.erros.map((x, i) => <p key={'e' + i} style={{ fontSize: 12, color: 'var(--crit)' }}>• {x.arquivo}: {x.motivo}</p>)}
    </div>
  );
}

function Materiais({ st, hl, onNew }) {
  const [q, setQ] = useState('');
  return (
    <section className="card" style={{ padding: 20 }}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Materiais em Estoque ({st.data ? st.data.items.length : 0} itens)</h2>
        <div className="row" style={{ gap: 8 }}>
          <input type="search" className="input" style={{ minWidth: 220, width: 'auto', minHeight: 40 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código ou descrição" aria-label="Buscar material" />
          <button type="button" className="btn btn-primary" style={{ minHeight: 40 }} onClick={onNew}>+ Novo item</button>
        </div>
      </div>
      <Async state={st} skeleton={<SkeletonRows n={6} />}>
        {(d) => {
          const k = q.trim().toLowerCase();
          const rows = d.items.filter((i) => !k || (i.code + ' ' + i.name).toLowerCase().includes(k));
          return (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 820, fontSize: 12 }}>
                <thead><tr><th>Código</th><th>Descrição</th><th style={{ textAlign: 'center' }}>Unid.</th><th style={{ textAlign: 'center' }}>Estoque</th><th style={{ textAlign: 'center' }}>Consumo</th><th style={{ textAlign: 'center' }}>Prioridade</th><th>Último movimento</th></tr></thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.id} style={{ background: hl.includes(i.code) ? 'var(--accent-soft)' : undefined }}>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{i.code}</td>
                      <td>{i.name}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-2)' }}>{i.unit}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{nf(i.stock)}</td>
                      <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-2)' }}>{i.avgConsumption.toFixed(2)}</td>
                      <td style={{ textAlign: 'center' }}><Badge bg={PR_STYLE[i.priority][0]} color={PR_STYLE[i.priority][1]} style={{ borderRadius: 3 }}>{i.priority}</Badge></td>
                      <td style={{ fontSize: 11.5, whiteSpace: 'nowrap', color: i.lastMove ? (i.lastMove.qtd < 0 ? 'var(--crit)' : 'var(--accent)') : 'var(--text-3)' }}>{i.lastMove ? (i.lastMove.qtd > 0 ? '+' : '') + nf(i.lastMove.qtd) + ' · ' + i.lastMove.doc : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>Nenhum material encontrado.</p>}
            </div>
          );
        }}
      </Async>
    </section>
  );
}

function Documentos({ tick }) {
  const [f, setF] = useState({ q: '', tipo: 'todos', page: 0 });
  const q = useDebounced(f.q);
  const st = useApi((signal) => api.get('/almoxarifado/estoque/documentos' + qs({ q, tipo: f.tipo === 'todos' ? '' : f.tipo, page: f.page }), { signal }), [q, f.tipo, f.page, tick]);
  useEffect(() => { setF((x) => ({ ...x, page: 0 })); }, [q]);
  const d = st.data;
  return (
    <section className="card" style={{ padding: 20 }}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Documentos computados ({d ? d.total : 0})</h2>
        <div className="row" style={{ gap: 8 }}>
          <input type="search" className="input" style={{ minWidth: 240, width: 'auto', minHeight: 40 }} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Buscar nº, setor, fornecedor, NF ou código" aria-label="Buscar documento" />
          <select className="select" style={{ width: 'auto', minHeight: 40 }} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value, page: 0 })} aria-label="Filtrar por tipo"><option value="todos">RME e BRM</option><option value="RME">Somente RME (saídas)</option><option value="BRM">Somente BRM (entradas)</option></select>
        </div>
      </div>
      <Async state={st} skeleton={<SkeletonRows n={4} />}>
        {(x) => (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 720, fontSize: 12 }}>
                <thead><tr><th>Documento</th><th>Tipo</th><th>Data</th><th>Origem / Destino</th><th style={{ textAlign: 'center' }}>Itens</th><th>Computado em</th></tr></thead>
                <tbody>
                  {x.items.map((doc) => {
                    const b = BADGE[doc.tipo];
                    return (
                      <tr key={doc.id}>
                        <td style={{ fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{doc.key}</td>
                        <td><Badge bg={b[1]} color={b[2]}>{b[0]}</Badge></td>
                        <td className="muted">{fmtDate(doc.data)}</td>
                        <td>{doc.tipo === 'RME' ? doc.origem || 'Requisição interna' : (doc.origem || 'Recebimento') + (doc.notaFiscal ? ' · NF ' + doc.notaFiscal : '')}</td>
                        <td style={{ textAlign: 'center' }}>{doc.itens.length}</td>
                        <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(doc.processadoEm)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!x.items.length && <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>Nenhum documento encontrado.</p>}
            <Pages total={x.filtered} page={x.page} pages={Math.max(1, Math.ceil(x.filtered / x.pageSize))} ps={x.pageSize} onPage={(p) => setF({ ...f, page: p })} />
          </>
        )}
      </Async>
    </section>
  );
}

function MaterialForm({ form, setForm, units, categories, onSaved }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm({ ...form, [k]: k === 'code' ? maskCode(e.target.value) : e.target.value }); setErr(''); };
  const submit = async () => {
    if (form.code.replace(/\D/g, '').length !== 10) { setErr('O código deve ter 10 dígitos, no formato 1 50 02 0018 0.'); return; }
    if (!form.name.trim()) { setErr('Informe a descrição do material.'); return; }
    setBusy(true);
    try { onSaved(await api.post('/almoxarifado/materiais', form), form.code); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title="Novo material" sub="Use o mesmo código dos documentos RME e BRM." onClose={() => setForm(null)} footer={<>
      <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>Cadastrar material</button>
    </>}>
      <div className="grid" style={{ '--min': '200px', gap: 14 }}>
        <Field label="Código do material" htmlFor="ni-code"><input id="ni-code" className="input mono" inputMode="numeric" value={form.code} onChange={set('code')} placeholder="1 50 02 0018 0" style={{ fontSize: 14 }} /></Field>
        <Field label="Unidade" htmlFor="ni-unit"><select id="ni-unit" className="select" value={form.unit} onChange={set('unit')}>{(units.includes(form.unit) ? units : [form.unit, ...units]).map((u) => <option key={u}>{u}</option>)}</select></Field>
        <Field label="Descrição" htmlFor="ni-name" style={{ gridColumn: '1 / -1' }}><input id="ni-name" className="input" value={form.name} onChange={set('name')} placeholder="PACOTE DE PAPEL A4 C/ 500 FOLHAS 75G" /></Field>
        <Field label="Categoria" htmlFor="ni-cat"><select id="ni-cat" className="select" value={form.category} onChange={set('category')}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Prioridade de contagem" htmlFor="ni-pri"><select id="ni-pri" className="select" value={form.priority} onChange={set('priority')}><option value="Alta">Alta (semanal)</option><option value="Média">Média (quinzenal)</option><option value="Baixa">Baixa (mensal)</option></select></Field>
        <Field label="Estoque inicial" htmlFor="ni-stock"><input id="ni-stock" type="number" min="0" step="1" className="input" value={form.stock} onChange={set('stock')} /></Field>
        <Field label="Consumo médio mensal" htmlFor="ni-avg"><input id="ni-avg" type="number" min="0" step="0.1" className="input" value={form.avgConsumption} onChange={set('avgConsumption')} /></Field>
      </div>
      <p className="hint">Movimentos pendentes de RME/BRM com este código serão aplicados ao saldo ao salvar.</p>
      {err && <p role="alert" className="field-error" style={{ fontSize: 12.5 }}>{err}</p>}
    </Modal>
  );
}

function Revisao({ onClose, onDone }) {
  const st = useApi(() => api.get('/almoxarifado/estoque/pendentes'), []);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (st.data && !rows) setRows(st.data.items.map((x) => ({ ...x, unit: x.unit || 'UN', category: 'Papelaria', priority: 'Baixa', avg: '0', decision: 'aceitar' })));
  }, [st.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (i, patch) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const acc = rows ? rows.filter((r) => r.decision === 'aceitar').length : 0, rej = rows ? rows.filter((r) => r.decision === 'recusar').length : 0, n = acc + rej;
  const confirm = async () => {
    const bad = rows.find((r) => r.decision === 'aceitar' && !r.desc.trim());
    if (bad) { alert('Informe a descrição de ' + bad.code); return; }
    setBusy(true);
    try {
      const x = await api.post('/almoxarifado/estoque/pendentes', { decisions: rows.filter((r) => r.decision).map((r) => ({ code: r.code, decision: r.decision, desc: r.desc, unit: r.unit, category: r.category, priority: r.priority, avg: +r.avg || 0 })) });
      onDone([x.cadastrados ? `${x.cadastrados} material(is) cadastrado(s) e ${x.aplicados} movimento(s) aplicado(s)` : '', x.recusados ? x.recusados + ' recusado(s)' : ''].filter(Boolean).join(' · ') || 'Nenhuma alteração');
    } catch (e) { alert(e.message); setBusy(false); }
  };
  return (
    <Modal wide title="Itens novos encontrados nos documentos" sub="Os dados vêm pré-preenchidos com a BRM (ou a RME, quando não houver BRM). Aceite para cadastrar o material e aplicar os movimentos ao saldo, ou recuse para não computá-los." onClose={onClose} footer={<>
      <button type="button" className="btn btn-secondary" onClick={onClose}>Decidir depois</button>
      <button type="button" className="btn btn-primary" disabled={!n || busy} onClick={confirm}>{n ? `Confirmar (${acc} cadastrar, ${rej} recusar)` : 'Selecione uma decisão'}</button>
    </>}>
      {!rows ? <SkeletonRows n={3} /> : (
        <>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setRows(rows.map((r) => ({ ...r, decision: 'aceitar' })))}>Aceitar todos</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setRows(rows.map((r) => ({ ...r, decision: 'recusar' })))}>Recusar todos</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRows(rows.map((r) => ({ ...r, decision: '' })))}>Limpar seleção</button>
            <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 'auto' }}>{acc} para cadastrar · {rej} para recusar · {rows.length - n} sem decisão</span>
          </div>
          {rows.map((r, i) => {
            const off = r.decision === 'recusar';
            return (
              <div key={r.code} style={{ border: '1px solid ' + (r.decision === 'aceitar' ? '#B8D3C4' : off ? '#F5C2C2' : 'var(--border)'), background: off ? 'var(--surface-2)' : 'var(--surface)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="row between">
                  <div className="row" style={{ gap: 8, minWidth: 0 }}>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{r.code}</span>
                    <Badge bg={r.fonte === 'BRM' ? 'var(--accent-soft)' : 'var(--crit-bg)'} color={r.fonte === 'BRM' ? 'var(--accent)' : 'var(--crit)'}>Dados de {r.fonteDoc}</Badge>
                    {r.fornecedor && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.fornecedor}</span>}
                  </div>
                  <div className="segmented" role="group" aria-label={'Decisão para ' + r.code}>
                    <button type="button" aria-pressed={r.decision === 'aceitar'} onClick={() => set(i, { decision: r.decision === 'aceitar' ? '' : 'aceitar' })}>✓ Aceitar</button>
                    <button type="button" aria-pressed={off} style={off ? { color: 'var(--crit)' } : undefined} onClick={() => set(i, { decision: off ? '' : 'recusar' })}>✕ Recusar</button>
                  </div>
                </div>
                <div className="grid" style={{ '--min': '150px', gap: 10 }}>
                  <Field label="Descrição" style={{ gridColumn: '1 / -1' }}><input className="input" value={r.desc} disabled={off} onChange={(e) => set(i, { desc: e.target.value })} /></Field>
                  <Field label="Unidade"><select className="select" value={r.unit} disabled={off} onChange={(e) => set(i, { unit: e.target.value })}>{[...new Set([r.unit, ...st.data.units])].map((u) => <option key={u}>{u}</option>)}</select></Field>
                  <Field label="Categoria"><select className="select" value={r.category} disabled={off} onChange={(e) => set(i, { category: e.target.value })}>{st.data.categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
                  <Field label="Prioridade"><select className="select" value={r.priority} disabled={off} onChange={(e) => set(i, { priority: e.target.value })}><option>Alta</option><option>Média</option><option>Baixa</option></select></Field>
                  <Field label="Consumo médio mensal"><input type="number" min="0" step="0.1" className="input" value={r.avg} disabled={off} onChange={(e) => set(i, { avg: e.target.value })} /></Field>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Movimentos:</span>
                  {r.movs.map((m, k) => <span key={k} className="badge" style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: m.tipo === 'RME' ? 'var(--crit)' : 'var(--accent)' }}>{(m.tipo === 'RME' ? '−' : '+') + nf(m.qtd) + ' ' + (m.unit || '') + ' · ' + m.doc}</span>)}
                  <span style={{ fontSize: 12, fontWeight: 700, marginLeft: 'auto', color: r.saldoPrevisto < 0 ? 'var(--crit)' : 'var(--text)' }}>Saldo inicial após aceitar: {nf(r.saldoPrevisto)} {r.unit}</span>
                </div>
              </div>
            );
          })}
        </>
      )}
    </Modal>
  );
}
