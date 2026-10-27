import React, { useState } from 'react';
import Layout from '../components/Layout.jsx';
import { colors } from '../theme.js';
import UserManagement from './UserManagement.jsx';
import { can } from '../lib/session.js';
import { useLocation } from 'react-router-dom';
import { getSectors } from '../lib/sectors.js';
const SECTORS = getSectors();

const BASE_TABS = [{"key":"servidores","label":"Servidores"},{"key":"ferias","label":"Férias"}];
const ROWS = [["Ana Beatriz Silva","Serviço de Almoxarifado","Ativo"],["Carlos Eduardo Costa","Serviço de Licitações","Ativo"],["Marcos Andrade","Diretoria Administrativa","Afastado"]];

export default function Page() {
  const loc = useLocation();
  const TABS = BASE_TABS.concat(can('usuarios') ? [{ key: 'usuarios', label: 'Usu\u00e1rios & Permiss\u00f5es' }] : []);
  const initial = new URLSearchParams(loc.search).get('tab');
  const [tab, setTab] = useState(TABS.some(t => t.key === initial) ? initial : TABS[0].key);
  return (
    <Layout>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Gestão de Pessoal</h1>
      <div style={{ display: 'flex', gap: 6, borderBottom: `2px solid ${colors.border}` }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: tab === t.key ? colors.green : '#999', borderBottom: tab === t.key ? `2px solid ${colors.green}` : '2px solid transparent', marginBottom: -2 }}>{t.label}</button>
        ))}
      </div>
      {tab === 'usuarios' ? <UserManagement embedded /> : (
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>
              {["Nome","Setor","Status"].map(c => <th key={c} style={{ textAlign: 'left', padding: 10, color: '#999', fontSize: 11, textTransform: 'uppercase' }}>{c}</th>)}
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
