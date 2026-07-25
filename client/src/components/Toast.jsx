import React, { useEffect } from 'react';
import './Toast.css';

// Success/info toasts auto-dismiss so they don't pile up or sit there
// after the user has clearly moved on; errors stay put since those often
// need to be read carefully or acted on, not just glanced at.
const AUTO_DISMISS_MS = 5000;

const Toast = ({ type = 'info', message, onClose }) => {
  useEffect(() => {
    if (!message || type === 'error' || !onClose) return;
    const timer = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, type, onClose]);

  if (!message) return null;

  return (
    <div className={`toast toast-${type}`}>
      <span>{message}</span>
      {onClose && (
        <button className="toast-close" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
};

export default Toast;
