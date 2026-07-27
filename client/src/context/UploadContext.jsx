import React, { createContext, useContext, useState, useCallback } from 'react';

const UploadContext = createContext(null);

/**
 * Video upload used to only exist as a toggle panel on the Home page - the
 * one place in the app you could add a video at all. Lifting it here makes
 * it reachable from anywhere (NavBar, Dashboard, ...) through one shared
 * modal instead of duplicating the upload form per page. `version` bumps
 * on every successful upload so any page showing video data (Home,
 * Dashboard) can refetch without the two being directly wired together.
 */
export const UploadProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [version, setVersion] = useState(0);

  const openUpload = useCallback(() => setIsOpen(true), []);
  const closeUpload = useCallback(() => setIsOpen(false), []);
  const notifyUploadSuccess = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <UploadContext.Provider value={{ isOpen, openUpload, closeUpload, notifyUploadSuccess, version }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload must be used within an UploadProvider');
  return ctx;
};
