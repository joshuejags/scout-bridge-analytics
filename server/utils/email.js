const nodemailer = require('nodemailer');

/**
 * Email sending abstraction with a pluggable transport, checked in this
 * order:
 *
 * - If RESEND_API_KEY is set, sends through Resend's API (the recommended
 *   provider for this project; see the Email section in README.md for
 *   setup).
 * - Else if SMTP_HOST/SMTP_USER/SMTP_PASS are set, sends via that SMTP
 *   server (any provider that speaks SMTP, including Gmail with an app
 *   password, SES, SendGrid, Postmark, or a self-hosted relay).
 * - Otherwise, logs the email to the console instead of sending it. This
 *   is deliberate, not a stub to fill in later: local dev and CI both hit
 *   this path, and the reset/verify link is printed so the flow stays
 *   testable end to end without real email infrastructure.
 */
function buildTransport() {
  const { RESEND_API_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (RESEND_API_KEY) {
    const { Resend } = require('resend');
    return { type: 'resend', client: new Resend(RESEND_API_KEY) };
  }

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return {
      type: 'smtp',
      client: nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      }),
    };
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
 * force re-evaluation of RESEND_API_KEY / SMTP_* config.
 */
function resetTransportCache() {
  cachedTransport = undefined;
}

/**
 * Never throws — callers (register/resendVerification/forgotPassword) must
 * be able to treat email delivery as best-effort. Any transient failure
 * (bad credentials, connection refused, provider rate limit) is caught and
 * reported instead of raising, since for forgotPassword specifically, a
 * 500-vs-200 difference here would leak whether the email belonged to a
 * real account, undermining the anti-enumeration guarantee the always-200
 * response is there for.
 */
async function sendMail({ to, subject, text, html }) {
  const transport = getTransport();
  const from = process.env.SMTP_FROM || 'Scout Bridge Analytics <no-reply@scout-bridge.local>';

  if (!transport) {
    console.log(
      `[email:console-fallback] No RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS configured, ` +
        `printing email instead of sending.\n  To: ${to}\n  Subject: ${subject}\n  Body:\n${text}`
    );
    return { delivered: false, reason: 'no-smtp-configured' };
  }

  if (transport.type === 'resend') {
    console.log(`[email:send] Sending "${subject}" to ${to} via Resend...`);
    try {
      const { data, error } = await transport.client.emails.send({ from, to, subject, text, html });
      if (error) {
        console.error(`[email:failed] Could not send "${subject}" to ${to}: ${error.message}`);
        return { delivered: false, reason: 'send-error', error: error.message };
      }
      console.log(`[email:sent] "${subject}" to ${to}, id=${data.id}`);
      return { delivered: true, messageId: data.id };
    } catch (error) {
      console.error(`[email:failed] Could not send "${subject}" to ${to}: ${error.message}`);
      return { delivered: false, reason: 'send-error', error: error.message };
    }
  }

  console.log(`[email:send] Sending "${subject}" to ${to} via ${process.env.SMTP_HOST}...`);
  try {
    const info = await transport.client.sendMail({ from, to, subject, text, html });
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
 * Checks the configured provider without sending a real email. This is the
 * "confirm delivery status" ask, for whoever's configuring a real
 * provider to sanity-check credentials before relying on them. Returns
 * null (not false) when nothing is configured at all, distinct from
 * "configured but broken".
 */
async function verifySmtpConnection() {
  const transport = getTransport();
  if (!transport) return null;

  if (transport.type === 'resend') {
    try {
      const { error } = await transport.client.domains.list();
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  try {
    await transport.client.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { sendMail, resetTransportCache, verifySmtpConnection };
