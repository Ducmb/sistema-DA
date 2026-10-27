import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { colors } from '../theme.js';
import L from '../lib/liccont.js';
import { toRoute } from './Dashboard.jsx';

const KEY = 'DA_notif_state';
const LV = { critical: ['#FDF3F2', '#B91C1C', 'Cr\u00edtico'], warning: ['#FDF8EC', '#92400E', 'Aten\u00e7\u00e3o'], info: ['#EEF4FD', '#1E40AF', 'Informativo'] };
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { read: [], archived: [] }; } catch (e) { return { read: [], archived: [] }; } };

export default function NotificationsModule() {
  const [st, setSt] = useState(load);
  const [tab, setTab] = useState('inbox');
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump(n => n + 1); window.addEventListener('licchange', f); return () => window.removeEventListener('licchange', f); }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }, [st]);
  const all = L.alerts();
  const inbox = all.filter(a => !st.archived.includes(a.id));
  const list = tab === 'inbox' ? inbox : tab === 'unread' ? inbox.filter(a => !st.read.includes(a.id)) : all.filter(a => st.archived.includes(a.id));
  const tabs = [['inbox', 'Caixa de Entrada', inbox.length], ['unread', 'N\u00e3o lidas', inbox.filter(a => !st.read.includes(a.id)).length], ['archived', 'Arquivadas', st.archived.filter(id => all.some(a => a.id === id)).length]];
  const btn = { height: 36, padding: '0 12px', border: '1px solid #E0E0E0', borderRadius: 8, background: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Central de Notifica\u00e7\u00f5es</h1><p style={{ fontSize: 13, color: '#666', margin: '4px 0 0' }}>Hist\u00f3rico completo dos alertas do sistema. O Painel mostra s\u00f3 os 5 mais recentes.</p></div>
        <button onClick={() => setSt(s => ({ ...s, read: [...new Set([...s.read, ...inbox.map(a => a.id)])] }))} style={btn}>Marcar todas como lidas</button>
      </div>
      <div style={{ display: 'flex', gap: 6, borderBottom: `2px solid ${colors.border}`, overflowX: 'auto' }}>
        {tabs.map(([k, l, n]) => <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', color: tab === k ? colors.green : '#999', borderBottom: tab === k ? `2px solid ${colors.green}` : '2px solid transparent', marginBottom: -2 }}>{l} \u00b7 {n}</button>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map(a => { const lv = LV[a.level] || LV.info; const read = st.read.includes(a.id); const arch = st.archived.includes(a.id); return (
          <div key={a.id} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 10, border: `1px solid ${colors.border}`, borderLeft: `4px solid ${lv[1]}`, background: read ? '#fff' : lv[0], alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: lv[1] }}>{a.category} \u00b7 {lv[2]}</span>
              <p style={{ fontSize: 14, fontWeight: 700, margin: '3px 0 0' }}>{a.title}</p>
              <p style={{ fontSize: 12, color: '#666', margin: '3px 0 0' }}>{a.description}</p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Link to={toRoute(a.href)} onClick={() => setSt(s => ({ ...s, read: [...new Set([...s.read, a.id])] }))} style={{ ...btn, display: 'inline-flex', alignItems: 'center', background: colors.green, color: '#fff', border: 'none', textDecoration: 'none' }}>Ir para a a\u00e7\u00e3o</Link>
              {!read && <button onClick={() => setSt(s => ({ ...s, read: [...s.read, a.id] }))} style={btn}>Marcar lida</button>}
              <button onClick={() => setSt(s => ({ ...s, archived: arch ? s.archived.filter(x => x !== a.id) : [...s.archived, a.id] }))} style={btn}>{arch ? 'Restaurar' : 'Arquivar'}</button>
            </div>
          </div>); })}
        {!list.length && <p style={{ padding: 30, textAlign: 'center', fontSize: 13, color: '#666', border: `1px solid ${colors.border}`, borderRadius: 8 }}>Nenhuma notifica\u00e7\u00e3o nesta aba.</p>}
      </div>
    </Layout>
  );
}
