import React from 'react';
import './Toast.css';

const Toast = ({ type = 'info', message, onClose }) => {
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
