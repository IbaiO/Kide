import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './SettingsPage.css';

function validateImageFile(file) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) return 'Irudi fitxategi bat hautatu behar duzu.';
  if (file.size > 5 * 1024 * 1024) return 'Irudiak 5 MB baino txikiagoa izan behar du.';
  return null;
}

export default function SettingsPage() {
  const { profile, user, logout, reauthenticateUser, changePassword, updateProfile: updateCtxProfile } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [themeMode, setThemeMode]     = useState(profile?.themeMode || 'auto');
  const [accentColor, setAccentColor] = useState(profile?.accentColor || 'purple');
  const [saving, setSaving]           = useState(false);
  const [feedback, setFeedback]       = useState(null);

  const [photoPreview, setPhotoPreview]   = useState(profile?.photoURL || null);
  const [uploadProgress, setUploadProgress] = useState(null); // 0-100 | null
  const photoInputRef = useRef(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [newPassword2, setNewPassword2]       = useState('');
  const [pwSaving, setPwSaving]               = useState(false);
  const [pwFeedback, setPwFeedback]           = useState(null);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting]             = useState(false);
  const [showDelete, setShowDelete]         = useState(false);

  const isEmailProvider = user?.providerData?.some(p => p.providerId === 'password');

  function handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setFeedback({ type: 'error', msg: err }); return; }
    setPhotoPreview(URL.createObjectURL(file));
  }

  // Irudia Firebase Storage-ra igo eta MongoDB-n erregistratu
  async function handlePhotoUpload() {
    const file = photoInputRef.current?.files?.[0];
    if (!file) return;

    const err = validateImageFile(file);
    if (err) { setFeedback({ type: 'error', msg: err }); return; }

    setFeedback(null);
    setUploadProgress(0);

    try {
      const ext      = file.name.split('.').pop();
      const filePath = `avatars/${user.uid}/${Date.now()}.${ext}`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      const downloadURL = await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          snapshot => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress(pct);
          },
          reject,
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });

      const { data } = await api.put('/users/profile', {
        displayName: displayName.trim() || profile?.displayName,
        photoURL: downloadURL,
        themeMode,
        accentColor
      });
      
      if (updateCtxProfile) updateCtxProfile(data.user);

      setUploadProgress(null);
      setFeedback({ type: 'ok', msg: 'Argazkia eguneratu da.' });
    } catch (error) {
      console.error(error);
      setUploadProgress(null);
      setFeedback({ type: 'error', msg: 'Errorea argazkia igotzerakoan. Saiatu berriro.' });
    }
  }

  // Profila eguneratu
  async function handleSaveName(e) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const { data } = await api.put('/users/profile', { 
        displayName: displayName.trim(),
        photoURL: photoPreview,
        themeMode,
        accentColor
      });
      
      updateCtxProfile(data.user);
      setFeedback({ type: 'ok', msg: 'Profila ongi eguneratu da.' });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', msg: 'Ezin izan da profila gorde.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwFeedback(null);

    if (newPassword !== newPassword2) {
      setPwFeedback({ type: 'error', msg: 'Pasahitz berriak ez datoz bat.' });
      return;
    }
    if (newPassword.length < 6) {
      setPwFeedback({ type: 'error', msg: 'Pasahitzak gutxienez 6 karaktere behar ditu.' });
      return;
    }

    setPwSaving(true);
    try {
      await reauthenticateUser(currentPassword);
      await changePassword(newPassword);
      setPwFeedback({ type: 'ok', msg: 'Pasahitza aldatu da.' });
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
    } catch (err) {
      const isWrongPw = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential';
      setPwFeedback({
        type: 'error',
        msg: isWrongPw
          ? 'Oraingo pasahitza ez da zuzena.'
          : 'Errorea aldatzean. Egiaztatu datuak eta saiatu berriro.',
      });
    } finally {
      setPwSaving(false);
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    if (!deletePassword) return;
    setDeleting(true);
    setFeedback(null);
    try {
      await reauthenticateUser(deletePassword);
      await api.delete('/users/me');
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      const isWrongPw = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential';
      setFeedback({
        type: 'error',
        msg: isWrongPw ? 'Pasahitza ez da zuzena.' : 'Errorea kontua ezabatzean. Saiatu berriro.',
      });
      setDeleting(false);
    }
  }

  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : '?';

  return (
    <main className="sp-layout">
      <header className="sp-header">
        <button className="btn-ghost" onClick={() => navigate('/')}>‹ Atzera</button>
        <h2>Nire ezarpenak</h2>
      </header>

      {/* ── Profila: Izena, irudia, gaiak */}
      <section className="sp-section">
        <h3>Profila</h3>

        <div className="sp-avatar-wrap">
          <div className="sp-avatar-edit">
            {photoPreview ? (
              <img src={photoPreview} alt={profile?.displayName} className="sp-avatar-img" />
            ) : (
              <div className="sp-avatar-placeholder">
                {(profile?.displayName || '?')[0].toUpperCase()}
              </div>
            )}
            <button
              type="button"
              className="sp-avatar-change-btn"
              onClick={() => photoInputRef.current?.click()}
              title="Argazkia aldatu"
            >
              📷
            </button>
          </div>
          <div className="sp-avatar-info">
            <span className="sp-avatar-name">{profile?.displayName}</span>
            <span className="sp-avatar-email">{profile?.email}</span>
          </div>
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="user"
          style={{ display: 'none' }}
          onChange={handlePhotoSelected}
        />

        {photoInputRef.current?.files?.[0] && uploadProgress === null && (
          <div className="sp-photo-actions">
            <button type="button" className="btn-primary" onClick={handlePhotoUpload}>
              Argazkia gorde
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setPhotoPreview(profile?.photoURL || null);
                photoInputRef.current.value = '';
              }}
            >
              Utzi
            </button>
          </div>
        )}

        {uploadProgress !== null && (
          <div className="sp-upload-progress">
            <div className="sp-upload-bar" style={{ width: `${uploadProgress}%` }} />
            <span>{uploadProgress}%</span>
          </div>
        )}

        {feedback && !showDelete && (
          <div className={`sp-feedback sp-feedback--${feedback.type}`}>{feedback.msg}</div>
        )}

        <form onSubmit={handleSaveName} className="sp-form">
          <label>
            Izena
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Zure izena"
              required
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
            Itxura modua
            <select 
              value={themeMode} 
              onChange={e => setThemeMode(e.target.value)} 
              style={{ 
                background: 'var(--bg)', 
                color: 'var(--text-1)', 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-sm)', 
                padding: '0.5rem 0.6rem', 
                marginTop: '0.25rem',
                cursor: 'pointer'
              }}
            >
              <option value="auto">Automatikoa (Sistemarena)</option>
              <option value="light">Modu Argia</option>
              <option value="dark">Modu Iluna</option>
            </select>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.8rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-1)' }}>Azentu kolorea</span>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem' }}>
              {['purple', 'green', 'orange', 'blue', 'red', 'pink', 'cyan', 'teal', 'lime', 'yellow'].map(color => {
                const colorMap = { purple: '#7c6af7', green: '#3ecf8e', orange: '#f59e0b', blue: '#3b82f6', red: '#ef4444', pink: '#ec4899', cyan: '#06b6d4', teal: '#14b8a6', lime: '#84cc16', yellow: '#eab308' };
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccentColor(color)}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      backgroundColor: colorMap[color], 
                      border: accentColor === color ? '2px solid var(--text-1)' : '2px solid transparent',
                      cursor: 'pointer', transition: 'transform 0.1s, border-color 0.1s', 
                      transform: accentColor === color ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                    }}
                    title={color}
                  />
                );
              })}
            </div>
          </div>

          <label style={{ marginTop: '0.5rem' }}>
            Email
            <input type="email" value={profile?.email || ''} disabled className="sp-input-disabled" />
          </label>

          <div className="sp-form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Gordetzen…' : 'Gorde'}
            </button>
          </div>
        </form>
      </section>

      {/* ── Pasahitza aldatu ── */}
      {isEmailProvider && (
        <section className="sp-section">
          <h3>Pasahitza aldatu</h3>

          {pwFeedback && (
            <div className={`sp-feedback sp-feedback--${pwFeedback.type}`}>{pwFeedback.msg}</div>
          )}

          <form onSubmit={handleChangePassword} className="sp-form">
            <label>
              Oraingo pasahitza
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            <label>
              Pasahitz berria
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            <label>
              Errepikatu pasahitz berria
              <input
                type="password"
                value={newPassword2}
                onChange={e => setNewPassword2(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            <div className="sp-form-actions">
              <button type="submit" className="btn-primary" disabled={pwSaving}>
                {pwSaving ? 'Aldatzen…' : 'Aldatu'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── Kontua ezabatu ── */}
      <section className="sp-section sp-danger-zone">
        <h3>ADI!</h3>
        <p>Kontua behin betiko ezabatuko da. Ekintza hau ezin da desegin.</p>

        {feedback && showDelete && (
          <div className={`sp-feedback sp-feedback--${feedback.type}`}>{feedback.msg}</div>
        )}

        {!showDelete ? (
          <button className="btn-danger" onClick={() => setShowDelete(true)}>
            Kontua ezabatu
          </button>
        ) : (
          <form onSubmit={handleDeleteAccount} className="sp-delete-confirm">
            <p className="sp-delete-hint">
              {isEmailProvider
                ? 'Berresteko, idatzi zure uneko pasahitza kontua ezabatu aurretik:'
                : 'Ziur zaude kontua ezabatu nahi duzula?'}
            </p>
            {isEmailProvider && (
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="Zure pasahitza"
                required
              />
            )}
            <div className="sp-form-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setShowDelete(false); setDeletePassword(''); }}
              >
                Utzi
              </button>
              <button
                type="submit"
                className="btn-danger"
                disabled={deleting || (isEmailProvider && !deletePassword)}
              >
                {deleting ? 'Ezabatzen…' : 'Behin betiko ezabatu'}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}