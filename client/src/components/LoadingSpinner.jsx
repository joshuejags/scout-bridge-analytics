import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ size = 'medium', fullScreen = false, message = 'Loading...' }) => {
  const content = (
    <div className={`loading-spinner spinner-${size}`}>
      <div className="spinner"></div>
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return <div className="loading-fullscreen">{content}</div>;
  }

  return content;
};

export default LoadingSpinner;
