const express = require('express');
const request = require('supertest');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// This suite verifies the rate-limiting *mechanism* itself works as wired
// (trips after N requests, keys by IP+email, resets are independent per
// key) using a throwaway low-limit app, rather than the real
// loginLimiter/registerLimiter (which are skipped under NODE_ENV=test and
// have production-sized windows that would make a real trip-over test
// slow/impractical). The actual middleware/rateLimit.js config (windowMs,
// limit, keyGenerator) is exercised for real in server/app.js at runtime.

const buildApp = (limiterOptions) => {
  const app = express();
  app.use(express.json());
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    standardHeaders: true,
    legacyHeaders: false,
    ...limiterOptions,
  });
  app.post('/test-endpoint', limiter, (req, res) => res.status(200).json({ ok: true }));
  return app;
};

describe('Rate limiting mechanism', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp({ limit: 3 });
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/test-endpoint').send({});
      expect(res.status).toBe(200);
    }
  });

  it('blocks requests once the limit is exceeded', async () => {
    const app = buildApp({ limit: 3, message: { error: 'rate limited' } });
    for (let i = 0; i < 3; i++) {
      await request(app).post('/test-endpoint').send({});
    }
    const blocked = await request(app).post('/test-endpoint').send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('rate limited');
  });

  it('keys independently by IP + email, so different emails from the same client are not cross-blocked', async () => {
    const app = buildApp({
      limit: 1,
      keyGenerator: (req, res) => `${ipKeyGenerator(req, res)}:${req.body?.email || ''}`,
    });

    const first = await request(app).post('/test-endpoint').send({ email: 'a@example.com' });
    expect(first.status).toBe(200);

    // Same "IP" (supertest uses one client), different email: should NOT be blocked.
    const differentEmail = await request(app).post('/test-endpoint').send({ email: 'b@example.com' });
    expect(differentEmail.status).toBe(200);

    // Same email again: should now be blocked.
    const sameEmailAgain = await request(app).post('/test-endpoint').send({ email: 'a@example.com' });
    expect(sameEmailAgain.status).toBe(429);
  });
});
