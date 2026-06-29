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

  const isOwner = expense.paidBy?._id === currentUserId || expense.paidBy === currentUserId;
  const isSettlement = !!expense.isSettlement;
  
  // Data formato japonesa, euskerazkoaren berdina delako (YYYY/MM/DD)
  const formattedDate = new Date(expense.date).toLocaleDateString('ja-JP');

  const receiverSplit = isSettlement ? expense.splits?.find(s => s.amount > 0) : null;
  const receiverName = receiverSplit?.user?.displayName || 'Taldekidea';

  const modalTitle = isSettlement
    ? `${expense.paidBy?.displayName || '?'}ek ${receiverName}ri ordaindu dio`
    : expense.description;

  return (
    <>
      <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className={`modal-content edm-content ${isSettlement ? 'edm-settlement' : ''}`}>
            <div className="modal-header edm-header">
              <h5 className="modal-title">
                {modalTitle}
              </h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Itxi" />
            </div>

            <div className="modal-body">
              {isSettlement && (
                <div className="edm-settlement-badge">
                  ➔ Zorraren ordainketa
                </div>
              )}

              <div className="edm-summary">
                <span className="edm-amount">{expense.amount.toFixed(2)} €</span>
                {!isSettlement && (
                  <span className="edm-splittype">
                    {SPLIT_TYPE_LABELS[expense.splitType] || SPLIT_TYPE_LABELS.equal}
                  </span>
                )}
              </div>

              <div className="edm-meta">
                <div className="edm-meta-row">
                  <dt>Data</dt>
                  <dd>{formattedDate}</dd>
                </div>
                <div className="edm-meta-row">
                  <dt>{isSettlement ? 'Nork ordaindua' : 'Nork ordaindu du'}</dt>
                  <dd>{expense.paidBy?.displayName || 'Norbaitek'}</dd>
                </div>
                {isSettlement && (
                  <div className="edm-meta-row">
                    <dt>Nori ordaindua</dt>
                    <dd>{receiverName}</dd>
                  </div>
                )}
              </div>

              {!isSettlement && expense.splits && expense.splits.length > 0 && (
                <section className="edm-splits-sect">
                  <h6 className="edm-splits-title">Partaideen banaketa</h6>
                  <ul className="edm-splits-list">
                    {expense.splits.map((split, index) => (
                      <li key={index} className="edm-split-row">
                        <span className="edm-split-name">{split.user?.displayName || 'Taldekidea'}</span>
                        <span className="edm-split-amount">{split.amount.toFixed(2)} €</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {expense.receiptURL && !isSettlement && (
                <div className="edm-receipt" style={{ marginTop: '0.9rem' }}>
                  <h6 className="edm-splits-title">Tiketa</h6>
                  <a
                    href={expense.receiptURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-block' }}
                  >
                    <img
                      src={expense.receiptURL}
                      alt="Tiketaren argazkia"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '220px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        display: 'block',
                      }}
                    />
                  </a>
                </div>
              )}
            </div>

            {isOwner && (
              <div className="modal-footer edm-footer">
                {!isSettlement && (
                  <button type="button" className="btn btn-outline-secondary" onClick={() => onEdit?.(expense)}>
                    Editatu
                  </button>
                )}
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