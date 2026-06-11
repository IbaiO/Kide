import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './GroupListPage.css';

export default function GroupListPage() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/groups')
      .then(r => setGroups(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function createGroup(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/groups', { name: newName, description: newDesc });
      setGroups(prev => [data, ...prev]);
      setNewName(''); setNewDesc(''); setShowNew(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="gl-layout">
      <header className="gl-header">
        <span className="gl-logo">kide</span>
        <div className="gl-header-actions">
          <span className="gl-username">{profile?.displayName}</span>
          <button className="btn-ghost" onClick={logout}>Irten</button>
        </div>
      </header>

      <main className="gl-main">
        <div className="gl-top">
          <h1>Taldeak</h1>
          <button className="btn-primary" onClick={() => setShowNew(true)}>+ Talde berria</button>
        </div>

        {showNew && (
          <form className="new-group-form" onSubmit={createGroup}>
            <input
              autoFocus
              placeholder="Taldearen izena"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
            />
            <input
              placeholder="Deskribapena (aukerakoa)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
            />
            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowNew(false)}>Utzi</button>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Sortzen…' : 'Sortu'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="gl-empty">Kargatzen…</div>
        ) : groups.length === 0 ? (
          <div className="gl-empty">
            <p>Oraindik ez duzu talderik.</p>
            <button className="btn-primary" onClick={() => setShowNew(true)}>Sortu lehena</button>
          </div>
        ) : (
          <ul className="gl-list">
            {groups.map(g => (
              <li key={g._id} className="gl-card" onClick={() => navigate(`/groups/${g._id}`)}>
                <div className="gl-card-avatar">{g.name[0].toUpperCase()}</div>
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
    </div>
  );
}
