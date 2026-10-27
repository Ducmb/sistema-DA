import React, { useState } from 'react';
import Layout from '../components/Layout.jsx';
import { colors } from '../theme.js';
import InventoryModule from './InventoryModule.jsx';
import { can } from '../lib/session.js';
import { useLocation } from 'react-router-dom';

const BASE_TABS = [{"key":"estoque","label":"Estoque"},{"key":"amostragem","label":"Amostragem"}];
const ROWS = [["Papel A4 (resma)","120 un","Normal"],["Toner HP 12A","3 un","Crítico"],["Canetas azuis","340 un","Normal"]];

export default function Page() {
  const loc = useLocation();
  const TABS = BASE_TABS.concat([{ key: 'inventario', label: 'Invent\u00e1rio Rotativo' }]);
  const initial = new URLSearchParams(loc.search).get('tab');
  const [tab, setTab] = useState(TABS.some(t => t.key === initial) ? initial : TABS[0].key);
  return (
    <Layout>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Almoxarifado</h1>
      <div style={{ display: 'flex', gap: 6, borderBottom: `2px solid ${colors.border}` }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: tab === t.key ? colors.green : '#999', borderBottom: tab === t.key ? `2px solid ${colors.green}` : '2px solid transparent', marginBottom: -2 }}>{t.label}</button>
        ))}
      </div>
      {tab === 'inventario' ? <InventoryModule embedded /> : (
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>
              {["Item","Quantidade","Status"].map(c => <th key={c} style={{ textAlign: 'left', padding: 10, color: '#999', fontSize: 11, textTransform: 'uppercase' }}>{c}</th>)}
            </tr></thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F0F0EE' }}>
                  {r.map((cell, j) => <td key={j} style={{ padding: 10 }}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </Layout>
  );
}
