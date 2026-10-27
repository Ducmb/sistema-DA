import React, { useState } from 'react';
import Layout from '../components/Layout.jsx';
import { colors } from '../theme.js';
import { getSectors, addSector as addSharedSector } from '../lib/sectors.js';
import { logAudit } from '../lib/audit.js';
const loadUsers = (seed) => { try { const s = JSON.parse(localStorage.getItem('DA_users_v1')); if (Array.isArray(s) && s.length) return s; } catch (e) {} return seed; };

const SECTORS_INIT = getSectors();
const MODULES = [
  { key: 'compras', label: 'Compras' },
  { key: 'protocolo', label: 'Protocolo' },
  { key: 'rh', label: 'Gestão de Pessoal' },
  { key: 'almoxarifado', label: 'Almoxarifado' },
  { key: 'mocoes', label: 'Mo\u00e7\u00f5es & Galeria' }
];
const CARGO_STYLE = {
  'Diretoria': { bg: '#FDF0D5', color: '#92400E' },
  'Chefia': { bg: '#DCEAFE', color: '#1E40AF' },
  'Funcion\u00e1rio': { bg: '#EDEDEB', color: '#555555' }
};

const USERS_INIT = [
  { id: 1, name: 'Dr. Roberto Alencar', department: 'Diretoria Administrativa', cargo: 'Diretoria', role: 'Administrativo', initials: 'DR', access: { compras: true, protocolo: true, rh: true, almoxarifado: true, mocoes: true } },
  { id: 2, name: 'Ana Beatriz Silva', department: 'Servi\u00e7o de Almoxarifado e Patrim\u00f4nio', cargo: 'Chefia', role: 'Usu\u00e1rio', initials: 'AB', access: { compras: false, protocolo: true, rh: false, almoxarifado: true, mocoes: false } },
  { id: 3, name: 'Carlos Eduardo Costa', department: 'Servi\u00e7o de Licita\u00e7\u00f5es e Contratos', cargo: 'Funcion\u00e1rio', role: 'Usu\u00e1rio', initials: 'CE', access: { compras: false, protocolo: false, rh: true, almoxarifado: false, mocoes: true } }
];

export default function UserManagement({ embedded = false } = {}) {
  const Wrap = embedded ? React.Fragment : Layout;
  const [users, setUsers] = useState(() => loadUsers(USERS_INIT));
  React.useEffect(() => { try { localStorage.setItem('DA_users_v1', JSON.stringify(users)); const ov = {}; users.forEach(u => { ov[u.name] = { ...u.access }; }); localStorage.setItem('DA_user_access', JSON.stringify(ov)); } catch (e) {} }, [users]);
  const [sectors, setSectors] = useState(SECTORS_INIT);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [sectorsOpen, setSectorsOpen] = useState(false);
  const [newSectorName, setNewSectorName] = useState('');
  const [toast, setToast] = useState(false);
  const [auditLog, setAuditLog] = useState([
    { admin: 'Dr. Roberto Alencar', timestamp: '14/07/2026 14:32', action: 'Acesso Concedido', targetUser: 'Carlos Eduardo Costa', detail: 'M\u00f3dulo de RH' }
  ]);
  const [form, setForm] = useState({ name: '', email: '', department: SECTORS_INIT[0], cargo: 'Funcion\u00e1rio', role: 'Usu\u00e1rio' });

  const isAdmin = (role) => role === 'Administrativo';
  const pushAudit = (entry) => {
    setAuditLog(prev => [{ ...entry, admin: 'Dr. Roberto Alencar', timestamp: new Date().toLocaleString('pt-BR') }, ...prev]);
    setToast(true); setTimeout(() => setToast(false), 2000);
  };

  const toggleAccess = (userId, moduleKey) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, access: { ...u.access, [moduleKey]: !u.access[moduleKey] } } : u));
    const u = users.find(x => x.id === userId);
    const wasOn = u.access[moduleKey];
    const label = MODULES.find(m => m.key === moduleKey).label;
    pushAudit({ action: wasOn ? 'Acesso Revogado' : 'Acesso Concedido', targetUser: u.name, detail: 'M\u00f3dulo de ' + label });
    logAudit(wasOn ? 'Acesso Revogado' : 'Acesso Concedido', 'usuarios', u.name + ' \u00b7 M\u00f3dulo de ' + label, wasOn ? 'warning' : 'info');
  };

  const submitNewUser = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    const parts = form.name.trim().split(/\s+/);
    const initials = ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    const admin = form.role === 'Administrativo';
    const newUser = { id: Date.now(), name: form.name.trim(), department: form.department, cargo: form.cargo, role: form.role, initials, access: { compras: admin, protocolo: admin, rh: admin, almoxarifado: admin, mocoes: admin } };
    setUsers(prev => [...prev, newUser]);
    pushAudit({ action: 'Usu\u00e1rio Criado', targetUser: newUser.name, detail: 'Perfil: ' + form.role });
    logAudit('Usu\u00e1rio Criado', 'usuarios', newUser.name + ' \u00b7 Perfil: ' + form.role);
    setNewUserOpen(false);
    setForm({ name: '', email: '', department: sectors[0], cargo: 'Funcion\u00e1rio', role: 'Usu\u00e1rio' });
  };

  const addSector = () => {
    const updated = addSharedSector(newSectorName);
    setSectors([...updated]);
    setNewSectorName('');
  };

  const filtered = users.filter(u => {
    const term = search.trim().toLowerCase();
    const matchesTerm = !term || u.name.toLowerCase().includes(term) || u.department.toLowerCase().includes(term);
    const matchesRole = roleFilter === 'todos' || (roleFilter === 'admin' && isAdmin(u.role)) || (roleFilter === 'user' && !isAdmin(u.role));
    return matchesTerm && matchesRole;
  });

  return (
    <Wrap>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Gest\u00e3o de Usu\u00e1rios e Seguran\u00e7a</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setSectorsOpen(true)} style={{ padding: '10px 16px', backgroundColor: colors.white, color: colors.green, border: `1px solid ${colors.green}`, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>\uD83C\uDFE2 Setores</button>
          <button onClick={() => setNewUserOpen(true)} style={{ padding: '10px 16px', backgroundColor: colors.green, color: colors.white, border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Novo Servidor</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou setor..." style={{ flex: 1, minWidth: 200, padding: '10px 12px', border: '1px solid #E0E0DE', borderRadius: 8 }} />
        <div style={{ display: 'flex', gap: 6, backgroundColor: '#F4F4F2', borderRadius: 8, padding: 4 }}>
          {[['todos', 'Todos'], ['admin', 'Administrativo'], ['user', 'Usu\u00e1rio']].map(([key, label]) => (
            <button key={key} onClick={() => setRoleFilter(key)} style={{ padding: '7px 14px', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', backgroundColor: roleFilter === key ? colors.white : 'transparent', color: roleFilter === key ? colors.green : '#777' }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {filtered.map(u => (
          <div key={u.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: isAdmin(u.role) ? colors.green : '#EDEDEB', color: isAdmin(u.role) ? colors.white : '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{u.initials}</div>
                <div>
                  <p style={{ fontWeight: 700, margin: 0 }}>{u.name}</p>
                  <p style={{ fontSize: 12.5, color: colors.textMuted, margin: '2px 0 0' }}>Setor: {u.department}</p>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '5px 12px', borderRadius: 999, backgroundColor: CARGO_STYLE[u.cargo]?.bg, color: CARGO_STYLE[u.cargo]?.color }}>{u.cargo}</span>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', padding: '6px 14px', borderRadius: 999, backgroundColor: isAdmin(u.role) ? colors.green : '#EDEDEB', color: isAdmin(u.role) ? colors.white : '#555' }}>Perfil: {u.role}</span>
            </div>
            <div style={{ height: 1, backgroundColor: '#F0F0EE', margin: '18px 0' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {MODULES.map(m => {
                const on = !!u.access[m.key];
                return (
                  <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '12px 14px' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.label}</span>
                    <div onClick={() => toggleAccess(u.id, m.key)} style={{ width: 44, height: 24, borderRadius: 999, backgroundColor: on ? colors.green : '#D8D8D4', position: 'relative', cursor: 'pointer', transition: 'background-color 0.25s ease' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: colors.white, position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.25s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Auditoria de Altera\u00e7\u00f5es</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>
              <th style={{ textAlign: 'left', padding: 10 }}>Admin</th><th style={{ textAlign: 'left', padding: 10 }}>Data</th><th style={{ textAlign: 'left', padding: 10 }}>A\u00e7\u00e3o</th><th style={{ textAlign: 'left', padding: 10 }}>Usu\u00e1rio</th><th style={{ textAlign: 'left', padding: 10 }}>Detalhe</th>
            </tr></thead>
            <tbody>
              {auditLog.map((l, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F0F0EE' }}>
                  <td style={{ padding: 10 }}>{l.admin}</td><td style={{ padding: 10 }}>{l.timestamp}</td><td style={{ padding: 10 }}>{l.action}</td><td style={{ padding: 10 }}>{l.targetUser}</td><td style={{ padding: 10 }}>{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {sectorsOpen && (
        <div onClick={() => setSectorsOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: colors.white, borderRadius: 14, width: '100%', maxWidth: 440, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Gerenciar Setores</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sectors.map(s => <div key={s} style={{ padding: '10px 14px', border: `1px solid ${colors.border}`, borderRadius: 8 }}>\uD83C\uDFE2 {s}</div>)}
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newSectorName} onChange={e => setNewSectorName(e.target.value)} placeholder="Nome do novo setor" style={{ flex: 1, padding: '10px 12px', border: '1px solid #E0E0DE', borderRadius: 8 }} />
                <button onClick={addSector} style={{ padding: '10px 16px', backgroundColor: colors.green, color: colors.white, border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Adicionar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {newUserOpen && (
        <div onClick={() => setNewUserOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90 }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: colors.white, borderRadius: 14, width: '100%', maxWidth: 460, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Cadastrar Novo Servidor</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" style={{ padding: '10px 12px', border: '1px solid #E0E0DE', borderRadius: 8 }} />
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="E-mail institucional" style={{ padding: '10px 12px', border: '1px solid #E0E0DE', borderRadius: 8 }} />
              <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} style={{ padding: '10px 12px', border: '1px solid #E0E0DE', borderRadius: 8 }}>
                {sectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} style={{ padding: '10px 12px', border: '1px solid #E0E0DE', borderRadius: 8 }}>
                <option value="Diretoria">Diretoria (topo)</option>
                <option value="Chefia">Chefia</option>
                <option value="Funcion\u00e1rio">Funcion\u00e1rio</option>
              </select>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ padding: '10px 12px', border: '1px solid #E0E0DE', borderRadius: 8 }}>
                <option value="Usu\u00e1rio">Usu\u00e1rio</option>
                <option value="Administrativo">Administrativo</option>
              </select>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setNewUserOpen(false)} style={{ padding: '10px 16px', border: '1px solid #E0E0DE', borderRadius: 8, background: colors.white, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={submitNewUser} style={{ padding: '10px 16px', backgroundColor: colors.green, color: colors.white, border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Cadastrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', backgroundColor: colors.green, color: colors.white, padding: '12px 22px', borderRadius: 999, fontWeight: 600, zIndex: 100 }}>\u2713 Salvo com sucesso</div>}
    </Wrap>
  );
}
