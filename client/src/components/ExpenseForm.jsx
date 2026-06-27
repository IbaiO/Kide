import { useState, useEffect } from 'react';
import api from '../services/api';
import { usePWA, queueExpenseAction } from '../hooks/usePWA';
import { storage } from '../services/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import './ExpenseForm.css';

const MAX_RECEIPT_SIZE = 5 * 1024 * 1024; // 5 MB

export default function ExpenseForm({ groupId, members, expense, onSaved, onCancel }) {
  const isEdit = !!expense;
  const { isOnline } = usePWA();
  const efOnline = navigator.onLine && isOnline;

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

  // ── Tiketaren argazkia (Drag & Drop) ───────────────────────────
  const [receiptFile, setReceiptFile]       = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(expense?.receiptURL || null);
  const [receiptRemoved, setReceiptRemoved] = useState(false);
  const [isDragging, setIsDragging]         = useState(false);
  const [receiptError, setReceiptError]     = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);

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

  function validateReceiptFile(file) {
    if (!file.type.startsWith('image/')) {
      return 'Tiketaren argazkia irudi formatukoa izan behar da (jpg, png...).';
    }
    if (file.size > MAX_RECEIPT_SIZE) {
      return 'Irudia handiegia da (gehienez 5 MB).';
    }
    return null;
  }

  function handleReceiptFile(file) {
    if (!file) return;
    const validationMsg = validateReceiptFile(file);
    if (validationMsg) {
      setReceiptError(validationMsg);
      return;
    }
    setReceiptError('');
    setReceiptRemoved(false);
    setReceiptFile(file);

    const reader = new FileReader();
    reader.onload = () => setReceiptPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    if (!efOnline) return;
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    if (!efOnline) return;
    const file = e.dataTransfer.files?.[0];
    handleReceiptFile(file);
  }

  function handleFileInputChange(e) {
    handleReceiptFile(e.target.files?.[0]);
    e.target.value = '';
  }

  function clearReceipt() {
    setReceiptFile(null);
    setReceiptPreview(null);
    setReceiptError('');
    setReceiptRemoved(true);
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

  async function uploadReceiptAndGetURL() {
    setUploadProgress(0);
    const safeName = receiptFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `receipts/${groupId}/${crypto.randomUUID()}-${safeName}`;
    const fileRef = storageRef(storage, path);
    const uploadTask = uploadBytesResumable(fileRef, receiptFile);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        snapshot => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(pct);
        },
        reject,
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
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const activeParticipants = participants
      .filter(p => p.active)
      .map(p => ({ user: p.user, value: p.value }));

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

    if (!efOnline) {
      try {
        await queueExpenseAction({
          localId: crypto.randomUUID(),
          type: isEdit ? 'update' : 'create',
          groupId,
          expenseId: isEdit ? expense._id : undefined,
          payload,
          createdAt: Date.now(),
        });
        onCancel();
      } catch (err) {
        setError('Ezin izan da gastua gailuan gorde.');
      }
      return;
    }

    setSaving(true);
    try {
      if (receiptFile) {
        try {
          payload.receiptURL = await uploadReceiptAndGetURL();
        } catch (err) {
          setError('Ezin izan da tiketaren argazkia igo. Saiatu berriro.');
          setSaving(false);
          setUploadProgress(null);
          return;
        }
      } else if (receiptRemoved) {
        payload.receiptURL = null;
      }

      const { data } = isEdit
        ? await api.put(`/expenses/${expense._id}`, payload)
        : await api.post('/expenses', payload);

      onSaved(data, isEdit);
    } catch (err) {
      setError(err.response?.data?.error || 'Errore bat gertatu da.');
    } finally {
      setSaving(false);
      setUploadProgress(null);
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

        {!efOnline && (
          <p className="ef-offline-notice">
            Konexiorik gabe zaude. Gastua gailuan gorde eta konexioa berreskuratzean bidaliko da.
          </p>
        )}

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

        <div className="ef-receipt">
          <span className="ef-receipt-label">Tiketaren argazkia (aukerakoa)</span>

          {receiptPreview ? (
            <div className="ef-receipt-preview">
              <img src={receiptPreview} alt="Tiketaren aurrebista" className="ef-receipt-thumb" />
              {efOnline && (
                <button type="button" className="ef-receipt-remove" onClick={clearReceipt}>
                  ✕ Kendu
                </button>
              )}
            </div>
          ) : (
            <label
              className={`ef-dropzone${isDragging ? ' dragging' : ''}${!efOnline ? ' disabled' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                disabled={!efOnline}
                style={{ display: 'none' }}
              />
              <span>
                {efOnline
                  ? 'Arrastatu tiketaren argazkia hona, edo sakatu hautatzeko'
                  : 'Konexiorik gabe ezin da argazkirik gehitu'}
              </span>
            </label>
          )}

          {uploadProgress !== null && (
            <div className="ef-receipt-progress">
              <div className="ef-receipt-progress-bar" style={{ width: `${uploadProgress}%` }} />
              <span className="ef-receipt-progress-text">Igotzen… {uploadProgress}%</span>
            </div>
          )}

          {receiptError && <p className="ef-error">{receiptError}</p>}
        </div>

        <label>Banaketa mota
          <select
            value={splitType}
            onChange={e => { setSplitType(e.target.value); setDirtyFields(new Set()); }}
          >
            <option value="equal">Guztiek berdin</option>
            <option value="percentage">Ehunekoa</option>
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
            {saving ? 'Gordetzen…' : !efOnline ? 'Gorde gailuan' : isEdit ? 'Gorde' : 'Gehitu'}
          </button>
        </div>
      </form>
    </div>
  );
}