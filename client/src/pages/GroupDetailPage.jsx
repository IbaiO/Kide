import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ExpenseForm from '../components/ExpenseForm';
import Balance from '../components/Balance';
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

  const [balanceVersion, setBalanceVersion] = useState(0);
  const refreshBalance = useCallback(() => setBalanceVersion(v => v + 1), []);

  async function loadGroup() {
    try {
      const { data } = await api.get(`/groups/${id}`);
      setGroup(data);
      setExpenses(data.expenses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadGroup(); }, [id]);

  async function deleteExpense(e, expenseId) {
    e.stopPropagation();
    if (!confirm('Gastua ezabatu nahi duzu?')) return;
    try {
      await api.delete(`/expenses/${expenseId}`);
      setExpenses(prev => prev.filter(ex => ex._id !== expenseId));
      refreshBalance();
    } catch (err) {
      console.error(err);
    }
  }

  function onExpenseSaved(expense, isEdit) {
    if (isEdit) {
      setExpenses(prev => prev.map(e => e._id === expense._id ? expense : e));
    } else {
      setExpenses(prev => [expense, ...prev]);
    }
    setShowForm(false);
    setEditExpense(null);
    refreshBalance();
  }

  if (loading) return <div className="gd-loading">Kargatzen…</div>;
  if (!group)  return <div className="gd-loading">Taldea ez da aurkitu.</div>;

  const showGastuak   = tab === 'gastuak';
  const showBalantzea = tab === 'balantzea';

  return (
    <main className="gd-layout">
      <header className="gd-header">
        <button className="btn-ghost" onClick={() => navigate('/')}>‹ Atzera</button>
        <h2 className="gd-title">{group.name}</h2>
        <button className="btn-ghost" onClick={() => navigate(`/groups/${id}/settings`)}>⚙</button>
      </header>

      {/* Tabs: Mobiletan, bi zutabeak banatzen dira */}
      <div className="gd-tabs d-xl-none">
        <button className={tab === 'gastuak'   ? 'tab active' : 'tab'} onClick={() => setTab('gastuak')}>Gastuak</button>
        <button className={tab === 'balantzea' ? 'tab active' : 'tab'} onClick={() => setTab('balantzea')}>Balantzea</button>
      </div>

      <div className="row g-3 gd-content">

        {/* Ezker zutabea: Gastuen zerrenda */}
        <div className={`col-12 col-xl-7 ${!showGastuak ? 'd-none d-xl-block' : ''}`}>
          <section id="gastuak" aria-label="Gastuen historia">
            <div className="gd-actions">
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
                  <li key={e._id} className="gd-expense-card">
                    <div className="gde-left">
                      <span className="gde-desc">{e.description}</span>
                      <span className="gde-meta">
                        {e.paidBy?.displayName} · {new Date(e.date).toLocaleDateString('eu-ES')}
                      </span>
                    </div>
                    <div className="gde-right">
                      <span className="gde-amount">{e.amount.toFixed(2)} €</span>
                      {e.paidBy?._id === profile?.id && (
                        <div className="gde-actions">
                          <button className="btn-icon" onClick={ev => { ev.stopPropagation(); setEditExpense(e); setShowForm(true); }}>✏</button>
                       <button className="btn-icon danger" onClick={ev => deleteExpense(ev, e._id)}>✕</button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Eskuin zutabea: Balantzzeak */}
        <div className={`col-12 col-xl-5 ${!showBalantzea ? 'd-none d-xl-block' : ''}`}>
          <aside id="balantzea" aria-label="Taldearen balantzea">
            <Balance groupId={id} members={group.members} version={balanceVersion} />
          </aside>
        </div>

      </div>
    </main>
  );
}