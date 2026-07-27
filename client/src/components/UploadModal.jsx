import React, { useEffect, useRef } from 'react';
import { useUpload } from '../context/UploadContext';
import VideoUpload from './VideoUpload';
import './UploadModal.css';

/**
 * Reachable from the NavBar (and anywhere else that calls openUpload())
 * instead of being confined to a single panel on one page - see
 * UploadContext for why. Escape-to-close and the focus trap mirror
 * PlayerComparison, the app's other overlay.
 */
const UploadModal = () => {
  const { isOpen, closeUpload, notifyUploadSuccess } = useUpload();
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeUpload();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeUpload]);

  if (!isOpen) return null;

  return (
    <div className="upload-modal-overlay" role="dialog" aria-modal="true" aria-label="Add a video">
      <div className="upload-modal-panel" ref={panelRef}>
        <button
          className="upload-modal-close"
          onClick={closeUpload}
          aria-label="Close"
          ref={closeBtnRef}
        >
          &times;
        </button>
        <VideoUpload onUploadSuccess={notifyUploadSuccess} />
      </div>
    </div>
  );
};

export default UploadModal;
