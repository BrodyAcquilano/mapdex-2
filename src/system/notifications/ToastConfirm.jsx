import { useEffect, useRef } from "react";
import "./ToastConfirm.css";

function ToastConfirm({
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  system,
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    const modal = modalRef.current;
    const previousFocus = document.activeElement;

    modal?.focus();

    const cleanup = system.trapFocus(modal, onCancel);

    return () => {
      cleanup();
      previousFocus?.focus?.();
    };
  }, [system, onCancel]);

  return (
    <div className="toast-confirm-backdrop" onClick={onCancel}>
      <div
        ref={modalRef}
        className="toast-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-describedby="toast-confirm-message"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div id="toast-confirm-message" className="toast-confirm-message">
          {message}
        </div>

        <div className="toast-confirm-actions">
          <button
            className="toast-confirm-confirm"
            onClick={onConfirm}
          >
            {confirmText}
          </button>

          <button
            className="toast-confirm-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ToastConfirm;