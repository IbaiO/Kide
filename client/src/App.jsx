import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import GroupListPage from './pages/GroupListPage';
import GroupDetailPage from './pages/GroupDetailPage';
import GroupSettingsPage from './pages/GroupSettingsPage';
import { usePWA } from './hooks/usePWA';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function UpdateBanner() {
  const { needRefresh, updateSW } = usePWA();
  if (!needRefresh) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius-sm)',
      padding: '0.65rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'center',
      boxShadow: 'var(--shadow)', zIndex: 9999, fontSize: '0.88rem', fontWeight: 500,
    }}>
      <span>Bertsio berri bat dago.</span>
      <button onClick={updateSW} style={{
        background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
        borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontWeight: 600,
      }}>Eguneratu</button>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UpdateBanner />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <PrivateRoute><GroupListPage /></PrivateRoute>
          } />
          <Route path="/groups/:id" element={
            <PrivateRoute><GroupDetailPage /></PrivateRoute>
          } />
          <Route path="/groups/:id/settings" element={
            <PrivateRoute><GroupSettingsPage /></PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
