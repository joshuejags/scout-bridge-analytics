const nodemailer = require('nodemailer');

/**
 * Email sending abstraction with a pluggable transport:
 *
 * - If SMTP_HOST/SMTP_USER/SMTP_PASS are set, sends via that real SMTP
 *   server (any provider — SES, SendGrid, Postmark, a self-hosted relay —
 *   all speak SMTP).
 * - Otherwise, logs the email to the console instead of sending it. This
 *   is deliberate, not a stub to fill in later: this project has no mail
 *   provider credentials configured anywhere, and a "silently pretend it
 *   sent" fallback would be worse than an honest one that's loud about
 *   what it's doing. Local dev and CI both hit this path — the reset/
 *   verify link is printed so the flow is still testable end-to-end
 *   without real email infrastructure.
 */
function buildTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return null;
}

let cachedTransport;
function getTransport() {
  if (cachedTransport === undefined) {
    cachedTransport = buildTransport();
  }
  return cachedTransport;
}

/**
 * Resets the cached transport so tests (or a runtime env var change) can
 * force re-evaluation of SMTP_* config.
 */
function resetTransportCache() {
  cachedTransport = undefined;
}

async function sendMail({ to, subject, text, html }) {
  const transport = getTransport();
  const from = process.env.SMTP_FROM || 'Scout Bridge Analytics <no-reply@scout-bridge.local>';

  if (!transport) {
    console.log(
      `[email:console-fallback] No SMTP_HOST/SMTP_USER/SMTP_PASS configured — ` +
        `printing email instead of sending.\n  To: ${to}\n  Subject: ${subject}\n  Body:\n${text}`
    );
    return { delivered: false, reason: 'no-smtp-configured' };
  }

  await transport.sendMail({ from, to, subject, text, html });
  return { delivered: true };
}

module.exports = { sendMail, resetTransportCache };
