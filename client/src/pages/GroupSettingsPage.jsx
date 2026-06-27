import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './GroupSettingsPage.css';
import '../App.css';
import ConfirmationModal from '../components/ConfirmationModal';
import ImageEditorModal from '../components/ImageEditorModal';

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
  
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const [showImageEditor, setShowImageEditor] = useState(false);
  const [pendingFile, setPendingFile]         = useState(null);
  const [editedBlob, setEditedBlob]           = useState(null);

  const [leaving, setLeaving] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied]   = useState(false);

  const [confirmation, setConfirmation] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null
  });

  useEffect(() => {
    api.get(`/groups/${id}`)
      .then(r => {
        if (!isMountedRef.current) return;
        setGroup(r.data);
        setName(r.data.name);
        setDesc(r.data.description || '');
        setPhotoPreview(r.data.photoURL || null);
      })
      .catch(console.error)
      .finally(() => {
        if (isMountedRef.current) setLoading(false);
      });
  }, [id]);

  function handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setFeedback(err); return; }
    setFeedback('');
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
      return group?.photoURL || null;
    });
    setEditedBlob(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  async function handlePhotoUpload() {
    if (!editedBlob) return;

    setFeedback('');
    setUploadProgress(0);

    try {
      const filePath   = `groups/${id}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, editedBlob);

      const downloadURL = await new Promise((resolve, reject) => {
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

      if (!isMountedRef.current) return;

      const { data } = await api.put(`/groups/${id}`, {
        name: group.name,
        description: group.description,
        photoURL: downloadURL,
      });

      if (!isMountedRef.current) return;
      
      setGroup(prev => ({ ...prev, photoURL: data.photoURL }));
      setUploadProgress(null);
      setEditedBlob(null);
      setFeedback('Argazkia eguneratu da.');
      setTimeout(() => {
        if (isMountedRef.current) setFeedback('');
      }, 2500);
      if (photoInputRef.current) photoInputRef.current.value = '';
    } catch {
      if (isMountedRef.current) {
        setUploadProgress(null);
        setFeedback('Errorea argazkia igotzerakoan. Saiatu berriro.');
      }
    }
  }

  async function saveGroup(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put(`/groups/${id}`, { name, description: desc });
      if (!isMountedRef.current) return;
      setGroup(prev => ({ ...prev, ...data }));
      setFeedback('Aldaketak gordeta.');
      setTimeout(() => {
        if (isMountedRef.current) setFeedback('');
      }, 2500);
    } catch {
      if (isMountedRef.current) setFeedback('Errore bat gertatu da.');
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  }

  async function addMember(e) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAddingMember(true);
    try {
      await api.post(`/groups/${id}/members`, { email: newEmail });
      const { data } = await api.get(`/groups/${id}`);
      if (!isMountedRef.current) return;
      setGroup(data);
      setNewEmail('');
      setFeedback('Kidea gehitu da.');
      setTimeout(() => {
        if (isMountedRef.current) setFeedback('');
      }, 2500);
    } catch (err) {
      if (!isMountedRef.current) return;
      setFeedback(err.response?.data?.error || 'Ezin izan da kidea gehitu.');
      setTimeout(() => {
        if (isMountedRef.current) setFeedback('');
      }, 3000);
    } finally {
      if (isMountedRef.current) setAddingMember(false);
    }
  }

  async function copyInviteLink() {
    setInviteLoading(true);
    try {
      const { data } = await api.get(`/groups/${id}/invite-link`);
      await navigator.clipboard.writeText(`${window.location.origin}/join/${data.token}`);
      if (!isMountedRef.current) return;
      setInviteCopied(true);
      setTimeout(() => {
        if (isMountedRef.current) setInviteCopied(false);
      }, 2000);
    } catch {
      if (isMountedRef.current) {
        setFeedback('Ezin izan da gonbidapen-esteka lortu.');
        setTimeout(() => {
          if (isMountedRef.current) setFeedback('');
        }, 3000);
      }
    } finally {
      if (isMountedRef.current) setInviteLoading(false);
    }
  }

  async function removeMember(userId) {
    setConfirmation({
      show: true,
      title: 'Kidea kendu',
      message: 'Kidea taldeetik kendu nahi duzu?',
      onConfirm: async () => {
        try {
          await api.delete(`/groups/${id}/members/${userId}`);
          if (!isMountedRef.current) return;
          setGroup(prev => ({
            ...prev,
            members: prev.members.filter(m => m._id !== userId),
          }));
          setConfirmation(prev => ({ ...prev, show: false }));
        } catch (err) {
          if (!isMountedRef.current) return;
          setFeedback(err.response?.data?.error || 'Errore bat gertatu da.');
          setConfirmation(prev => ({ ...prev, show: false }));
        }
      }
    });
  }

  async function deleteGroup() {
    setConfirmation({
      show: true,
      title: 'Taldea ezabatu',
      message: `"${group.name}" taldea betiko ezabatu nahi duzu? Gasto guztiak galduko dira.`,
      onConfirm: async () => {
        try {
          await api.delete(`/groups/${id}`);
          navigate('/groups');
        } catch {
          if (isMountedRef.current) {
            setFeedback('Ezin izan da taldea ezabatu.');
            setConfirmation(prev => ({ ...prev, show: false }));
          }
        }
      }
    });
  }

  const isCreator = profile?.id === group?.createdBy?._id || profile?.id === group?.createdBy;

  async function leaveGroup() {
    const isLastMember = group?.members?.length === 1;

    setConfirmation({
      show: true,
      title: 'Taldea utzi',
      message: isCreator
        ? (isLastMember 
            ? 'Azken taldekidea zara. Taldea utziz gero, talde hau eta bere gastu guztiak betiko ezabatuko dira. Ziur zaude?'
            : 'Ziur zaude taldea utzi nahi duzula? Jabetza automatikoki beste kide bati pasatuko zaio.')
        : 'Ziur zaude taldea utzi nahi duzula? Zure gastuen historiala mantendu egingo da.',
      onConfirm: async () => {
        try {
          setLeaving(true);
          await api.post(`/groups/${id}/leave`);
          navigate('/groups');
        } catch (err) {
          if (!isMountedRef.current) return;
          setFeedback(err.response?.data?.error || 'Ezin izan da taldea utzi.');
          setConfirmation(prev => ({ ...prev, show: false }));
          setLeaving(false);
        }
      }
    });
  }

  if (loading) return <div className="gs-loading">Kargatzen…</div>;
  if (!group)  return <div className="gs-loading">Taldea ez da aurkitu.</div>;

  return (
    <main className="gs-layout">
      <section className="top">
        <button className="btn-ghost" onClick={() => navigate(`/groups/${id}`)}>‹ Atzera</button>
        <h1>Taldearen ezarpenak</h1>
      </section>

      {feedback && <div className="gs-feedback">{feedback}</div>}

      {isCreator && (
        <section className="gs-section" aria-label="Taldearen argazkia">
          <h3>Taldearen argazkia</h3>

          <div className="gs-photo-wrap">
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
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoSelected}
              />
            </div>
          </div>

          {editedBlob && uploadProgress === null && (
            <div className="gs-photo-confirm">
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
            <label>
              <span>Izena</span>
              <input value={name} onChange={e => setName(e.target.value)} required />
            </label>
            <label>
              <span>Deskribapena</span>
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

        <button
          type="button"
          className="btn-ghost"
          onClick={copyInviteLink}
          disabled={inviteLoading}
          style={{ marginTop: '0.75rem' }}
        >
          {inviteCopied ? 'Esteka kopiatu da' : inviteLoading ? 'Sortzen…' : 'Gonbidapen-esteka kopiatu'}
        </button>
      </section>

      {isCreator && (
        <section className="gs-section" aria-label="Taldea utzi">
          <h3>Taldea utzi</h3>
          <p>Taldea utziz gero, jabetza beste kide bati pasatuko zaio eta ez duzu taldea gehiago ikusiko. Zure gastu historikoak mantenduko dira balantzea zuzena izan dadin.</p>
          <button className="btn-ghost" onClick={leaveGroup} disabled={leaving}>
            {leaving ? 'Uzten…' : 'Taldea utzi'}
          </button>
        </section>
      )}

      {isCreator && (
        <section className="gs-section gs-danger-zone" aria-label="Taldea ezabatu">
          <h3>ADI!</h3>
          <p>Taldea ezabatuz gero, gastu guztiak betiko galduko dira.</p>
          <button className="btn-danger" onClick={deleteGroup}>Taldea ezabatu</button>
        </section>
      )}

      {!isCreator && (
        <section className="gs-section" aria-label="Taldea utzi">
          <h3>Taldea utzi</h3>
          <p>Taldea utziz gero, ez duzu gehiago ikusiko. Zure gastu historikoak mantenduko dira balantzea zuzena izan dadin.</p>
          <button className="btn-ghost" onClick={leaveGroup} disabled={leaving}>
            {leaving ? 'Uzten…' : 'Taldea utzi'}
          </button>
        </section>
      )}

      <ConfirmationModal
        show={confirmation.show}
        title={confirmation.title}
        message={confirmation.message}
        onConfirm={confirmation.onConfirm}
        onCancel={() => setConfirmation(prev => ({ ...prev, show: false }))}
      />

      <ImageEditorModal
        show={showImageEditor}
        file={pendingFile}
        shape="square"
        title="Taldearen argazkia egokitu"
        onConfirm={handleEditorConfirm}
        onCancel={handleEditorCancel}
      />
    </main>
  );
}