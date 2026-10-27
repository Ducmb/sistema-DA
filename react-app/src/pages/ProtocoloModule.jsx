import React, { useState } from 'react';
import Layout from '../components/Layout.jsx';
import { colors } from '../theme.js';

const TABS = [{"key":"documentos","label":"Documentos"},{"key":"processos","label":"Processos"},{"key":"prazos","label":"Prazos"}];
const ROWS = [["DOC-2201","Ofício 45/2026","Registrado"],["PROC-330","Solicitação de férias","Em Processamento"],["PROC-298","Parecer jurídico","Finalizado"]];

export default function Page() {
  const [tab, setTab] = useState(TABS[0].key);
  return (
    <Layout>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Protocolo</h1>
      <div style={{ display: 'flex', gap: 6, borderBottom: `2px solid ${colors.border}` }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: tab === t.key ? colors.green : '#999', borderBottom: tab === t.key ? `2px solid ${colors.green}` : '2px solid transparent', marginBottom: -2 }}>{t.label}</button>
        ))}
      </div>
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>
              {["Código","Descrição","Status"].map(c => <th key={c} style={{ textAlign: 'left', padding: 10, color: '#999', fontSize: 11, textTransform: 'uppercase' }}>{c}</th>)}
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
    </Layout>
  );
}
