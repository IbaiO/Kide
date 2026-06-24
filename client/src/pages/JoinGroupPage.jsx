import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './JoinGroupPage.css';

export default function JoinGroupPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api.get(`/groups/join/${token}`)
      .then(({ data }) => setInfo(data))
      .catch(err => setError(err.response?.data?.error || 'Gonbidapen-esteka ez da baliozkoa.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    setJoining(true);
    try {
      const { data } = await api.post(`/groups/join/${token}`);
      navigate(`/groups/${data.id}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Ezin izan zara taldera gehitu.');
      setJoining(false);
    }
  }

  function handleDecline() {
    navigate('/', { replace: true });
  }

  if (loading) {
    return (
      <main className="join-bg">
        <section className="join-card">
          <span>Kargatzen…</span>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="join-bg">
        <section className="join-card">
          <p className="join-error">{error}</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Itzuli</button>
        </section>
      </main>
    );
  }

  if (info?.alreadyMember) {
    return (
      <main className="join-bg">
        <section className="join-card">
          <span className="join-icon">✓</span>
          <h1>Talde honetako kide zara jadanik!</h1>
          <p>Dagoeneko <strong>{info.name}</strong> taldeko kidea zara.</p>
          <button className="btn-primary" onClick={() => navigate(`/groups/${info.id}`)}>
            Taldera joan
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="join-bg">
      <section className="join-card">
        <span className="join-icon">👥</span>
        <h1>Gonbidapena</h1>
        <p>
          <strong>{info.name}</strong> taldera gonbidatu zaituzte.
          {info.description && <span className="join-desc">{info.description}</span>}
        </p>
        <p className="join-question">Talde honetan sartu nahi duzu?</p>
        <section className="join-actions">
          <button className="btn-ghost" onClick={handleDecline} disabled={joining}>
            Ez
          </button>
          <button className="btn-primary" onClick={handleAccept} disabled={joining}>
            {joining ? 'Sartzen…' : 'Bai'}
          </button>
        </section>
      </section>
    </main>
  );
}