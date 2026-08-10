import React, { useEffect, useState } from 'react';
import { useInstallPrompt, useNetworkStatus } from '../hooks/useResponsive';
import './PwaStatusBanner.css';

const PwaStatusBanner = () => {
  const { canInstall, install } = useInstallPrompt();
  const { isOnline } = useNetworkStatus();
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const handlePwaUpdate = () => {
      setShowUpdatePrompt(true);
    };

    window.addEventListener('pwa-update', handlePwaUpdate);
    return () => window.removeEventListener('pwa-update', handlePwaUpdate);
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!isOnline && !canInstall && !showUpdatePrompt) {
    return null;
  }

  const isOffline = !isOnline;
  const title = isOffline ? 'Offline mode active' : showUpdatePrompt ? 'Update ready' : 'Install ScoutBridge';
  const description = isOffline
    ? 'Cached scouting pages and reports stay available while you reconnect.'
    : showUpdatePrompt
      ? 'A fresh version of ScoutBridge is ready. Refresh to keep your workspace current.'
      : 'Install the app for a faster, native-feel experience on mobile and desktop.';

  return (
    <div className={`pwa-status-banner ${isOffline ? 'pwa-status-banner--offline' : ''}`} role="status" aria-live="polite">
      <div className="pwa-status-banner__content">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="pwa-status-banner__actions">
        {canInstall && (
          <button type="button" className="button button-secondary" onClick={handleInstall} disabled={installing}>
            {installing ? 'Installing…' : 'Install app'}
          </button>
        )}
        {showUpdatePrompt && (
          <button type="button" className="button button-primary" onClick={handleRefresh}>
            Refresh now
          </button>
        )}
      </div>
    </div>
  );
};

export default PwaStatusBanner;
