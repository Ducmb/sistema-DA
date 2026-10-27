import React, { useState } from 'react';
import Layout from '../components/Layout.jsx';
import { colors } from '../theme.js';
import { getSession } from '../lib/session.js';

const KEY = 'DA_legis_v1';
const TIPOS = ['Base legal', 'Decreto', 'Resolu\u00e7\u00e3o', 'Portaria', 'Recomenda\u00e7\u00e3o'];
const SEED = [
  { id: 'L1', tipo: 'Base legal', numero: 'Lei n\u00ba 14.133/2021', ementa: 'Lei de Licita\u00e7\u00f5es e Contratos Administrativos.', orgao: 'Uni\u00e3o', data: '2021-04-01', link: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm', ativa: true },
  { id: 'L2', tipo: 'Decreto', numero: 'Decreto n\u00ba 12.807/2025', ementa: 'Atualiza os limites de dispensa da Lei n\u00ba 14.133/2021 a partir de 01/01/2026.', orgao: 'Uni\u00e3o', data: '2025-12-30', link: '', ativa: true },
  { id: 'L3', tipo: 'Portaria', numero: 'Portaria DA n\u00ba 01/2026', ementa: 'Regulamenta o controle de mo\u00e7\u00f5es.', orgao: 'Diretoria Administrativa', data: '2026-01-05', link: '', ativa: true }
];
const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(s)) return s; } catch (e) {} return SEED; };

export default function Legislacoes() {
  const [items, setItems] = useState(load);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ativas');
  const [view, setView] = useState(null);
  const [form, setForm] = useState(null);
  const role = (getSession() || {}).role;
  const canEdit = role === 'Administrativo' || role === 'Operacional';
  const save = (next) => { setItems(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {} };
  const list = items.filter(n => (status === 'todas' || (status === 'ativas' ? n.ativa : !n.ativa)) && (!q || (n.numero + ' ' + n.ementa + ' ' + n.orgao + ' ' + (n.texto || '')).toLowerCase().includes(q.toLowerCase())));
  const input = { width: '100%', height: 44, padding: '0 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' };
  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Legisla\u00e7\u00f5es</h1>
        {canEdit && <button onClick={() => setForm({ tipo: 'Portaria', numero: '', ementa: '', orgao: 'Diretoria Administrativa', data: '', link: '', texto: '', ativa: true })} style={{ height: 44, padding: '0 16px', background: colors.green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>+ Nova norma</button>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por n\u00famero, ementa ou texto" style={{ ...input, flex: 1, minWidth: 220, width: 'auto' }} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...input, width: 'auto' }}><option value="ativas">Somente ativas</option><option value="inativas">Somente inativas</option><option value="todas">Todas</option></select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {list.map(n => (
          <div key={n.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: 16, opacity: n.ativa ? 1 : 0.65, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: colors.green, textTransform: 'uppercase' }}>{n.tipo}</span>
            <b style={{ fontFamily: 'Georgia, serif', fontSize: 16 }}>{n.numero}</b>
            <p style={{ fontSize: 13, color: '#444', margin: 0 }}>{n.ementa}</p>
            <p style={{ fontSize: 11.5, color: '#666', margin: 0 }}>{n.orgao} \u00b7 {n.ativa ? 'Ativa' : 'Inativa'}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
              <button onClick={() => setView(n)} style={{ height: 36, padding: '0 12px', background: colors.green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Abrir texto</button>
              {canEdit && <button onClick={() => setForm({ ...n })} style={{ height: 36, padding: '0 12px', border: '1px solid #E0E0E0', background: '#fff', borderRadius: 8, cursor: 'pointer' }}>Editar</button>}
              {canEdit && <button onClick={() => save(items.map(x => x.id === n.id ? { ...x, ativa: !x.ativa } : x))} style={{ height: 36, padding: '0 12px', border: '1px solid #E0E0E0', background: '#fff', borderRadius: 8, cursor: 'pointer' }}>{n.ativa ? 'Inativar' : 'Reativar'}</button>}
            </div>
          </div>
        ))}
      </div>
      {view && <div onClick={() => setView(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 95 }}>
        <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 12, maxWidth: 760, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: 20 }}>{view.numero}</h3>
          <p style={{ fontStyle: 'italic', color: '#444' }}>{view.ementa}</p>
          <p style={{ whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif', lineHeight: 1.7 }}>{view.texto || 'Texto ainda n\u00e3o cadastrado.'}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            {/^https?:\/\//.test(view.link || '') && <a href={view.link} target="_blank" rel="noopener noreferrer" style={{ height: 44, padding: '0 16px', display: 'inline-flex', alignItems: 'center', border: `1px solid ${colors.green}`, borderRadius: 8, color: colors.green, fontWeight: 700, textDecoration: 'none' }}>Texto original \u2197</a>}
            <button onClick={() => setView(null)} style={{ height: 44, padding: '0 16px', background: colors.green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Fechar</button>
          </div>
        </div>
      </div>}
      {form && <div onClick={() => setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 95 }}>
        <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 12, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{form.id ? 'Editar norma' : 'Nova norma'}</h3>
          <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} style={input}>{TIPOS.map(t => <option key={t}>{t}</option>)}</select>
          {[['numero', 'N\u00famero / t\u00edtulo'], ['ementa', 'Ementa'], ['orgao', '\u00d3rg\u00e3o emissor'], ['link', 'Link (https://)']].map(([k, l]) => <input key={k} placeholder={l} value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} style={input} />)}
          <input type="date" value={form.data || ''} onChange={e => setForm({ ...form, data: e.target.value })} style={input} />
          <textarea rows={6} placeholder="Texto da norma" value={form.texto || ''} onChange={e => setForm({ ...form, texto: e.target.value })} style={{ ...input, height: 'auto', padding: 12, fontFamily: 'Georgia, serif' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={() => setForm(null)} style={{ height: 44, padding: '0 16px', border: '1px solid #E0E0E0', background: '#fff', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={() => { if (!form.numero.trim() || !form.ementa.trim()) return; if (form.link && !/^https?:\/\//.test(form.link)) return; save(form.id ? items.map(x => x.id === form.id ? form : x) : [{ ...form, id: 'L' + Date.now() }, ...items]); setForm(null); }} style={{ height: 44, padding: '0 16px', background: colors.green, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Salvar</button>
          </div>
        </div>
      </div>}
    </Layout>
  );
}
