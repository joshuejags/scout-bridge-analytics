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

/**
 * Keyed by authenticated user, not IP — these routes sit behind
 * requireAuth already, so req.user is always populated by the time this
 * runs, and the point is capping what a single account can do, not a
 * single network address (which IP-keying would miss for accounts behind
 * shared/corporate NAT anyway).
 */
const perUserKey = (req) => String(req.user._id);

/**
 * Uploading is real storage/bandwidth cost per request (up to
 * MAX_FILE_SIZE each) — without a cap, one account can upload unlimited
 * large files back-to-back.
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads. Try again later.' },
  keyGenerator: perUserKey,
  skip: skipInTest,
});

/**
 * Analysis runs against a small fixed worker pool (ANALYSIS_WORKER_POOL_SIZE,
 * often just 1-2) — without a cap, one account can queue enough jobs to
 * starve every other user's analyses.
 */
const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many analysis requests. Try again later.' },
  keyGenerator: perUserKey,
  skip: skipInTest,
});

module.exports = {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  uploadLimiter,
  analysisLimiter,
};
