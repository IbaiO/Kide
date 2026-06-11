import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './GroupSettingsPage.css';

export default function GroupSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [group, setGroup]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName]       = useState('');
  const [desc, setDesc]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    api.get(`/groups/${id}`)
      .then(r => {
        setGroup(r.data);
        setName(r.data.name);
        setDesc(r.data.description || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function saveGroup(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put(`/groups/${id}`, { name, description: desc });
      setGroup(prev => ({ ...prev, ...data }));
      setFeedback('Aldaketak gordeta.');
      setTimeout(() => setFeedback(''), 2500);
    } catch (err) {
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
    } catch (err) {
      setFeedback('Ezin izan da taldea ezabatu.');
    }
  }

  const isCreator = profile?.id === group?.createdBy?._id || profile?.id === group?.createdBy;

  if (loading) return <div className="gs-loading">Kargatzen…</div>;
  if (!group)  return <div className="gs-loading">Taldea ez da aurkitu.</div>;

  return (
    <div className="gs-layout">
      <header className="gs-header">
        <button className="btn-ghost" onClick={() => navigate(`/groups/${id}`)}>‹ Atzera</button>
        <h2>Ezarpenak</h2>
      </header>

      {feedback && <div className="gs-feedback">{feedback}</div>}

      {/* ── Editar grupo (solo creador) ── */}
      {isCreator && (
        <section className="gs-section">
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

      {/* ── Miembros ── */}
      <section className="gs-section">
        <h3>Kideak ({group.members?.length})</h3>
        <ul className="gs-members">
          {group.members?.map(m => (
            <li key={m._id} className="gs-member">
              <div className="gs-member-avatar">{m.displayName?.[0]?.toUpperCase()}</div>
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

      {/* ── Zona de peligro ── */}
      {isCreator && (
        <section className="gs-section gs-danger-zone">
          <h3>Zona arriskutsua</h3>
          <p>Taldea ezabatuz gero, gasto guztiak betiko galduko dira.</p>
          <button className="btn-danger" onClick={deleteGroup}>Taldea ezabatu</button>
        </section>
      )}
    </div>
  );
}
