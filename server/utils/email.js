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

/**
 * Never throws — callers (register/resendVerification/forgotPassword) must
 * be able to treat email delivery as best-effort. Previously this awaited
 * transport.sendMail() directly with no try/catch, so any transient SMTP
 * failure (bad credentials, connection refused, provider rate limit) would
 * 500 the whole request even though the account/token had already been
 * saved — and for forgotPassword specifically, that 500-vs-200 difference
 * would leak whether the email belonged to a real account, undermining the
 * anti-enumeration guarantee the always-200 response is there for.
 */
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

  console.log(`[email:send] Sending "${subject}" to ${to} via ${process.env.SMTP_HOST}...`);
  try {
    const info = await transport.sendMail({ from, to, subject, text, html });
    // messageId/response come straight from the SMTP provider — the
    // concrete "did this actually leave our server" confirmation the
    // previous version had no way to show.
    console.log(
      `[email:sent] "${subject}" to ${to} — messageId=${info.messageId} response="${info.response}"`
    );
    return { delivered: true, messageId: info.messageId };
  } catch (error) {
    console.error(
      `[email:failed] Could not send "${subject}" to ${to}: ${error.message}` +
        (error.code ? ` (code=${error.code})` : '') +
        (error.responseCode ? ` (SMTP ${error.responseCode}: ${error.response})` : '')
    );
    return { delivered: false, reason: 'send-error', error: error.message };
  }
}

/**
 * Checks SMTP connectivity/auth without sending a real email — the
 * "confirm delivery status" ask, for whoever's configuring a real
 * provider to sanity-check credentials before relying on them. Returns
 * null (not false) when no SMTP is configured at all, distinct from
 * "configured but broken".
 */
async function verifySmtpConnection() {
  const transport = getTransport();
  if (!transport) return null;
  try {
    await transport.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { sendMail, resetTransportCache, verifySmtpConnection };
