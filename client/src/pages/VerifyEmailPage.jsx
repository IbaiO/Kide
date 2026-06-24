import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import './VerifyEmailPage.css';

const POLL_INTERVAL_MS = 5000;
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutu

export default function VerifyEmailPage() {
  const { user, resendVerificationEmail, forceSignOut, deleteUnverifiedAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [resendStatus, setResendStatus] = useState('idle');
  const [cancelling, setCancelling] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const interval = setInterval(async () => {
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified && !finishedRef.current) {
          finishedRef.current = true;
          clearInterval(interval);
          await forceSignOut();
          navigate('/login', { replace: true, state: { justVerified: true, from: location.state?.from } });
        }
      } catch { }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [forceSignOut, navigate, location.state]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      await deleteUnverifiedAccount();
      navigate('/login', { replace: true, state: { sessionExpired: true, from: location.state?.from } });
    }, SESSION_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [deleteUnverifiedAccount, navigate, location.state]);

  async function handleGoToLogin() {
    finishedRef.current = true;
    await forceSignOut();
    navigate('/login', { replace: true, state: { from: location.state?.from } });
  }

  async function handleWrongEmail() {
    finishedRef.current = true;
    setCancelling(true);
    await deleteUnverifiedAccount();
    navigate('/login', { replace: true, state: { accountCancelled: true } });
  }

  async function handleResend() {
    setResendStatus('sending');
    try {
      await resendVerificationEmail();
      setResendStatus('sent');
    } catch {
      setResendStatus('error');
    }
  }

  const email = user?.email || '';

  return (
    <main className="ve-bg">
      <section className="ve-card">
        <span className="ve-logo">kide</span>

        <h1 className="ve-title">Zure kontua egiaztatu</h1>

        <p className="ve-text">
          {email
            ? <>Berrespen esteka bat bidali dugu <strong>{email}</strong> helbidera.</>
            : 'Berrespen esteka bat bidali dugu zure helbidera.'}
        </p>
        <p className="ve-text-secondary">
          Ireki mezua eta sakatu estekan kontua aktibatzeko.
        </p>

        <button className="btn-primary ve-main-btn" onClick={handleGoToLogin}>
          Saioa hasi
        </button>

        <div className="ve-secondary-actions">
          <button
            className="btn-ghost"
            onClick={handleResend}
            disabled={resendStatus === 'sending'}
          >
            {resendStatus === 'sending' ? 'Bidaltzen…' : 'Ez duzu mezua jaso? Berbidali'}
          </button>

          <button className="btn-ghost" onClick={handleWrongEmail} disabled={cancelling}>
            {cancelling ? 'Ezabatzen…' : 'Helbidea oker idatzi duzu?'}
          </button>
        </div>

        {resendStatus === 'sent' && (
          <p className="ve-success">Mezua berriro bidali da.</p>
        )}
        {resendStatus === 'error' && (
          <p className="ve-error">Ezin izan da mezua berbidali. Saiatu berriro geroago.</p>
        )}
      </section>
    </main>
  );
}