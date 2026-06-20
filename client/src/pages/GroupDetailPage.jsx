import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ExpenseForm from '../components/ExpenseForm';
import Balance from '../components/Balance';
import ConfirmationModal from '../components/ConfirmationModal';
import ExpenseDetailModal from '../components/ExpenseDetailModal';
import './GroupDetailPage.css';

export default function GroupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

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

  const [balanceVersion, setBalanceVersion] = useState(0);
  const refreshBalance = useCallback(() => setBalanceVersion(v => v + 1), []);

  async function loadGroup() {
    try {
      const { data } = await api.get(`/groups/${id}`);
      setGroup(data);
      const sortedExpenses = (data.expenses || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(sortedExpenses);
      setPhotoPreview(data.photoURL || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadGroup()
    api.get(`/groups/${id}`)}, [id]);

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
        return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
    } else {
      setExpenses(prev => {
        const updated = [expense, ...prev];
        return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

          {expenses.length === 0 ? (
            <div className="gd-empty">Oraindik ez dago gasturik.</div>
          ) : (
            <ul className="gd-expense-list">
              {expenses.map(e => (
                <li
                  key={e._id}
                  className="gd-expense-card"
                  onClick={() => setDetailExpense(e)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => { if (ev.key === 'Enter') setDetailExpense(e); }}
                >
                  <div className="gde-left">
                    <span className="gde-desc">{e.description}</span>
                    <span className="gde-meta">
                      {/* Data formato japonesa, euskerazkoaren berdina delako (YYYY/MM/DD) */}
                      {e.paidBy?.displayName} · {new Date(e.date).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <div className="gde-right">
                    <span className="gde-amount">{e.amount.toFixed(2)} €</span>
                    {e.paidBy?._id === profile?.id && (
                      <div className="gde-actions">
                        <button
                          className="btn-icon"
                          onClick={ev => { ev.stopPropagation(); setEditExpense(e); setShowForm(true); }}
                        >
                          ✏
                        </button>
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
              ))}
            </ul>
          )}
        </section>

        {/* Eskuin zutabea: Balantzeak */}
        <aside className={`col-12 col-xl-5 ${!showBalantzea ? 'd-none d-xl-block' : ''}`} aria-label="Taldearen balantzea">
          <Balance groupId={id} members={balanceMembers} version={balanceVersion} />
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