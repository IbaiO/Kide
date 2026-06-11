import { useState, useEffect } from 'react';
import api from '../services/api';
import './ExpenseForm.css';

export default function ExpenseForm({ groupId, members, expense, onSaved, onCancel }) {
  const isEdit = !!expense;

  const [description, setDescription] = useState(expense?.description || '');
  const [amount, setAmount]           = useState(expense?.amount?.toString() || '');
  const [splitType, setSplitType]     = useState(expense?.splitType || 'equal');
  const [date, setDate]               = useState(
    expense?.date ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );

  // participants: [{ user: id, value: number, active: bool }]
  const [participants, setParticipants] = useState(() =>
    members.map(m => {
      const existing = expense?.splits?.find(s => s.user._id === m._id || s.user === m._id);
      return {
        user: m._id,
        displayName: m.displayName,
        value: existing?.amount || 0,
        active: !!existing || !isEdit,
      };
    })
  );

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  // Cuando cambia el importe o tipo, recalculamos los valores sugeridos
  useEffect(() => {
    if (splitType !== 'equal') return;
    const active = participants.filter(p => p.active).length;
    if (active === 0 || !amount) return;
    const share = parseFloat((parseFloat(amount) / active).toFixed(2));
    setParticipants(prev =>
      prev.map(p => ({ ...p, value: p.active ? share : 0 }))
    );
  }, [amount, splitType, participants.filter(p => p.active).length]);

  function toggleParticipant(userId) {
    setParticipants(prev =>
      prev.map(p => p.user === userId ? { ...p, active: !p.active } : p)
    );
  }

  function setParticipantValue(userId, val) {
    setParticipants(prev =>
      prev.map(p => p.user === userId ? { ...p, value: parseFloat(val) || 0 } : p)
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const activeParticipants = participants
      .filter(p => p.active)
      .map(p => ({ user: p.user, value: p.value }));

    if (activeParticipants.length === 0) {
      setError('Gutxienez partaide bat hautatu behar duzu.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        groupId,
        description,
        amount: parseFloat(amount),
        date,
        splitType,
        participants: splitType === 'equal' ? activeParticipants.map(p => ({ user: p.user })) : activeParticipants,
      };

      const { data } = isEdit
        ? await api.put(`/expenses/${expense._id}`, payload)
        : await api.post('/expenses', payload);

      onSaved(data, isEdit);
    } catch (err) {
      setError(err.response?.data?.error || 'Errore bat gertatu da.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ef-overlay">
      <form className="ef-form" onSubmit={handleSubmit}>
        <h3>{isEdit ? 'Gastua editatu' : 'Gastua gehitu'}</h3>

        <label>Deskribapena
          <input value={description} onChange={e => setDescription(e.target.value)} required />
        </label>

        <label>Zenbatekoa (€)
          <input type="number" min="0.01" step="0.01" value={amount}
            onChange={e => setAmount(e.target.value)} required />
        </label>

        <label>Data
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>

        <label>Banaketa mota
          <select value={splitType} onChange={e => setSplitType(e.target.value)}>
            <option value="equal">Berdinez berdin</option>
            <option value="percentage">Ehunekoka</option>
            <option value="exact">Zenbateko zehatza</option>
          </select>
        </label>

        <div className="ef-participants">
          <span className="ef-participants-label">Partaideak</span>
          {participants.map(p => (
            <div key={p.user} className={`ef-participant ${p.active ? 'active' : ''}`}>
              <label className="ef-participant-toggle">
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={() => toggleParticipant(p.user)}
                />
                <span>{p.displayName}</span>
              </label>
              {p.active && splitType !== 'equal' && (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={p.value}
                  onChange={e => setParticipantValue(p.user, e.target.value)}
                  className="ef-value-input"
                  placeholder={splitType === 'percentage' ? '%' : '€'}
                />
              )}
              {p.active && splitType === 'equal' && amount && (
                <span className="ef-equal-share">
                  {(parseFloat(amount) / participants.filter(x => x.active).length).toFixed(2)} €
                </span>
              )}
            </div>
          ))}
        </div>

        {error && <p className="ef-error">{error}</p>}

        <div className="ef-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>Utzi</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Gordetzen…' : isEdit ? 'Gorde' : 'Gehitu'}
          </button>
        </div>
      </form>
    </div>
  );
}
