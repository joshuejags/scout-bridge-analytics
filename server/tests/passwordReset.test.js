require('./setup');
const request = require('supertest');

// Capture outgoing emails instead of hitting the console-fallback or real
// SMTP, and to extract the raw token (which is never persisted anywhere
// queryable — only its SHA-256 hash is stored on the User document).
jest.mock('../utils/email', () => ({
  sendMail: jest.fn().mockResolvedValue({ delivered: false }),
}));

const app = require('../app');
const User = require('../models/User');
const { sendMail } = require('../utils/email');

const extractTokenFromLastEmail = () => {
  const call = sendMail.mock.calls[sendMail.mock.calls.length - 1];
  const text = call[0].text;
  const match = text.match(/token=([a-f0-9]+)/);
  return match ? match[1] : null;
};

beforeEach(() => {
  sendMail.mockClear();
});

const registerUser = async (email = 'reset@example.com') =>
  request(app).post('/api/auth/register').send({
    name: 'Reset Tester',
    email,
    password: 'originalpass123',
  });

describe('Email verification', () => {
  it('sends a verification email on register and the user starts unverified', async () => {
    const res = await registerUser();
    expect(res.body.user.emailVerified).toBe(false);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toBe('reset@example.com');
    expect(sendMail.mock.calls[0][0].subject).toMatch(/verify/i);
  });

  it('verifies the email with a valid token', async () => {
    await registerUser();
    const token = extractTokenFromLastEmail();
    expect(token).toBeTruthy();

    const res = await request(app).post('/api/auth/verify-email').send({ token });
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(true);

    const stored = await User.findOne({ email: 'reset@example.com' });
    expect(stored.emailVerified).toBe(true);
  });

  it('rejects an invalid token', async () => {
    await registerUser();
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'not-a-real-token' });
    expect(res.status).toBe(400);
  });

  it('rejects a token that has already been used', async () => {
    await registerUser();
    const token = extractTokenFromLastEmail();

    const first = await request(app).post('/api/auth/verify-email').send({ token });
    expect(first.status).toBe(200);

    const second = await request(app).post('/api/auth/verify-email').send({ token });
    expect(second.status).toBe(400);
  });

  it('resend-verification issues a new token and requires auth', async () => {
    const noAuth = await request(app).post('/api/auth/resend-verification');
    expect(noAuth.status).toBe(401);

    const reg = await registerUser();
    sendMail.mockClear();

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('resend-verification rejects an already-verified account', async () => {
    const reg = await registerUser();
    const token = extractTokenFromLastEmail();
    await request(app).post('/api/auth/verify-email').send({ token });

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(400);
  });
});

describe('Email delivery resilience', () => {
  // sendMail() itself never throws (see utils/email.js) — these confirm
  // the callers actually handle a real ({ delivered: false, reason:
  // 'send-error' }) failure result correctly, not just the happy path.
  const sendFailure = { delivered: false, reason: 'send-error', error: 'Connection refused' };

  it('register still creates the account and returns 201 even if the verification email fails to send', async () => {
    sendMail.mockResolvedValueOnce(sendFailure);
    const res = await registerUser('emailfail@example.com');

    expect(res.status).toBe(201);
    expect(res.body.emailDelivered).toBe(false);
    const stored = await User.findOne({ email: 'emailfail@example.com' });
    expect(stored).not.toBeNull();
  });

  it('resend-verification reports the failure (502) instead of falsely claiming success', async () => {
    const reg = await registerUser();
    sendMail.mockResolvedValueOnce(sendFailure);

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(502);
  });

  it('forgot-password still returns the same 200 for a real account even if the email fails to send — no enumeration leak via status code', async () => {
    await registerUser('forgotfail@example.com');
    sendMail.mockResolvedValueOnce(sendFailure);

    const resReal = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'forgotfail@example.com' });
    const resFake = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'no-such-account@example.com' });

    expect(resReal.status).toBe(200);
    expect(resFake.status).toBe(200);
    expect(resReal.body).toEqual(resFake.body);
  });
});

describe('Password reset', () => {
  it('forgot-password sends a reset email for an existing account', async () => {
    await registerUser();
    sendMail.mockClear();

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@example.com' });

    expect(res.status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].subject).toMatch(/reset/i);
  });

  it('forgot-password returns 200 for a nonexistent email without sending mail (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('resets the password with a valid token and the new password works for login', async () => {
    await registerUser();
    await request(app).post('/api/auth/forgot-password').send({ email: 'reset@example.com' });
    const token = extractTokenFromLastEmail();
    expect(token).toBeTruthy();

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'brandnewpass123' });
    expect(resetRes.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'originalpass123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'brandnewpass123' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects an invalid reset token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'garbage', password: 'brandnewpass123' });
    expect(res.status).toBe(400);
  });

  it('rejects a reset token that has already been used', async () => {
    await registerUser();
    await request(app).post('/api/auth/forgot-password').send({ email: 'reset@example.com' });
    const token = extractTokenFromLastEmail();

    const first = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'brandnewpass123' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'anotherpass456' });
    expect(second.status).toBe(400);
  });

  it('rejects a new password shorter than 8 characters', async () => {
    await registerUser();
    await request(app).post('/api/auth/forgot-password').send({ email: 'reset@example.com' });
    const token = extractTokenFromLastEmail();

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'short' });
    expect(res.status).toBe(400);
  });
});
