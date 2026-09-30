require('./setup');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

describe('POST /api/auth/register', () => {
  it('creates an account and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Ada Scout',
      email: 'ada@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('ada@example.com');
    expect(res.body.user.password).toBeUndefined();
  });

  it('makes the first registered user an admin', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'First User',
      email: 'first@example.com',
      password: 'password123',
    });
    expect(res.body.user.role).toBe('admin');
  });

  it('makes subsequent users scouts by default, unless a role is provided', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'First User',
      email: 'first@example.com',
      password: 'password123',
    });

    const defaultRes = await request(app).post('/api/auth/register').send({
      name: 'Second User',
      email: 'second@example.com',
      password: 'password123',
    });
    expect(defaultRes.body.user.role).toBe('scout');

    const teamRes = await request(app).post('/api/auth/register').send({
      name: 'Team User',
      email: 'team-user@example.com',
      password: 'password123',
      role: 'team',
    });
    expect(teamRes.body.user.role).toBe('team');
  });

  it('rejects unsupported account types during signup', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Bad Role User',
      email: 'bad-role@example.com',
      password: 'password123',
      role: 'mentor',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid account type/i);
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Ada',
      email: 'dup@example.com',
      password: 'password123',
    });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Ada Again',
      email: 'dup@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(409);
  });

  it('rejects an invalid email with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Ada',
      email: 'not-an-email',
      password: 'password123',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Ada',
      email: 'short@example.com',
      password: 'abc',
    });
    expect(res.status).toBe(400);
  });

  it('stores a bcrypt hash, not the plaintext password', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Ada',
      email: 'hash@example.com',
      password: 'password123',
    });
    const stored = await User.findOne({ email: 'hash@example.com' }).select('+password');
    expect(stored.password).not.toBe('password123');
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Login Test',
      email: 'login@example.com',
      password: 'password123',
    });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('is case-insensitive on email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'LOGIN@EXAMPLE.COM',
      password: 'password123',
    });
    expect(res.status).toBe(200);
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a nonexistent email with 401 (not 404, to avoid leaking which emails exist)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Me Test',
      email: 'me@example.com',
      password: 'password123',
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@example.com');
  });

  it('rejects a missing token with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed token with 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });
});
