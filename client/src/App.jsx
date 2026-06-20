import React, { useEffect, createContext, useContext, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import GroupListPage from './pages/GroupListPage';
import GroupDetailPage from './pages/GroupDetailPage';
import GroupSettingsPage from './pages/GroupSettingsPage';
import SettingsPage from './pages/SettingsPage';
import { usePWA } from './hooks/usePWA';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const ThemeContext = createContext(null);
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeManager');
  return ctx;
}

function GlobalHeader() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!profile || location.pathname === '/login') return null;

  return (
    <header className="mn-header">
      <section className="mn-header-container">
        <span className="mn-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>kide</span>
        <section className="mn-header-actions">
          <button className="mn-avatar-btn" onClick={() => navigate('/settings')} aria-label="Ezarpenak">
            {profile.photoURL ? (
              <img src={profile.photoURL} alt="Profila" className="mn-avatar-img" />
            ) : (
              <span className="mn-avatar-initials">
                {profile.displayName ? profile.displayName[0].toUpperCase() : '?'}
              </span>
            )}
          </button>
          <button className="btn-ghost" onClick={logout} style={{ fontSize: '0.85rem' }}>Irten</button>
        </section>
      </section>
    </header>
  );
}

function applyTheme(mode, accent) {
  const root = document.documentElement;
  root.setAttribute('data-accent', accent);

  if (mode === 'auto') {
    const systemMode = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    root.setAttribute('data-theme', systemMode);
    root.setAttribute('data-bs-theme', systemMode);
  } else {
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-bs-theme', mode);
  }
}

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

function ThemeManager({ children }) {
  const { profile } = useAuth();

  const previewTheme = useCallback((mode, accent) => {
    applyTheme(mode, accent);
  }, []);

  useEffect(() => {
    const mode   = profile?.themeMode   || 'auto';
    const accent = profile?.accentColor || 'purple';

    applyTheme(mode, accent);

    if (mode === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const listener = (e) => {
        applyTheme('auto', accent);
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [profile?.themeMode, profile?.accentColor]);

  return (
    <ThemeContext.Provider value={{ previewTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeManager>
          <UpdateBanner />

          <GlobalHeader />

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
            <Route path="/settings" element={
              <PrivateRoute><SettingsPage /></PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ThemeManager>
      </AuthProvider>
    </BrowserRouter>
  );
}