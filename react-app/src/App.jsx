import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { homePath } from './lib/nav.js';
import Layout from './components/Layout.jsx';
import { Loader } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

const pages = {
  dashboard: lazy(() => import('./pages/Dashboard.jsx')),
  perfil: lazy(() => import('./pages/UserProfile.jsx')),
  auditoria: lazy(() => import('./pages/AuditLog.jsx')),
  configuracoes: lazy(() => import('./pages/Configuracoes.jsx')),
  rh: lazy(() => import('./pages/Pessoal.jsx')),
  compras: lazy(() => import('./pages/compras/ComprasModule.jsx')),
  almoxarifado: lazy(() => import('./pages/almoxarifado/AlmoxarifadoModule.jsx')),
  patrimonio: lazy(() => import('./pages/PatrimonioModule.jsx')),
  protocolo: lazy(() => import('./pages/ProtocoloModule.jsx')),
  mocoes: lazy(() => import('./pages/mocoes/MocoesModule.jsx')),
  legislacoes: lazy(() => import('./pages/Legislacoes.jsx')),
  analytics: lazy(() => import('./pages/AnalyticsModule.jsx')),
  notificacoes: lazy(() => import('./pages/NotificationsModule.jsx'))
};

/** Guarda de rota: exige sessão e acesso ao módulo (o servidor também valida — 403). */
function Guard({ mod, children }) {
  const { user, ready, endReason, can } = useAuth();
  const loc = useLocation();
  if (!ready) return <div style={{ padding: 60 }}><Loader /></div>;
  if (!user) return <Navigate to={'/login?motivo=' + (endReason || 'login') + '&volta=' + encodeURIComponent(loc.pathname + loc.search)} replace />;
  if (mod && !can(mod)) {
    const h = homePath(can);
    return <Navigate to={(h === loc.pathname ? '/perfil' : h) + '?negado=' + mod} replace />;
  }
  return (
    <Layout>
      <Suspense fallback={<div style={{ padding: 60 }}><Loader /></div>}>{children}</Suspense>
    </Layout>
  );
}

const ROUTES = [
  ['/painel', 'dashboard'], ['/perfil', 'perfil'], ['/auditoria', 'auditoria'], ['/configuracoes', 'configuracoes'],
  ['/pessoal', 'rh'], ['/compras', 'compras'], ['/almoxarifado', 'almoxarifado'], ['/patrimonio', 'patrimonio'],
  ['/protocolo', 'protocolo'], ['/mocoes', 'mocoes'], ['/legislacoes', 'legislacoes'], ['/analytics', 'analytics'], ['/notificacoes', 'notificacoes']
];

function Home() {
  const { user, ready, can } = useAuth();
  if (!ready) return null;
  return <Navigate to={user ? homePath(can) : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      {ROUTES.map(([path, mod]) => {
        const P = pages[mod];
        return <Route key={path} path={path} element={<Guard mod={mod}><P /></Guard>} />;
      })}
      <Route path="/dashboard" element={<Navigate to="/painel" replace />} />
      <Route path="/rh" element={<Navigate to="/pessoal" replace />} />
      <Route path="/usuarios" element={<Navigate to="/pessoal?tab=usuarios" replace />} />
      <Route path="/inventario" element={<Navigate to="/almoxarifado?view=inventario" replace />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
