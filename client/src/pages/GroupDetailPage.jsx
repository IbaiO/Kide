import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePWA } from '../hooks/usePWA';
import api from '../services/api';
import { createGroupSocket } from '../services/socket';
import ExpenseForm from '../components/ExpenseForm';
import Balance from '../components/Balance';
import ConfirmationModal from '../components/ConfirmationModal';
import ExpenseDetailModal from '../components/ExpenseDetailModal';
import './GroupDetailPage.css';

export default function GroupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isOnline, pendingActions, syncToast } = usePWA();

  const [group, setGroup]       = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [tab, setTab]           = useState('gastuak'); // Mobiletan erabiltzeko
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [photoPreview, setPhotoPreview]     = useState(null);

  const [detailExpense, setDetailExpense] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberFeedback, setMemberFeedback] = useState('');

  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied]   = useState(false);

  const [balanceVersion, setBalanceVersion] = useState(0);
  const refreshBalance = useCallback(() => setBalanceVersion(v => v + 1), []);

  async function loadGroup() {
    try {
      const { data } = await api.get(`/groups/${id}`);
      setGroup(data);
      const sortedExpenses = (data.expenses || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setExpenses(sortedExpenses);
      setPhotoPreview(data.photoURL || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroup();
  }, [id]);

  // Socket.io
  useEffect(() => {
    const socket = createGroupSocket();

    socket.on('connect', () => {
      socket.emit('join_group', id);
    });

    socket.on('gastuak_eguneratuta', () => {
      loadGroup();
      refreshBalance();
    });

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [id, refreshBalance]);

  function requestDeleteExpense(expense) {
    setExpenseToDelete(expense);
  }

  async function confirmDeleteExpense() {
    if (!expenseToDelete) return;
    const expenseId = expenseToDelete._id;
    try {
      await api.delete('/expenses/' + expenseId);
      setExpenses(prev => prev.filter(ex => ex._id !== expenseId));
      refreshBalance();
    } catch (err) {
      console.error(err);
    } finally {
      setExpenseToDelete(null);
      setDetailExpense(null);
    }
  }

  function onExpenseSaved(expense, isEdit) {
    if (isEdit) {
      setExpenses(prev => {
        const updated = prev.map(e => e._id === expense._id ? expense : e);
        return updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
    } else {
      setExpenses(prev => {
        const updated = [expense, ...prev];
        return updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
    }
    setShowForm(false);
  }

  function openEditFromDetail(expense) {
    setDetailExpense(null);
    setEditExpense(expense);
    setShowForm(true);
  }

  async function addMember(e) {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;
    setAddingMember(true);
    try {
      await api.post(`/groups/${id}/members`, { email: newMemberEmail });
      await loadGroup();
      setNewMemberEmail('');
      setMemberFeedback('Kidea gehitu da.');
      setShowAddMember(false);
      setTimeout(() => setMemberFeedback(''), 2500);
    } catch (err) {
      setMemberFeedback(err.response?.data?.error || 'Ezin izan da kidea gehitu.');
      setTimeout(() => setMemberFeedback(''), 3000);
    } finally {
      setAddingMember(false);
    }
  }

  async function copyInviteLink() {
    setInviteLoading(true);
    try {
      const { data } = await api.get(`/groups/${id}/invite-link`);
      await navigator.clipboard.writeText(`${window.location.origin}/join/${data.token}`);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch (err) {
      setMemberFeedback('Ezin izan da gonbidapen-esteka lortu.');
      setTimeout(() => setMemberFeedback(''), 3000);
    } finally {
      setInviteLoading(false);
    }
  }

  if (loading) return <div className="gd-loading">Kargatzen…</div>;
  if (!group)  return <div className="gd-loading">Taldea ez da aurkitu.</div>;

  const showGastuak   = tab === 'gastuak';
  const showBalantzea = tab === 'balantzea';

  const membersMap = {};
  
  if (group.members) {
    group.members.forEach(m => {
      membersMap[m._id] = m;
    });
  }

  expenses.forEach(e => {
    if (e.paidBy && !membersMap[e.paidBy._id]) {
      membersMap[e.paidBy._id] = {
        ...e.paidBy,
        displayName: `${e.paidBy.displayName} (Irtendakoa)`
      };
    }
    if (e.splits) {
      e.splits.forEach(s => {
        if (s.user && !membersMap[s.user._id]) {
          membersMap[s.user._id] = {
            ...s.user,
            displayName: `${s.user.displayName} (Irtendakoa)`
            };
        }
      });
    }
  });

  const balanceMembers = Object.values(membersMap);

  const groupPendingActions = pendingActions.filter(a => a.groupId === id);

  const updateDrafts = new Map();
  const createDrafts = [];

  groupPendingActions.forEach(action => {
    if (action.type === 'update' && action.expenseId) {
      updateDrafts.set(action.expenseId, action);
    } else {
      createDrafts.push({
        _id: `draft-${action.localId}`,
        description: action.payload.description,
        amount: action.payload.amount,
        date: action.payload.date || new Date(action.createdAt).toISOString(),
        createdAt: new Date(action.createdAt).toISOString(),
        paidBy: { _id: profile?.id, displayName: profile?.displayName || 'Zu' },
        isDraft: true,
        draftKind: 'create',
      });
    }
  });

  const displayExpenses = [
    ...expenses.map(e => updateDrafts.has(e._id)
      ? { ...e, isDraft: true, draftKind: 'update' }
      : e
    ),
    ...createDrafts,
  ].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));

  function buildSettlementLabel(e) {
    if (!e.isSettlement) return null;
    const payerName = e.paidBy?.displayName || '?';
    const receiverId = e.splits?.[0]?.user?._id || e.splits?.[0]?.user;
    const receiver = balanceMembers.find(m => m._id === receiverId);
    const receiverName = receiver?.displayName || '?';
    return `${payerName}ek ${receiverName}ri ordaindu dio`;
  }

return (
    <main className="gd-layout">
      <section className="top">
        <button className="btn-ghost" onClick={() => navigate(`/`)}>‹ Atzera</button>
      </section>

      <div className="gd-photo-wrap">
        {photoPreview ? (
          <img src={photoPreview} alt="" className="gd-group-photo" />
        ) : (
          <div className="gd-group-photo-placeholder" aria-hidden="true">
            {group.name[0].toUpperCase()}
          </div>
        )}
        <h1 className="h4 mb-0" style={{ fontWeight: 600, color: 'var(--text-1)' }}>
          {group.name}
        </h1>
        <button className="btn-ghost gd-settings-btn" onClick={() => navigate(`/groups/${id}/settings`)}>⚙ Ezarpenak</button>
      </div>

      {/* Konexio-egoeraren abisuak */}
      {!isOnline && (
        <div
          role="status"
          style={{
            background: 'var(--bg-hover)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '0.55rem 0.85rem',
            fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '0.75rem',
          }}
        >
          Konexiorik gabe zaude. Gastu berriak gailuan gorde eta konexioa berreskuratzean igoko dira.
        </div>
      )}

      {isOnline && groupPendingActions.length > 0 && (
        <div
          role="status"
          style={{
            background: 'var(--bg-hover)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '0.55rem 0.85rem',
            fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '0.75rem',
          }}
        >
          {groupPendingActions.length} gastu bidaltzen ari dira…
        </div>
      )}

      {syncToast && (
        <div
          role="status"
          style={{
            background: 'rgba(72, 199, 142, 0.08)', border: '1px solid rgba(72, 199, 142, 0.25)',
            borderRadius: 'var(--radius-sm)', padding: '0.55rem 0.85rem',
            fontSize: '0.85rem', color: 'var(--green)', marginBottom: '0.75rem',
          }}
        >
          ✓ {syncToast}
        </div>
      )}

      {memberFeedback && <div className="gd-member-feedback">{memberFeedback}</div>}

      {showAddMember && (
        <form className="gd-add-member" onSubmit={addMember}>
          <input
            type="email"
            placeholder="Email bidez kide berria gehitu"
            value={newMemberEmail}
            onChange={e => setNewMemberEmail(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn-primary" disabled={addingMember}>
            {addingMember ? '…' : 'Gehitu'}
          </button>
        </form>
      )}

      {showAddMember && (
        <button
          type="button"
          className="btn-ghost"
          onClick={copyInviteLink}
          disabled={inviteLoading}
          style={{ marginTop: '1rem', marginBottom: '1rem', marginLeft: 'auto', display: 'flex', justifyContent: 'flex-end' }}
        >
          {inviteCopied ? 'Esteka kopiatu da' : inviteLoading ? 'Sortzen…' : 'Gonbidapen-esteka kopiatu'}
        </button>
      )}

      {/* Tabs: Mobiletan, bi zutabeak banatzen dira */}
      <div className="gd-tabs d-xl-none">
        <button className={tab === 'gastuak'   ? 'tab active' : 'tab'} onClick={() => setTab('gastuak')}>Gastuak</button>
        <button className={tab === 'balantzea' ? 'tab active' : 'tab'} onClick={() => setTab('balantzea')}>Balantzea</button>
      </div>

      <div className="row g-3 gd-content">

        {/* Ezker zutabea: Gastuen zerrenda */}
        <section className={`col-12 col-xl-7 ${!showGastuak ? 'd-none d-xl-block' : ''}`} aria-labelledby="gastuak-heading">
          <h2 id="gastuak-heading" className="visually-hidden">Gastuen historia</h2>
          
          <div className="gd-actions">
            <button
              className="btn-primary btn-member-accent"
              onClick={() => setShowAddMember(v => !v)}
            >
              {showAddMember ? 'Utzi' : '+ Kidea gehitu'}
            </button>
            <button className="btn-primary" onClick={() => { setEditExpense(null); setShowForm(true); }}>
              + Gastua gehitu
            </button>
          </div>

          {showForm && (
            <ExpenseForm
              groupId={id}
              members={group.members}
              expense={editExpense}
              onSaved={onExpenseSaved}
              onCancel={() => { setShowForm(false); setEditExpense(null); }}
            />
          )}

          {displayExpenses.length === 0 ? (
            <div className="gd-empty">Oraindik ez dago gasturik.</div>
          ) : (
            <ul className="gd-expense-list">
              {displayExpenses.map(e => {
                const isSettlement = !!e.isSettlement;
                const settlementLabel = buildSettlementLabel(e);

                return (
                  <li
                    key={e._id}
                    className={`gd-expense-card${isSettlement ? ' is-settlement' : ''}`}
                    onClick={() => { if (!e.isDraft) setDetailExpense(e); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(ev) => { if (ev.key === 'Enter' && !e.isDraft) setDetailExpense(e); }}
                  >
                    <div className="gde-left">
                      <span className="gde-desc">
                        {isSettlement ? (
                          // Settlement-etan mezua euskeraz
                          <>
                            {settlementLabel}
                            <span className="gde-settlement-label">Zorraren ordainketa</span>
                          </>
                        ) : (
                          <>
                            {e.description}
                            {e.isDraft && (
                              <span
                                style={{
                                  fontSize: '0.72rem', color: 'var(--text-2)',
                                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                                  borderRadius: 'var(--radius-sm)', padding: '0.1rem 0.45rem',
                                  marginLeft: '0.5rem', whiteSpace: 'nowrap',
                                }}
                              >
                                {e.draftKind === 'update' ? 'Aldaketa bidali gabe' : 'Zirriborroa'}
                              </span>
                            )}
                          </>
                        )}
                      </span>
                      <span className="gde-meta">
                        {/* Data formato japonesa, euskerazkoaren berdina delako (YYYY/MM/DD) */}
                        {e.paidBy?.displayName} · {new Date(e.date).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    <div className="gde-right">
                      <span className="gde-amount">{e.amount.toFixed(2)} €</span>
                      {!e.isDraft && e.paidBy?._id === profile?.id && (
                        <div className="gde-actions">
                          {!isSettlement && (
                            <button
                              className="btn-icon"
                              onClick={ev => { ev.stopPropagation(); setEditExpense(e); setShowForm(true); }}
                            >
                              ✏
                            </button>
                          )}
                          <button
                            className="btn-icon danger"
                            onClick={ev => { ev.stopPropagation(); requestDeleteExpense(e); }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Eskuin zutabea: Balantzeak */}
        <aside className={`col-12 col-xl-5 ${!showBalantzea ? 'd-none d-xl-block' : ''}`} aria-label="Taldearen balantzea">
          <Balance groupId={id} members={balanceMembers} version={balanceVersion} onRefresh={refreshBalance} currentUserId={profile?.id} />
        </aside>

      </div>

      <ExpenseDetailModal
        show={!!detailExpense}
        expense={detailExpense}
        currentUserId={profile?.id}
        onClose={() => setDetailExpense(null)}
        onEdit={openEditFromDetail}
        onDelete={requestDeleteExpense}
      />

      <ConfirmationModal
        show={!!expenseToDelete}
        title="Gastua ezabatu"
        message={`Ziur zaude "${expenseToDelete?.description}" gastua ezabatu nahi duzula? Ekintza honek ez du atzera bueltarik.`}
        confirmLabel="Ezabatu"
        cancelLabel="Utzi"
        variant="danger"
        onConfirm={confirmDeleteExpense}
        onCancel={() => setExpenseToDelete(null)}
      />
    </main>
  );
}