import { useState } from 'react';
import { usePWA } from '../hooks/usePWA';
import api from '../services/api';
import './SettleDebtForm.css';


export default function SettleDebtForm({ groupId, transfer, members, onSaved, onClose }) {
  const { isOnline } = usePWA();
  const resolveId = (field) =>
    field && typeof field === 'object' ? (field._id || field.id) : field;

  const resolveName = (field) => {
    const id = resolveId(field);
    const found = members.find((m) => m._id === id);
    return found ? found.displayName : (typeof field === 'object' ? field.displayName : field) || '?';
  };

  const fromId   = resolveId(transfer.from);
  const toId     = resolveId(transfer.to);
  const fromName = resolveName(transfer.from);
  const toName   = resolveName(transfer.to);

  const [amount, setAmount]   = useState(transfer.amount.toFixed(2));
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Zenbatekoa zero baino handiagoa izan behar da.');
      return;
    }

    if (!isOnline) {
      setError('Konexiorik gabe zaude. Zorra kitatzeko interneteko konexioa behar da.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await api.post('/expenses', {
        groupId,
        description: `${fromName} → ${toName}`,
        amount: parsedAmount,
        splitType: 'exact',
        participants: [{ user: toId, value: parsedAmount }],
        isSettlement: true,
      });

      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Ezin izan da ordainketa gorde. Saiatu berriro.');
    } finally {
      setSaving(false);
    }
  }

  function resolveAvatar(field) {
    const id = resolveId(field);
    const found = members.find((m) => m._id === id);
    const name = found ? found.displayName : resolveName(field);
    if (found && found.photoURL) {
      return <img src={found.photoURL} alt={name} className="sdf-avatar" />;
    }
    const initial = name.trim().charAt(0).toUpperCase() || '?';
    return <div className="sdf-avatar-fallback">{initial}</div>;
  }

  return (
    <div className="sdf-backdrop" role="dialog" aria-modal="true" aria-label="Zorra kitatu">
      <div className="sdf-modal">
        <button className="sdf-close" onClick={onClose} aria-label="Itxi">✕</button>

        <h2 className="sdf-title">Zorra kitatu</h2>

        {/* Transferentziaren laburpena */}
        <div className="sdf-transfer-preview">
          <div className="sdf-user">
            {resolveAvatar(transfer.from)}
            <span className="sdf-user-name">{fromName}</span>
          </div>
          <div className="sdf-arrow-col">
            <span className="sdf-arrow">➔</span>
          </div>
          <div className="sdf-user">
            {resolveAvatar(transfer.to)}
            <span className="sdf-user-name">{toName}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="sdf-form">
          <label className="sdf-label" htmlFor="sdf-amount">
            Zenbatekoa (€)
          </label>
          <p className="sdf-hint">Kopurua aldatu dezakezu ordainketa partziala egiteko.</p>
          <input
            id="sdf-amount"
            type="number"
            className="sdf-input"
            value={amount}
            min="0.01"
            step="0.01"
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />

          {error && <p className="sdf-error">{error}</p>}

          <div className="sdf-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              Utzi
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Gordetzen…' : 'Ordaindu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}