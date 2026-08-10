import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to detect mobile/tablet viewport sizes
 */
export function useResponsive() {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    isTablet: typeof window !== 'undefined' ? window.innerWidth >= 768 && window.innerWidth < 1024 : false,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 1024 : false,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setViewport({
        width,
        height: window.innerHeight,
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewport;
}

/**
 * Hook to detect touch device
 */
export function useTouch() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const isTouchDevice = () => {
      return (
        (typeof window !== 'undefined' && 'ontouchstart' in window) ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
      );
    };

    setIsTouch(isTouchDevice());
  }, []);

  return isTouch;
}

/**
 * Hook to handle safe area insets (notch, etc)
 */
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const updateInsets = () => {
      const root = document.documentElement;
      setInsets({
        top: parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-top')) || 0,
        right: parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-right')) || 0,
        bottom: parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-bottom')) || 0,
        left: parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-left')) || 0,
      });
    };

    updateInsets();
    window.addEventListener('orientationchange', updateInsets);
    return () => window.removeEventListener('orientationchange', updateInsets);
  }, []);

  return insets;
}

/**
 * Hook to detect device orientation
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState('portrait');

  useEffect(() => {
    const updateOrientation = () => {
      if (window.innerHeight > window.innerWidth) {
        setOrientation('portrait');
      } else {
        setOrientation('landscape');
      }
    };

    updateOrientation();
    window.addEventListener('orientationchange', updateOrientation);
    window.addEventListener('resize', updateOrientation);

    return () => {
      window.removeEventListener('orientationchange', updateOrientation);
      window.removeEventListener('resize', updateOrientation);
    };
  }, []);

  return orientation;
}

/**
 * Hook to detect network connection status
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    effectiveType: 'unknown',
  });

  useEffect(() => {
    const handleOnline = () => setStatus((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus((prev) => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get connection info
    if (navigator.connection) {
      setStatus((prev) => ({
        ...prev,
        effectiveType: navigator.connection.effectiveType,
      }));

      navigator.connection.addEventListener('change', () => {
        setStatus((prev) => ({
          ...prev,
          effectiveType: navigator.connection.effectiveType,
        }));
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}

/**
 * Hook for PWA installation prompt
 */
export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      setInstallPrompt(null);
      return true;
    }

    return false;
  }, [installPrompt]);

  return {
    installPrompt: installPrompt && !isInstalled ? installPrompt : null,
    isInstalled,
    install,
    canInstall: !!installPrompt && !isInstalled,
  };
}

/**
 * Hook to detect if PWA is running standalone
 */
export function useStandalone() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(standalone);
  }, []);

  return isStandalone;
}

/**
 * Hook to handle viewport units and safe areas
 */
export function useViewportUnits() {
  const [viewport, setViewport] = useState({
    vh: typeof window !== 'undefined' ? window.innerHeight * 0.01 : 0,
    vw: typeof window !== 'undefined' ? window.innerWidth * 0.01 : 0,
  });

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        vh: window.innerHeight * 0.01,
        vw: window.innerWidth * 0.01,
      });
    };

    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  return viewport;
}

/**
 * Hook for permission requests
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState({
    camera: 'denied',
    microphone: 'denied',
    geolocation: 'denied',
    notification: Notification?.permission || 'denied',
  });

  const request = useCallback(async (permissionName) => {
    try {
      if (permissionName === 'notification') {
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          setPermissions((prev) => ({ ...prev, notification: permission }));
          return permission;
        }
      } else if (permissionName === 'geolocation') {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              setPermissions((prev) => ({ ...prev, geolocation: 'granted' }));
              resolve('granted');
            },
            () => {
              setPermissions((prev) => ({ ...prev, geolocation: 'denied' }));
              resolve('denied');
            }
          );
        });
      } else if (permissionName === 'camera' || permissionName === 'microphone') {
        const constraints = {};
        if (permissionName === 'camera') constraints.video = true;
        if (permissionName === 'microphone') constraints.audio = true;

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach((track) => track.stop());

        setPermissions((prev) => ({ ...prev, [permissionName]: 'granted' }));
        return 'granted';
      }
    } catch (error) {
      console.error(`Error requesting ${permissionName} permission:`, error);
      setPermissions((prev) => ({ ...prev, [permissionName]: 'denied' }));
      return 'denied';
    }
  }, []);

  return { permissions, request };
}
