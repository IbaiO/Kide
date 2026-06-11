import { useEffect, useState } from 'react';
import api from '../services/api';
import './Balance.css';

export default function Balance({ groupId, members }) {
  const [balances, setBalances]     = useState([]);
  const [transfers, setTransfers]   = useState(null); // null = no calculado aún
  const [loading, setLoading]       = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError]           = useState('');

  const memberMap = Object.fromEntries(members.map(m => [m._id, m.displayName]));

  useEffect(() => {
    api.get(`/expenses/group/${groupId}/balance`)
      .then(r => setBalances(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [groupId]);

  async function optimize() {
    setOptimizing(true);
    setError('');
    try {
      const { data } = await api.get(`/groups/${groupId}/optimize`);
      setTransfers(data.transfers);
    } catch (err) {
      setError('Ezin izan da optimizatu. Saiatu berriro.');
    } finally {
      setOptimizing(false);
    }
  }

  if (loading) return <div className="bal-loading">Kargatzen…</div>;

  const allSettled = balances.every(b => Math.abs(b.net) < 0.01);

  return (
    <div className="bal-container">

      {/* ── Balances netos ── */}
      <section className="bal-section">
        <h3>Saldo garbia</h3>
        {balances.length === 0 ? (
          <p className="bal-empty">Oraindik ez dago gasturik.</p>
        ) : (
          <ul className="bal-list">
            {balances.map(b => (
              <li key={b.userId} className="bal-item">
                <span className="bal-name">{memberMap[b.userId] || b.userId}</span>
                <span className={`bal-net ${b.net > 0.01 ? 'positive' : b.net < -0.01 ? 'negative' : 'zero'}`}>
                  {b.net > 0.01 ? '+' : ''}{b.net.toFixed(2)} €
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Optimización ── */}
      <section className="bal-section">
        <h3>Zorrak kitatu</h3>
        {allSettled ? (
          <p className="bal-settled">✓ Dena saldatuta dago.</p>
        ) : transfers === null ? (
          <>
            <p className="bal-hint">
              Kalkulatu transferentzia kopuru minimoa zorra kitatzeko.
            </p>
            <button className="btn-primary" onClick={optimize} disabled={optimizing}>
              {optimizing ? 'Optimizatzen…' : 'Optimizatu'}
            </button>
            {error && <p className="bal-error">{error}</p>}
          </>
        ) : transfers.length === 0 ? (
          <p className="bal-settled">✓ Dena saldatuta dago.</p>
        ) : (
          <>
            <ul className="bal-transfers">
              {transfers.map((t, i) => (
                <li key={i} className="bal-transfer">
                  <span className="bal-transfer-from">{t.from?.displayName || t.from}</span>
                  <span className="bal-transfer-arrow">→</span>
                  <span className="bal-transfer-to">{t.to?.displayName || t.to}</span>
                  <span className="bal-transfer-amount">{t.amount.toFixed(2)} €</span>
                </li>
              ))}
            </ul>
            <button className="btn-ghost bal-recalc" onClick={() => setTransfers(null)}>
              Berriro kalkulatu
            </button>
          </>
        )}
      </section>
    </div>
  );
}
