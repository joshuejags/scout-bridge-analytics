const Sentry = require('@sentry/node');

/**
 * Optional crash/error reporting — same "safe no-op when unconfigured"
 * pattern as utils/email.js's console-fallback and utils/storage.js's
 * local backend: nothing breaks with zero configuration, real reporting
 * only once SENTRY_DSN is actually provided. Without this, a production
 * crash or elevated error rate was only visible to someone tailing live
 * console output.
 */
let initialized = false;

function init() {
  if (!process.env.SENTRY_DSN) {
    console.log(
      '[error-tracking] No SENTRY_DSN configured — errors are only logged to the console.'
    );
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Error reporting only, not performance tracing — keep this cheap and
    // predictable rather than sampling request traces by default.
    tracesSampleRate: 0,
  });
  initialized = true;
  console.log('[error-tracking] Sentry initialized.');
}

function captureException(error, extra) {
  if (initialized) Sentry.captureException(error, extra ? { extra } : undefined);
}

module.exports = { init, captureException };
