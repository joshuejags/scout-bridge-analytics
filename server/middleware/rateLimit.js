const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// The test suite registers/logs in dozens of times per run from the same
// local IP; rate limiting is a production concern (express-rate-limit
// itself is already tested upstream) so it's disabled under test rather
// than forcing tests to work around artificial limits.
const skipInTest = () => process.env.NODE_ENV === 'test';

/**
 * Login is the classic brute-force target: an attacker with a password
 * list can otherwise try unlimited combinations against a known email.
 * Keyed by IP + the submitted email so one attacker can't lock out a
 * legitimate user by spamming failed logins against their address from a
 * different IP, while still capping any single (IP, email) pair.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a few minutes.' },
  keyGenerator: (req, res) => `${ipKeyGenerator(req, res)}:${(req.body?.email || '').toLowerCase()}`,
  skip: skipInTest,
});

/**
 * Registration is less sensitive than login (no credential to guess) but
 * still worth capping to slow down mass fake-account creation from a
 * single source.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many accounts created from this address. Try again later.' },
  skip: skipInTest,
});

/**
 * forgot-password sends an email per request and always returns 200
 * regardless of whether the account exists (to avoid leaking which emails
 * are registered) — without a limit, that same property makes it a free
 * mechanism to spam an arbitrary inbox with reset emails. Keyed by IP +
 * submitted email for the same reason as login.
 */
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Try again in a few minutes.' },
  keyGenerator: (req, res) => `${ipKeyGenerator(req, res)}:${(req.body?.email || '').toLowerCase()}`,
  skip: skipInTest,
});

module.exports = { loginLimiter, registerLimiter, forgotPasswordLimiter };
