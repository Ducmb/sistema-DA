import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { getSession, can, wasExpired, ROUTE_MOD } from './lib/session.js';

function Guard({ children }) {
  const loc = useLocation();
  if (!getSession()) return <Navigate to={'/login?motivo=' + (wasExpired() ? 'expirada' : 'login')} replace />;
  const mod = ROUTE_MOD[loc.pathname];
  if (mod && !can(mod)) return <Navigate to={'/dashboard?negado=' + mod} replace />;
  return children;
}
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import UserProfile from './pages/UserProfile.jsx';
import MocoesHomenagens from './pages/MocoesHomenagens.jsx';
import AlmoxarifadoModule from './pages/AlmoxarifadoModule.jsx';
import PatrimonioModule from './pages/PatrimonioModule.jsx';
import ComprasModule from './pages/ComprasModule.jsx';
import ProtocoloModule from './pages/ProtocoloModule.jsx';
import RHModule from './pages/RHModule.jsx';
import NotificationsModule from './pages/NotificationsModule.jsx';
import AnalyticsModule from './pages/AnalyticsModule.jsx';
import ComprasControle from './pages/ComprasControle.jsx';
import Legislacoes from './pages/Legislacoes.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/esqueci-senha" element={<ForgotPassword />} />
      <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
      <Route path="/usuarios" element={<Navigate to="/rh?tab=usuarios" replace />} />
      <Route path="/perfil" element={<Guard><UserProfile /></Guard>} />
      <Route path="/mocoes" element={<Guard><MocoesHomenagens /></Guard>} />
      <Route path="/almoxarifado" element={<Guard><AlmoxarifadoModule /></Guard>} />
      <Route path="/patrimonio" element={<Guard><PatrimonioModule /></Guard>} />
      <Route path="/compras" element={<Guard><ComprasModule /></Guard>} />
      <Route path="/compras/controle" element={<Guard><ComprasControle /></Guard>} />
      <Route path="/protocolo" element={<Guard><ProtocoloModule /></Guard>} />
      <Route path="/rh" element={<Guard><RHModule /></Guard>} />
      <Route path="/inventario" element={<Navigate to="/almoxarifado?tab=inventario" replace />} />
      <Route path="/legislacoes" element={<Guard><Legislacoes /></Guard>} />
      <Route path="/notificacoes" element={<Guard><NotificationsModule /></Guard>} />
      <Route path="/analytics" element={<Guard><AnalyticsModule /></Guard>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
