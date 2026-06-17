import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './GroupListPage.css';

export default function GroupListPage() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [newName, setNewName]     = useState('');
  const [newDesc, setNewDesc]     = useState('');
  const [creating, setCreating]   = useState(false);

  useEffect(() => {
    api.get('/groups')
      .then(({ data }) => setGroups(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function createGroup(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/groups', { name: newName.trim(), description: newDesc.trim() });
      setGroups(prev => [data, ...prev]);
      setNewName('');
      setNewDesc('');
      setShowForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(' ')
      .map(w => w[0].toUpperCase())
      .slice(0, 2)
      .join('');
  }

  return (
    <main className="gl-layout">
      <header className="gl-header">
        <span className="gl-logo">kide</span>
        <header className="gl-header-actions">
          <button
            className="gl-avatar-btn"
            onClick={() => navigate('/settings')}
            title={profile?.displayName || 'Ezarpenak'}
            aria-label="Nire ezarpenak"
          >
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={profile.displayName} className="gl-avatar-img" />
            ) : (
              <span className="gl-avatar-initials">{getInitials(profile?.displayName)}</span>
            )}
          </button>
          <button className="btn-ghost" onClick={logout}>Irten</button>
        </header>
      </header>

      <div className="gl-top">
        <h1>Nire taldeak</h1>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Utzi' : '+ Taldea sortu'}
        </button>
      </div>

      {showForm && (
        <form className="new-group-form" onSubmit={createGroup}>
          <input
            type="text"
            placeholder="Taldearen izena *"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
            autoFocus
          />
          <input
            type="text"
            placeholder="Deskribapena (aukerakoa)"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
          />
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Utzi</button>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Sortzen…' : 'Sortu'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="gl-empty"><span>Kargatzen…</span></div>
      ) : groups.length === 0 ? (
        <div className="gl-empty">
          <span>Oraindik ez dago talderik.</span>
          <button className="btn-primary" onClick={() => setShowForm(true)}>Sortu lehena</button>
        </div>
      ) : (
        <ul className="gl-list">
          {groups.map(g => (
            <li key={g._id} className="gl-card" onClick={() => navigate(`/groups/${g._id}`)}>
              <div className="gl-card-avatar" style={g.photoURL ? { 
                  backgroundImage: `url(${g.photoURL})`, 
                  backgroundSize: 'cover', 
                  backgroundPosition: 'center',
                  color: 'transparent' 
                } : {}}
              >
                {!g.photoURL && g.name[0].toUpperCase()}
              </div>
              <div className="gl-card-info">
                <span className="gl-card-name">{g.name}</span>
                {g.description && <span className="gl-card-desc">{g.description}</span>}
              </div>
              <div className="gl-card-meta">
                <span>{g.members?.length ?? 0} kide</span>
                <span className="gl-arrow">›</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}