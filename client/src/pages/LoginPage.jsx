import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode]           = useState('login'); // 'login' | 'register'
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [name, setName]           = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  function getRedirectTarget() {
    const from = location.state?.from;
    if (from?.pathname) {
      return from.pathname + (from.search || '');
    }
    return '/';
  }

  // GroupListPage-ra bideratu erabiltzailea dagoeneko autentifikatuta badago
  useEffect(() => {
    if (profile) {
      navigate(getRedirectTarget(), { replace: true });
    }
  }, [profile, navigate, location.state]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        navigate(getRedirectTarget());
      } else {
        await registerWithEmail(email, password, name);
        navigate('/verify-email', { replace: true, state: { from: location.state?.from } });
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    try {
      await loginWithGoogle();
      navigate(getRedirectTarget());
    } catch (err) {
      setError(friendlyError(err.code));
    }
  }

  function inputClass(fieldName) {
    return focusedField === fieldName ? 'input-focused' : '';
  }

  return (
    <main className="login-bg">
      <section className="login-card">
        <section className="login-title">
          <span className="login-logo">kide</span>
          <p className="login-tagline">Lagun artean, kontuak garbi.</p>
        </section>

        <div className="login-tabs">
          <button
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => { setMode('login'); setError(''); }}
          >Sartu</button>
          <button
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => { setMode('register'); setError(''); }}
          >Erregistratu</button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Izena"
              value={name}
              onChange={e => setName(e.target.value)}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              className={inputClass('name')}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            className={inputClass('email')}
            required
          />
          <input
            type="password"
            placeholder="Pasahitza"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            className={inputClass('password')}
            required
          />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Kargatzen…' : mode === 'login' ? 'Sartu' : 'Kontua sortu'}
          </button>
        </form>

        <div className="login-divider"><span>edo</span></div>

        <button className="btn-google" onClick={handleGoogle}>
          <GoogleIcon />
          Google-rekin sartu
        </button>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found':       'Ez da aurkitu erabiltzailerik email horrekin.',
    'auth/wrong-password':       'Pasahitz okerra.',
    'auth/email-already-in-use': 'Email horrekin lotutako kontu bat existitzen da.',
    'auth/weak-password':        'Pasahitzak gutxienez 6 karaktere behar ditu.',
    'auth/invalid-email':        'Email helbide baliogabea.',
    'auth/invalid-credential':   'Email edo pasahitza ez da zuzena.',
  };
  return map[code] || 'Errore bat gertatu da. Saiatu berriro.';
}