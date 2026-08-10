/**
 * PWA Registration & Management
 * Handles service worker registration, update checking, and PWA features
 */

class PWAManager {
  constructor() {
    this.registration = null;
    this.updateCheckInterval = 60 * 60 * 1000; // Check for updates every hour
  }

  /**
   * Register service worker
   */
  async register() {
    if (!navigator.serviceWorker || typeof navigator.serviceWorker.register !== 'function') {
      console.log('Service Workers not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      console.log('Service Worker registered successfully:', this.registration);

      // Listen for updates
      this.registration.addEventListener('updatefound', () => this.onUpdateFound());

      // Check for updates periodically
      setInterval(() => this.checkForUpdates(), this.updateCheckInterval);

      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  /**
   * Check for service worker updates
   */
  async checkForUpdates() {
    if (!this.registration) return;

    try {
      await this.registration.update();
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }

  /**
   * Handle service worker update found
   */
  onUpdateFound() {
    const newWorker = this.registration.installing;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New service worker available, show update notification
        this.notifyUpdate();
      }
    });
  }

  /**
   * Show update notification
   */
  notifyUpdate() {
    const message = 'A new version of ScoutBridge is available!';
    const action = 'Update';

    // Use browser's native notification API
    if (document.hidden) {
      // Show system notification if page is not focused
      if ('Notification' in window) {
        new Notification('ScoutBridge Analytics', {
          body: message,
          icon: '/icon-192x192.png',
        });
      }
    }

    // Dispatch custom event for UI update
    window.dispatchEvent(
      new CustomEvent('pwa-update', {
        detail: { message, action },
      })
    );
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  /**
   * Request push notification subscription
   */
  async requestPushSubscription() {
    if (!this.registration) {
      console.error('Service Worker not registered');
      return null;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();

      if (subscription) {
        return subscription;
      }

      const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VAPID public key not configured');
        return null;
      }

      const newSubscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
      });

      return newSubscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  /**
   * Check if app is installable (has install prompt)
   */
  onBeforeInstallPrompt(callback) {
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event;
      callback(deferredPrompt);
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
    });
  }

  /**
   * Trigger install prompt
   */
  async installApp(deferredPrompt) {
    if (!deferredPrompt) {
      console.error('Install prompt not available');
      return false;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User response to install prompt: ${outcome}`);
    return outcome === 'accepted';
  }

  /**
   * Check if app is running in PWA mode
   */
  isRunningAsPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');
  }

  /**
   * Enable offline mode indicator
   */
  watchOnlineStatus() {
    window.addEventListener('online', () => {
      console.log('App is online');
      window.dispatchEvent(new CustomEvent('pwa-online'));
    });

    window.addEventListener('offline', () => {
      console.log('App is offline');
      window.dispatchEvent(new CustomEvent('pwa-offline'));
    });
  }

  /**
   * Get app version
   */
  getVersion() {
    return process.env.REACT_APP_VERSION || '1.0.0';
  }

  /**
   * Check network type
   */
  getNetworkInfo() {
    if (!navigator.connection) {
      return null;
    }

    return {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt,
      saveData: navigator.connection.saveData,
    };
  }
}

const pwaManager = new PWAManager();
export const initializePWA = async () => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!navigator.serviceWorker || typeof navigator.serviceWorker.register !== 'function') {
    return false;
  }

  try {
    if (document.readyState === 'loading') {
      await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
    }

    await pwaManager.register();
    pwaManager.watchOnlineStatus();
    return true;
  } catch (error) {
    console.error('Failed to initialize PWA:', error);
    return false;
  }
};

export const canUsePWA = () => typeof window !== 'undefined' && !!navigator.serviceWorker && typeof navigator.serviceWorker.register === 'function';
export const installPWA = (deferredPrompt) => pwaManager.installApp(deferredPrompt);

export default pwaManager;
