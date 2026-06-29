import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../App';
import api from '../services/api';
import ImageEditorModal from '../components/ImageEditorModal';
import './SettingsPage.css';

function validateImageFile(file) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) return 'Irudi fitxategi bat hautatu behar duzu.';
  if (file.size > 5 * 1024 * 1024) return 'Irudiak 5 MB baino txikiagoa izan behar du.';
  return null;
}

export default function SettingsPage() {
  const { profile, user, logout, reauthenticateUser, changePassword, changeEmail, checkEmailChangeConfirmed, updateProfile: updateCtxProfile } = useAuth();
  const { previewTheme } = useTheme();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [themeMode, setThemeMode]     = useState(profile?.themeMode || 'auto');
  const [accentColor, setAccentColor] = useState(profile?.accentColor || 'purple');
  const [saving, setSaving]           = useState(false);
  const [feedback, setFeedback]       = useState(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  function handleThemeModeChange(e) {
    const mode = e.target.value;
    setThemeMode(mode);
    previewTheme(mode, accentColor);
  }

  function handleAccentColorChange(color) {
    setAccentColor(color);
    previewTheme(themeMode, color);
  }

  const [photoPreview, setPhotoPreview]   = useState(profile?.photoURL || null);
  const [uploadProgress, setUploadProgress] = useState(null); 
  const photoInputRef = useRef(null);

  const [showImageEditor, setShowImageEditor] = useState(false);
  const [pendingFile, setPendingFile]         = useState(null);
  const [editedBlob, setEditedBlob]           = useState(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [newPassword2, setNewPassword2]       = useState('');
  const [pwSaving, setPwSaving]               = useState(false);
  const [pwFeedback, setPwFeedback]           = useState(null);

  const [newEmail, setNewEmail]               = useState('');
  const [emailPassword, setEmailPassword]     = useState('');
  const [emailSaving, setEmailSaving]         = useState(false);
  const [emailFeedback, setEmailFeedback]     = useState(null);
  const [pendingEmail, setPendingEmail]       = useState(null);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting]             = useState(false);
  const [showDelete, setShowDelete]         = useState(false);

  const isEmailProvider = user?.providerData?.some(p => p.providerId === 'password');

  function handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setFeedback({ type: 'error', msg: err }); return; }
    setFeedback(null);
    setPendingFile(file);
    setShowImageEditor(true);
  }

  function handleEditorConfirm(blob) {
    setEditedBlob(blob);
    
    setPhotoPreview(prev => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    
    setShowImageEditor(false);
    setPendingFile(null);
  }

  function handleEditorCancel() {
    setShowImageEditor(false);
    setPendingFile(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  function handleCancelFinalPhoto() {
    setPhotoPreview(prev => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return profile?.photoURL || null;
    });
    setEditedBlob(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  async function uploadEditedPhoto(blob) {
    const filePath = `avatars/${user.uid}/${Date.now()}.jpg`;
    const storageRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, blob);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        snapshot => {
          if (!isMountedRef.current) return;
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(pct);
        },
        (err) => {
          if (isMountedRef.current) reject(err);
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }

  async function handlePhotoUpload() {
    if (!editedBlob) return;

    setFeedback(null);
    setUploadProgress(0);

    try {
      const downloadURL = await uploadEditedPhoto(editedBlob);

      if (!isMountedRef.current) return;

      const { data } = await api.put('/users/profile', {
        displayName: displayName.trim() || profile?.displayName,
        photoURL: downloadURL,
        themeMode,
        accentColor
      });
      
      if (!isMountedRef.current) return;
      
      if (updateCtxProfile) updateCtxProfile(data.user);

      setPhotoPreview(prev => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return downloadURL;
      });
      setUploadProgress(null);
      setEditedBlob(null);
      setFeedback({ type: 'ok', msg: 'Argazkia eguneratu da.' });
      if (photoInputRef.current) photoInputRef.current.value = '';
    } catch (error) {
      console.error(error);
      if (isMountedRef.current) {
        setUploadProgress(null);
        setFeedback({ type: 'error', msg: 'Errorea argazkia igotzerakoan. Saiatu berriro.' });
      }
    }
  }

  async function handleSaveName(e) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      let photoURL = profile?.photoURL || null;

      if (editedBlob) {
        setUploadProgress(0);
        photoURL = await uploadEditedPhoto(editedBlob);
      }

      const { data } = await api.put('/users/profile', { 
        displayName: displayName.trim(),
        photoURL,
        themeMode,
        accentColor
      });
      
      if (!isMountedRef.current) return;
      updateCtxProfile(data.user);

      if (editedBlob) {
        setPhotoPreview(prev => {
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
          return photoURL;
        });
        setEditedBlob(null);
        if (photoInputRef.current) photoInputRef.current.value = '';
      }

      setFeedback({ type: 'ok', msg: 'Profila ongi eguneratu da.' });
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) setFeedback({ type: 'error', msg: 'Ezin izan da profila gorde.' });
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
        setUploadProgress(null);
      }
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
      if (!isMountedRef.current) return;
      setPwFeedback({ type: 'ok', msg: 'Pasahitza aldatu da.' });
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
    } catch (err) {
      if (!isMountedRef.current) return;
      const isWrongPw = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential';
      setPwFeedback({
        type: 'error',
        msg: isWrongPw
          ? 'Oraingo pasahitza ez da zuzena.'
          : 'Errorea aldatzean. Egiaztatu datuak eta saiatu berriro.',
      });
    } finally {
      if (isMountedRef.current) setPwSaving(false);
    }
  }

  useEffect(() => {
    if (!pendingEmail) return;

    const interval = setInterval(async () => {
      try {
        const confirmed = await checkEmailChangeConfirmed(pendingEmail);
        if (confirmed && isMountedRef.current) {
          clearInterval(interval);
          setPendingEmail(null);
          setEmailFeedback({ type: 'ok', msg: 'Helbide elektronikoa eguneratu da.' });
        }
      } catch { }
    }, 5000);

    return () => clearInterval(interval);
  }, [pendingEmail, checkEmailChangeConfirmed]);

  async function handleChangeEmail(e) {
    e.preventDefault();
    setEmailFeedback(null);

    const trimmedEmail = newEmail.trim();
    if (!trimmedEmail || trimmedEmail.toLowerCase() === profile?.email?.toLowerCase()) {
      setEmailFeedback({ type: 'error', msg: 'Oraingo helbidea idatzi duzu, sartu beste bat.' });
      return;
    }

    setEmailSaving(true);
    try {
      await reauthenticateUser(emailPassword);
      await changeEmail(trimmedEmail);
      if (!isMountedRef.current) return;
      setPendingEmail(trimmedEmail);
      setEmailFeedback({
        type: 'ok',
        msg: `Berrespen esteka bat bidali da ${trimmedEmail} helbidera. Egiaztatu arte, oraingo helbidea (${profile?.email}) erabiliko da.`,
      });
      setEmailPassword('');
    } catch (err) {
      if (!isMountedRef.current) return;
      const isWrongPw = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential';
      const inUse = err.code === 'auth/email-already-in-use';
      let msg = 'Errorea helbidea aldatzean. Saiatu berriro.';
      if (isWrongPw) msg = 'Pasahitza ez da zuzena.';
      else if (inUse) msg = 'Helbide hori dagoeneko erabilita dago.';
      setEmailFeedback({ type: 'error', msg });
    } finally {
      if (isMountedRef.current) setEmailSaving(false);
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    if (isEmailProvider && !deletePassword) return;
    
    setDeleting(true);
    setFeedback(null);
    try {
      await reauthenticateUser(deletePassword);
      await api.delete('/users/me');
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error(err);
      if (!isMountedRef.current) return;
      const isWrongPw = err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential';
      const isPopupClosed = err.code === 'auth/popup-closed-by-user';

      let errorMsg = 'Errorea kontua ezabatzean. Saiatu berriro.';
      if (isWrongPw) {
        errorMsg = 'Pasahitza ez da zuzena.';
      } else if (isPopupClosed) {
        errorMsg = 'Identifikazio leihoa itxi duzu kontua ezabatu aurretik.';
      }

      setFeedback({
        type: 'error',
        msg: errorMsg,
      });
      setDeleting(false);
    }
  }

  return (
    <main className="sp-layout">
      <section className="top">
        <button className="btn-ghost" onClick={() => navigate(`/`)}>‹ Atzera</button>
        <h1>Nire ezarpenak</h1>
      </section>

      {/* Profila: Izena, irudia, gaiak */}
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
          style={{ display: 'none' }}
          onChange={handlePhotoSelected}
        />

        {editedBlob && uploadProgress === null && (
          <div className="sp-photo-actions">
            <button type="button" className="btn-primary" onClick={handlePhotoUpload}>
              Argazkia gorde
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleCancelFinalPhoto}
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

          <label className="sp-label-mt">
            Argitasuna
            <select
              value={themeMode}
              onChange={handleThemeModeChange}
              className="sp-select"
            >
              <option value="auto">Automatikoa (Sistemarena)</option>
              <option value="light">Modu Argia</option>
              <option value="dark">Modu Iluna</option>
            </select>
          </label>

          <div className="sp-accent-wrap">
            <span className="sp-accent-label">Azentu kolorea</span>
            <div className="sp-accent-grid">
              {['purple', 'green', 'orange', 'blue', 'red', 'pink', 'cyan', 'teal', 'lime', 'yellow'].map(color => {
                const colorMap = { purple: '#7c6af7', green: '#3ecf8e', orange: '#f59e0b', blue: '#3b82f6', red: '#ef4444', pink: '#ec4899', cyan: '#06b6d4', teal: '#14b8a6', lime: '#84cc16', yellow: '#eab308' };
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleAccentColorChange(color)}
                    className={`sp-accent-btn${accentColor === color ? ' sp-accent-btn--active' : ''}`}
                    style={{ backgroundColor: colorMap[color] }}
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

      {/* Pasahitza aldatu */}
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

      {/* Helbide elektronikoa aldatu */}
      {isEmailProvider && (
        <section className="sp-section">
          <h3>Helbide elektronikoa aldatu</h3>

          {emailFeedback && (
            <div className={`sp-feedback sp-feedback--${emailFeedback.type}`}>{emailFeedback.msg}</div>
          )}

          {pendingEmail && (
            <p className="sp-delete-hint">
              Berrespen zain: <strong>{pendingEmail}</strong>. Ez baduzu mezua jaso, sartu zure pasahitza berriro eta sakatu "Aldatu" mezua berbidaltzeko.
            </p>
          )}

          <form onSubmit={handleChangeEmail} className="sp-form">
            <label>
              Helbide elektroniko berria
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="berria@adibidea.eus"
                required
              />
            </label>
            <label>
              Pasahitza (Egiaztapena)
              <input
                type="password"
                value={emailPassword}
                onChange={e => setEmailPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            <div className="sp-form-actions">
              <button type="submit" className="btn-primary" disabled={emailSaving}>
                {emailSaving ? 'Bidaltzen…' : 'Aldatu'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Kontua ezabatu */}
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

      <ImageEditorModal
        show={showImageEditor}
        file={pendingFile}
        shape="circle"
        title="Profil argazkia egokitu"
        onConfirm={handleEditorConfirm}
        onCancel={handleEditorCancel}
      />
    </main>
  );
}