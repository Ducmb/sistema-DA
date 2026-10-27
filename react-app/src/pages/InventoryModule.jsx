import React, { useState } from 'react';
import Layout from '../components/Layout.jsx';
import { colors } from '../theme.js';

const TABS = [{"key":"amostragem","label":"Amostragem"},{"key":"consolidado","label":"Consolidado"}];
const ROWS = [["Cadeiras","45","OK"],["Monitores","30","+2"],["Impressoras","8","-1"]];

export default function Page({ embedded = false } = {}) {
  const Wrap = embedded ? React.Fragment : Layout;
  const [tab, setTab] = useState(TABS[0].key);
  return (
    <Wrap>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Inventário</h1>
      <div style={{ display: 'flex', gap: 6, borderBottom: `2px solid ${colors.border}` }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: tab === t.key ? colors.green : '#999', borderBottom: tab === t.key ? `2px solid ${colors.green}` : '2px solid transparent', marginBottom: -2 }}>{t.label}</button>
        ))}
      </div>
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>
              {["Item","Contagem","Divergência"].map(c => <th key={c} style={{ textAlign: 'left', padding: 10, color: '#999', fontSize: 11, textTransform: 'uppercase' }}>{c}</th>)}
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
    </Wrap>
  );
}
