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

  const [participants, setParticipants] = useState(() =>
    members.map(m => {
      const existing = expense?.splits?.find(s => s.user._id === m._id || s.user === m._id);
      return {
        user: m._id,
        displayName: m.displayName,
        value: existing ? existing.amount : 0,
        active: !!existing || !isEdit,
      };
    })
  );

  const [dirtyFields, setDirtyFields] = useState(() => {
    if (!isEdit) return new Set();
    return new Set(
      members
        .filter(m => expense?.splits?.find(s => s.user._id === m._id || s.user === m._id))
        .map(m => m._id)
    );
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    const total  = parseFloat(amount);
    const active = participants.filter(p => p.active);
    if (active.length === 0 || !amount || isNaN(total) || total <= 0) return;

    if (splitType === 'equal') {
      const base = parseFloat((total / active.length).toFixed(2));
      const rest = parseFloat((total - base * (active.length - 1)).toFixed(2));
      setParticipants(prev =>
        prev.map((p, _, arr) => {
          if (!p.active) return { ...p, value: 0 };
          const isLast = arr.filter(x => x.active).at(-1).user === p.user;
          return { ...p, value: isLast ? rest : base };
        })
      );
      return;
    }

    const dirty = active.filter(p => dirtyFields.has(p.user));
    const clean = active.filter(p => !dirtyFields.has(p.user));
    if (clean.length === 0) return;

    const targetTotal = splitType === 'percentage' ? 100 : total;
    const dirtySum    = parseFloat(dirty.reduce((s, p) => s + p.value, 0).toFixed(2));
    const remaining   = parseFloat((targetTotal - dirtySum).toFixed(2));
    if (remaining < 0) return;

    const share  = parseFloat((remaining / clean.length).toFixed(2));
    const adjust = parseFloat((remaining - share * (clean.length - 1)).toFixed(2));

    setParticipants(prev =>
      prev.map((p, _, arr) => {
        if (!p.active || dirtyFields.has(p.user)) return p;
        const cleanArr = arr.filter(x => x.active && !dirtyFields.has(x.user));
        const isLast   = cleanArr.at(-1).user === p.user;
        return { ...p, value: isLast ? adjust : share };
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, splitType, dirtyFields, participants.filter(p => p.active).length]);

  function toggleParticipant(userId) {
    setDirtyFields(prev => { const n = new Set(prev); n.delete(userId); return n; });
    setParticipants(prev =>
      prev.map(p => p.user === userId ? { ...p, active: !p.active, value: 0 } : p)
    );
  }

  function setParticipantValue(userId, val) {
    const parsed = parseFloat(val);
    setDirtyFields(prev => new Set(prev).add(userId));
    setParticipants(prev =>
      prev.map(p => p.user === userId ? { ...p, value: isNaN(parsed) ? 0 : parsed } : p)
    );
  }

  function validate() {
    const active = participants.filter(p => p.active);
    if (active.length === 0) return 'Gutxienez partaide bat hautatu behar duzu.';

    const total = parseFloat(parseFloat(amount).toFixed(2));

    if (splitType === 'percentage') {
      const sum = parseFloat(active.reduce((s, p) => s + p.value, 0).toFixed(2));
      if (Math.abs(sum - 100) > 0.01)
        return `Ehunekoen batura 100 izan behar da (%${sum.toFixed(2)} da).`;
    }

    if (splitType === 'exact') {
      const sum = parseFloat(active.reduce((s, p) => s + p.value, 0).toFixed(2));
      if (Math.abs(sum - total) > 0.01)
        return `Kopuruen batura ${total.toFixed(2)}€ izan behar da (${sum.toFixed(2)}€ da).`;
    }

    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const activeParticipants = participants
      .filter(p => p.active)
      .map(p => ({ user: p.user, value: p.value }));

    setSaving(true);
    try {
      const payload = {
        groupId,
        description,
        amount: parseFloat(amount),
        date,
        splitType,
        participants: splitType === 'equal'
          ? activeParticipants.map(p => ({ user: p.user }))
          : activeParticipants,
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

  const activeCount = participants.filter(p => p.active).length;
  const total       = parseFloat(amount) || 0;

  function summaryLabel() {
    if (!amount || activeCount === 0 || splitType === 'equal') return null;
    const targetTotal = splitType === 'percentage' ? 100 : total;
    const sum = parseFloat(
      participants.filter(p => p.active).reduce((s, p) => s + p.value, 0).toFixed(2)
    );
    const remaining = parseFloat((targetTotal - sum).toFixed(2));
    if (Math.abs(remaining) < 0.01) return { text: '✓ Banaketa zuzena da.', type: 'ok' };
    const unit = splitType === 'percentage' ? '%' : '€';
    return remaining > 0
      ? { text: `${remaining.toFixed(2)} ${unit} esleitu gabe`, type: 'under' }
      : { text: `${Math.abs(remaining).toFixed(2)} ${unit} gehiegi esleitu da`, type: 'over' };
  }

  const summary = summaryLabel();

  return (
    <div className="ef-overlay">
      <form className="ef-form" onSubmit={handleSubmit}>
        <h3>{isEdit ? 'Gastua editatu' : 'Gastua gehitu'}</h3>

        <label>Deskribapena
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
          />
        </label>

        <label>Zenbatekoa (€)
          <input
            type="number" min="0.01" step="0.01"
            value={amount}
            onChange={e => { setAmount(e.target.value); setDirtyFields(new Set()); }}
            required
          />
        </label>

        <label>Data
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>

        <label>Banaketa mota
          <select
            value={splitType}
            onChange={e => { setSplitType(e.target.value); setDirtyFields(new Set()); }}
          >
            <option value="equal">Guztiek berdin</option>
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
                <div className="ef-value-wrap">
                  <input
                    type="number" min="0" step="0.01"
                    value={p.value === 0 ? '' : p.value}
                    onChange={e => setParticipantValue(p.user, e.target.value)}
                    onFocus={e => e.target.select()}
                    className={`ef-value-input${dirtyFields.has(p.user) ? ' dirty' : ''}`}
                    placeholder={splitType === 'percentage' ? '0' : '0.00'}
                  />
                  <span className="ef-value-unit">
                    {splitType === 'percentage' ? '%' : '€'}
                  </span>
                </div>
              )}

              {p.active && splitType === 'equal' && amount && (
                <span className="ef-equal-share">
                  {activeCount > 0 ? (total / activeCount).toFixed(2) : '0.00'} €
                </span>
              )}
            </div>
          ))}

          {summary && (
            <p className={`ef-summary ef-summary--${summary.type}`}>{summary.text}</p>
          )}
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