import { useEffect } from 'react';
import './ExpenseDetailModal.css';

const SPLIT_TYPE_LABELS = {
  equal: 'Berdin banatuta',
  percentage: 'Ehunekoa',
  exact: 'Kopuru zehatzak',
};

export default function ExpenseDetailModal({
  show,
  expense,
  currentUserId,
  onClose,
  onEdit,
  onDelete,
}) {
  useEffect(() => {
    if (!show) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, onClose]);

  if (!show || !expense) return null;

  const isOwner = expense.paidBy?._id === currentUserId;
  
  // Data formato japonesa, euskerazkoaren berdina delako (YYYY/MM/DD)
  const formattedDate = new Date(expense.date).toLocaleDateString('ja-JP');

  return (
    <>
      <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content edm-content">
            <div className="modal-header edm-header">
              <h5 className="modal-title">{expense.description}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Itxi" />
            </div>
            <div className="modal-body">
              <div className="edm-summary">
                <span className="edm-amount">{expense.amount.toFixed(2)} €</span>
                <span className="edm-splittype">{SPLIT_TYPE_LABELS[expense.splitType] || expense.splitType}</span>
              </div>

              <dl className="edm-meta">
                <div className="edm-meta-row">
                  <dt>Ordaindu du</dt>
                  <dd>{expense.paidBy?.displayName || 'Erabiltzailea'}</dd>
                </div>
                <div className="edm-meta-row">
                  <dt>Data</dt>
                  <dd>{formattedDate}</dd>
                </div>
              </dl>

              <h6 className="edm-splits-title">Banaketa</h6>
              <ul className="edm-splits-list" style={{ listStyle: 'none', padding: 0 }}>
                {expense.splits?.map((s, index) => (
                  <li key={s.user?._id || index} className="edm-split-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                    <span className="edm-split-name">{s.user?.displayName || 'Erabiltzailea'}</span>
                    <span className="edm-split-amount">{s.amount.toFixed(2)} €</span>
                  </li>
                ))}
              </ul>
            </div>

            {isOwner && (
              <div className="modal-footer edm-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => onEdit?.(expense)}>
                  Editatu
                </button>
                <button type="button" className="btn btn-danger" onClick={() => onDelete?.(expense)}>
                  Ezabatu
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} aria-hidden="true" />
    </>
  );
}