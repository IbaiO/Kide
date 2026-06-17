import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './GroupSettingsPage.css';

function validateImageFile(file) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) return 'Irudi fitxategi bat hautatu behar duzu.';
  if (file.size > 5 * 1024 * 1024) return 'Irudiak 5 MB baino txikiagoa izan behar du.';
  return null;
}

export default function GroupSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [group, setGroup]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [feedback, setFeedback] = useState('');

  const [photoPreview, setPhotoPreview]     = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const photoInputRef = useRef(null);

  useEffect(() => {
    api.get(`/groups/${id}`)
      .then(r => {
        setGroup(r.data);
        setName(r.data.name);
        setDesc(r.data.description || '');
        setPhotoPreview(r.data.photoURL || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  function handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setFeedback(err); return; }
    setPhotoPreview(URL.createObjectURL(file));
    setFeedback('');
  }

  async function handlePhotoUpload() {
    const file = photoInputRef.current?.files?.[0];
    if (!file) return;

    const err = validateImageFile(file);
    if (err) { setFeedback(err); return; }

    setFeedback('');
    setUploadProgress(0);

    try {
      const ext        = file.name.split('.').pop();
      const filePath   = `groups/${id}/${Date.now()}.${ext}`;
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

      const { data } = await api.put(`/groups/${id}`, {
        name: group.name,
        description: group.description,
        photoURL: downloadURL,
      });
      setGroup(prev => ({ ...prev, photoURL: data.photoURL }));
      setUploadProgress(null);
      setFeedback('Argazkia eguneratu da.');
      setTimeout(() => setFeedback(''), 2500);
      photoInputRef.current.value = '';
    } catch {
      setUploadProgress(null);
      setFeedback('Errorea argazkia igotzerakoan. Saiatu berriro.');
    }
  }

  async function saveGroup(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put(`/groups/${id}`, { name, description: desc });
      setGroup(prev => ({ ...prev, ...data }));
      setFeedback('Aldaketak gordeta.');
      setTimeout(() => setFeedback(''), 2500);
    } catch {
      setFeedback('Errore bat gertatu da.');
    } finally {
      setSaving(false);
    }
  }

  async function addMember(e) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAddingMember(true);
    try {
      await api.post(`/groups/${id}/members`, { email: newEmail });
      const { data } = await api.get(`/groups/${id}`);
      setGroup(data);
      setNewEmail('');
      setFeedback('Kidea gehitu da.');
      setTimeout(() => setFeedback(''), 2500);
    } catch (err) {
      setFeedback(err.response?.data?.error || 'Ezin izan da kidea gehitu.');
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setAddingMember(false);
    }
  }

  async function removeMember(userId) {
    if (!confirm('Kidea taldeetik kendu nahi duzu?')) return;
    try {
      await api.delete(`/groups/${id}/members/${userId}`);
      setGroup(prev => ({
        ...prev,
        members: prev.members.filter(m => m._id !== userId),
      }));
    } catch (err) {
      setFeedback(err.response?.data?.error || 'Errore bat gertatu da.');
      setTimeout(() => setFeedback(''), 3000);
    }
  }

  async function deleteGroup() {
    if (!confirm(`"${group.name}" taldea betiko ezabatu nahi duzu? Gasto guztiak galduko dira.`)) return;
    try {
      await api.delete(`/groups/${id}`);
      navigate('/');
    } catch {
      setFeedback('Ezin izan da taldea ezabatu.');
    }
  }

  const isCreator = profile?.id === group?.createdBy?._id || profile?.id === group?.createdBy;

  if (loading) return <div className="gs-loading">Kargatzen…</div>;
  if (!group)  return <div className="gs-loading">Taldea ez da aurkitu.</div>;

  return (
    <main className="gs-layout">
      <header className="gs-header">
        <button className="btn-ghost" onClick={() => navigate(`/groups/${id}`)}>‹ Atzera</button>
        <h2>Ezarpenak</h2>
      </header>

      {feedback && <div className="gs-feedback">{feedback}</div>}

      {isCreator && (
        <section className="gs-section" aria-label="Taldearen argazkia">
          <h3>Taldearen argazkia</h3>

          <div className="gs-photo-wrap">
            {/* Avatar actual o placeholder con inicial */}
            {photoPreview ? (
              <img src={photoPreview} alt={group.name} className="gs-group-photo" />
            ) : (
              <div className="gs-group-photo-placeholder">
                {group.name[0].toUpperCase()}
              </div>
            )}

            <div className="gs-photo-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => photoInputRef.current?.click()}
              >
                Argazkia aukeratu
              </button>
              {/* input bat capture="environment" erabiliz, mobilen kamera detektatzeko */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handlePhotoSelected}
              />
            </div>
          </div>

          {photoInputRef.current?.files?.[0] && uploadProgress === null && (
            <div className="gs-photo-confirm">
              <button type="button" className="btn-primary" onClick={handlePhotoUpload}>
                Argazkia gorde
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setPhotoPreview(group.photoURL || null);
                  photoInputRef.current.value = '';
                }}
              >
                Utzi
              </button>
            </div>
          )}

          {uploadProgress !== null && (
            <div className="gs-upload-progress">
              <div className="gs-upload-bar" style={{ width: `${uploadProgress}%` }} />
              <span>{uploadProgress}%</span>
            </div>
          )}
        </section>
      )}

      {isCreator && (
        <section className="gs-section" aria-label="Taldearen datuak editatu">
          <h3>Taldearen datuak</h3>
          <form onSubmit={saveGroup}>
            <label>Izena
              <input value={name} onChange={e => setName(e.target.value)} required />
            </label>
            <label>Deskribapena
              <input value={desc} onChange={e => setDesc(e.target.value)} />
            </label>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Gordetzen…' : 'Gorde'}
            </button>
          </form>
        </section>
      )}

      <section className="gs-section" aria-label="Kideen kudeaketa">
        <h3>Kideak ({group.members?.length})</h3>
        <ul className="gs-members">
          {group.members?.map(m => (
            <li key={m._id} className="gs-member">
              {m.photoURL ? (
                <img src={m.photoURL} alt={m.displayName} className="gs-member-avatar gs-member-avatar--photo" />
              ) : (
                <div className="gs-member-avatar">{m.displayName?.[0]?.toUpperCase()}</div>
              )}
              <div className="gs-member-info">
                <span className="gs-member-name">{m.displayName}</span>
                <span className="gs-member-email">{m.email}</span>
              </div>
              {isCreator && m._id !== profile?.id && (
                <button className="btn-icon danger" onClick={() => removeMember(m._id)}>✕</button>
              )}
            </li>
          ))}
        </ul>

        <form className="gs-add-member" onSubmit={addMember}>
          <input
            type="email"
            placeholder="Email bidez kide berria gehitu"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={addingMember}>
            {addingMember ? '…' : 'Gehitu'}
          </button>
        </form>
      </section>

      {isCreator && (
        <section className="gs-section gs-danger-zone" aria-label="Taldea ezabatu">
          <h3>ADI!</h3>
          <p>Taldea ezabatuz gero, gastu guztiak betiko galduko dira.</p>
          <button className="btn-danger" onClick={deleteGroup}>Taldea ezabatu</button>
        </section>
      )}
    </main>
  );
}