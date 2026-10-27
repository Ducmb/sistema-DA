import React, { useState } from 'react';
import Layout from '../components/Layout.jsx';
import { colors } from '../theme.js';
import { Link } from 'react-router-dom';
import L from '../lib/liccont.js';

const ROLE_SECTIONS = {
  'Administrativo': { audit: true, capacity: true, legislative: true, alerts: true },
  'Vereador': { audit: false, capacity: false, legislative: true, alerts: true },
  'Operacional': { audit: true, capacity: true, legislative: false, alerts: true },
  'Visualizador': { audit: true, capacity: true, legislative: true, alerts: false }
};

const TOP_CARDS = [
  { label: 'Processos Conclu\u00eddos', value: '68%', sub: '142 de 209 processos no exerc\u00edcio', color: colors.green },
  { label: 'Em Andamento', value: '24%', sub: '50 processos ativos nos subsetores', color: colors.info },
  { label: 'Aguardando Assinatura', value: '8%', sub: '17 pendentes', color: colors.warning }
];

const ALERTS_INIT = [
  { id: 1, cat: 'COMPRAS', title: 'Licita\u00e7\u00e3o 12/2026 vence hoje', desc: 'Preg\u00e3o com julgamento expirando \u00e0s 18h.', level: 'critical' },
  { id: 2, cat: 'RH', title: '4 f\u00e9rias aguardando aprova\u00e7\u00e3o', desc: 'Solicita\u00e7\u00f5es paradas h\u00e1 mais de 5 dias \u00fateis.', level: 'warning' },
  { id: 3, cat: 'PROTOCOLO', title: '3 novos processos autuados', desc: 'Distribu\u00eddos aos subsetores.', level: 'info' },
  { id: 4, cat: 'ALMOXARIFADO', title: 'Estoque de toner cr\u00edtico', desc: '3 unidades \u2014 abaixo do m\u00ednimo.', level: 'critical' }
];

const AUDIT_LOG = [
  { admin: 'Dr. Roberto Alencar', timestamp: '17/07/2026 09:12', action: 'Acesso Concedido', user: 'Carlos Eduardo Costa', module: 'M\u00f3dulo de RH' },
  { admin: 'Dr. Roberto Alencar', timestamp: '16/07/2026 16:40', action: 'Usu\u00e1rio Criado', user: 'Patricia de Souza', module: 'Perfil: Usu\u00e1rio' },
  { admin: 'Dr. Roberto Alencar', timestamp: '16/07/2026 11:05', action: 'Acesso Revogado', user: 'Ana Beatriz Silva', module: 'M\u00f3dulo de Compras' }
];

const LEVEL = {
  critical: { bg: '#FDF3F2', accent: colors.critical },
  warning: { bg: '#FDF8EC', accent: '#B45309' },
  info: { bg: '#F0F6FD', accent: '#2563EB' }
};

const STAGES = [
  { name: 'Autua\u00e7\u00e3o', color: '#1C543A', h: 46 },
  { name: 'An\u00e1lise', color: '#2E6B4E', h: 64 },
  { name: 'Parecer', color: '#4E8A6C', h: 38 },
  { name: 'Arquivamento', color: '#9DBFAD', h: 26 }
];

function exportAuditCsv() {
  const rows = [['Administrador', 'Data/Hora', 'A\u00e7\u00e3o', 'Usu\u00e1rio', 'M\u00f3dulo']].concat(AUDIT_LOG.map(l => [l.admin, l.timestamp, l.action, l.user, l.module]));
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'auditoria_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

const cardStyle = { border: `1px solid ${colors.border}`, borderRadius: 12, padding: 22, backgroundColor: colors.white };

export function toRoute(href) { const [f, q] = String(href || '').split('?'); const map = { 'ComprasModule.dc.html': '/compras/controle', 'NotificationsModule.dc.html': '/notificacoes', 'MocoesHomenagens.dc.html': '/mocoes', 'ProtocoloModule.dc.html': '/protocolo' }; return (map[f] || '/dashboard') + (q ? '?' + q : ''); }

export default function Dashboard() {
  const [role, setRole] = useState('Administrativo');
  const [alerts, setAlerts] = useState(ALERTS_INIT);
  const [dismissed, setDismissed] = useState([]);
  const [, bump] = useState(0);
  React.useEffect(() => { const f = () => bump(n => n + 1); window.addEventListener('licchange', f); return () => window.removeEventListener('licchange', f); }, []);
  const live = L.alerts().filter(a => !dismissed.includes(a.id)).map(a => ({ id: a.id, cat: a.category, title: a.title, desc: a.description, level: a.level, href: a.href }));
  const allAlerts = live.concat(alerts);
  const shown = allAlerts.slice(0, 5);
  const [alertsHover, setAlertsHover] = useState(false);
  const sections = ROLE_SECTIONS[role];

  return (
    <Layout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: colors.green, textTransform: 'uppercase', margin: 0 }}>Sistema de Gest\u00e3o Integrada</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: colors.black, margin: '6px 0 0' }}>Painel Administrativo Geral</h1>
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: '9px 12px', border: '1px solid #E0E0DE', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          {Object.keys(ROLE_SECTIONS).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
        {TOP_CARDS.map(c => (
          <div key={c.label} style={cardStyle}>
            <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: colors.textMuted, textTransform: 'uppercase', margin: 0 }}>{c.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: c.color, margin: '6px 0 4px' }}>{c.value}</p>
            <p style={{ fontSize: 11.5, color: colors.textMuted, margin: 0 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {sections.audit && (
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 12px' }}>Fluxo de Processos</h3>
            <svg viewBox="0 0 400 150" style={{ width: '100%', height: 170 }}>
              <defs>
                <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.green} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={colors.green} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 0 100 Q 66 80 133 70 T 266 50 T 400 40 L 400 150 L 0 150 Z" fill="url(#ag)" />
              <polyline points="0,100 66,80 133,70 200,50 266,50 333,40 400,40" stroke={colors.green} strokeWidth="2.5" fill="none" />
            </svg>
          </div>
        )}
        {sections.capacity && (
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 12px' }}>Carga por Subsetor</h3>
            {[['Compras & Licita\u00e7\u00f5es', 32], ['Gestão de Pessoal', 21], ['Protocolo', 44]].map(([label, v]) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{label}</span><span style={{ color: colors.textMuted }}>{v} demandas</span>
                </div>
                <div style={{ height: 8, backgroundColor: '#EDEDEB', borderRadius: 999 }}>
                  <div style={{ height: 8, width: `${(v / 44) * 100}%`, backgroundColor: colors.green, borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {sections.legislative && (
          <div style={cardStyle}>
            <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 12px' }}>Timeline de Metas</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 90 }}>
              {STAGES.map(s => (
                <div key={s.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                  <div style={{ width: '100%', maxWidth: 42, height: s.h, backgroundColor: s.color, borderRadius: '4px 4px 0 0' }} />
                  <span style={{ fontSize: 10.5, color: colors.textMuted2, textAlign: 'center' }}>{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {sections.alerts && (
        <div
          onMouseEnter={() => setAlertsHover(true)} onMouseLeave={() => setAlertsHover(false)}
          style={{ ...cardStyle, opacity: alertsHover ? 1 : 0.4, transition: 'opacity 0.25s ease' }}
        >
          <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: '0 0 12px' }}>Feed de Alertas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shown.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 10, backgroundColor: LEVEL[a.level].bg, borderLeft: `3px solid ${LEVEL[a.level].accent}`, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: LEVEL[a.level].accent }}>{a.cat}</span>
                  <p style={{ fontSize: 13.5, fontWeight: 700, margin: '3px 0 0' }}>{a.href ? <Link to={toRoute(a.href)} style={{ color: 'inherit' }}>{a.title}</Link> : a.title}</p>
                  <p style={{ fontSize: 11.5, color: colors.textMuted2, margin: '3px 0 0' }}>{a.desc}</p>
                </div>
                <button aria-label="Descartar alerta" onClick={() => String(a.id).startsWith('lic-') ? setDismissed(p => [...p, a.id]) : setAlerts(prev => prev.filter(x => x.id !== a.id))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: LEVEL[a.level].accent, fontSize: 14 }}>\u2715</button>
              </div>
            ))}
            {allAlerts.length === 0 && <p style={{ fontSize: 13, color: colors.textMuted }}>Nenhum alerta ativo.</p>}
            <Link to="/notificacoes" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, border: '1px dashed #B8C7BF', borderRadius: 10, color: colors.green, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>{allAlerts.length > 5 ? 'Ver todos os ' + allAlerts.length + ' alertas na Central \u2192' : 'Abrir Central de Notifica\u00e7\u00f5es (hist\u00f3rico completo) \u2192'}</Link>
          </div>
        </div>
      )}

      {sections.audit && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: 0 }}>Auditoria de Altera\u00e7\u00f5es</h3>
            <button onClick={exportAuditCsv} style={{ padding: '8px 14px', backgroundColor: colors.green, color: colors.white, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Exportar CSV</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                {['Admin', 'Data/Hora', 'A\u00e7\u00e3o', 'Usu\u00e1rio', 'M\u00f3dulo'].map(h => <th key={h} style={{ textAlign: 'left', padding: 10, fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {AUDIT_LOG.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F0F0EE' }}>
                    <td style={{ padding: 10 }}>{l.admin}</td><td style={{ padding: 10 }}>{l.timestamp}</td><td style={{ padding: 10 }}>{l.action}</td><td style={{ padding: 10 }}>{l.user}</td><td style={{ padding: 10 }}>{l.module}</td>
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
