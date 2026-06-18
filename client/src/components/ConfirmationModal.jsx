import { useEffect } from 'react';

export default function ConfirmationModal({
  show,
  title = 'Baieztatu',
  message,
  confirmLabel = 'Baieztatu',
  cancelLabel = 'Utzi',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!show) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCancel?.();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, onCancel]);

  if (!show) return null;

  return (
    <>
      <div
        className="modal fade show"
        style={{ display: 'block' }}
        tabIndex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmationModalTitle"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content cm-content">
            <div className="modal-header cm-header">
              <h5 className="modal-title" id="confirmationModalTitle">{title}</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Itxi"
                onClick={onCancel}
              />
            </div>
            <div className="modal-body cm-body">
              {typeof message === 'string' ? <p className="mb-0">{message}</p> : message}
            </div>
            <div className="modal-footer cm-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                {cancelLabel}
              </button>
              <button
                type="button"
                className={`btn btn-${variant}`}
                onClick={onConfirm}
                autoFocus
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onCancel} aria-hidden="true" />
    </>
  );
}