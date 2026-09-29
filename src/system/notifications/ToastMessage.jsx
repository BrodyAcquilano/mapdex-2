// src/system/notifications/ToastMessage.jsx
import "./ToastMessage.css";

function ToastMessage({ message }) {
  if (!message) return null;

  return (
    <div className="toast-message" aria-hidden="true">
      <span>{message}</span>
    </div>
  );
}

export default ToastMessage;