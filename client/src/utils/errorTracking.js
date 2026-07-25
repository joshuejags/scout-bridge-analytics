import * as Sentry from '@sentry/react';

/**
 * Optional crash/error reporting — mirrors the backend's
 * utils/errorTracking.js: fully inert with zero configuration, only
 * reports once REACT_APP_SENTRY_DSN is actually provided at build time.
 * Without this, a frontend crash caught by ErrorBoundary was only ever
 * visible in a real user's own browser console.
 */
export function initErrorTracking() {
  if (!process.env.REACT_APP_SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0,
  });
}

export function captureException(error, extra) {
  if (!process.env.REACT_APP_SENTRY_DSN) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}
