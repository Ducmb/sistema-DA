import React, { useState } from 'react';
import Layout from '../components/Layout.jsx';
import { colors } from '../theme.js';

export default function UserProfile() {
  const original = { name: 'Dr. Roberto Alencar', matricula: 'DA-2026-948', cargo: 'Diretor Administrativo', emailInst: 'roberto.alencar@camara.gov.br' };
  const [phone, setPhone] = useState('(62) 99876-5432');
  const [personalEmail, setPersonalEmail] = useState('roberto.pessoal@gmail.com');
  const [birthday, setBirthday] = useState('1980-04-12');
  const [saved, setSaved] = useState(false);
  const [initial] = useState({ phone, personalEmail, birthday });
  const hasChanges = phone !== initial.phone || personalEmail !== initial.personalEmail || birthday !== initial.birthday;

  const readOnlyStyle = { padding: '12px 14px', border: '1px solid #E8E8E8', borderRadius: 8, backgroundColor: '#F5F5F5', color: 'rgba(29,29,27,0.6)', fontSize: 14 };
  const editStyle = { padding: '12px 14px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 14 };

  return (
    <Layout>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Meu Perfil</h1>

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Dados Funcionais</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome Completo</label><div style={readOnlyStyle}>{original.name}</div></div>
          <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Matr\u00edcula</label><div style={readOnlyStyle}>{original.matricula}</div></div>
          <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Cargo</label><div style={readOnlyStyle}>{original.cargo}</div></div>
          <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>E-mail Institucional</label><div style={readOnlyStyle}>{original.emailInst}</div></div>
        </div>
      </div>

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Dados Pessoais</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Telefone</label><input value={phone} onChange={e => setPhone(e.target.value)} style={editStyle} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>E-mail Pessoal</label><input value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} style={editStyle} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Data de Anivers\u00e1rio</label><input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} style={editStyle} /></div>
        </div>
        <button
          disabled={!hasChanges}
          onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
          style={{ marginTop: 20, padding: '12px 20px', backgroundColor: hasChanges ? colors.green : colors.disabled, color: colors.white, border: 'none', borderRadius: 8, fontWeight: 700, cursor: hasChanges ? 'pointer' : 'not-allowed' }}
        >Salvar Altera\u00e7\u00f5es</button>
        {saved && <span style={{ marginLeft: 12, color: colors.green, fontWeight: 600 }}>\u2713 Salvo</span>}
      </div>
    </Layout>
  );
}
