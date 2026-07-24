require('./setup');
const request = require('supertest');
const app = require('../app');

const registerAndLogin = async (email, isFirst = false) => {
  // The very first user registered in a fresh test DB becomes admin; to
  // reliably get a 'scout' account, register an admin first when needed.
  if (!isFirst) {
    await request(app).post('/api/auth/register').send({
      name: 'Bootstrap Admin',
      email: 'bootstrap-admin@example.com',
      password: 'password123',
    });
  }
  const res = await request(app).post('/api/auth/register').send({
    name: 'Team Tester',
    email,
    password: 'password123',
  });
  return { token: res.body.token, user: res.body.user };
};

describe('Teams API', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(401);
  });

  it('creates and lists a team', async () => {
    const { token } = await registerAndLogin('scout1@example.com');

    const create = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Riverside FC' });
    expect(create.status).toBe(201);
    expect(create.body.name).toBe('Riverside FC');

    const list = await request(app).get('/api/teams').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects creating a team with an empty name', async () => {
    const { token } = await registerAndLogin('scout2@example.com');
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a well-formed but nonexistent team id', async () => {
    const { token } = await registerAndLogin('scout3@example.com');
    const res = await request(app)
      .get('/api/teams/000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed team id', async () => {
    const { token } = await registerAndLogin('scout4@example.com');
    const res = await request(app)
      .get('/api/teams/not-an-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('allows a scout to create but not delete a team', async () => {
    const { token } = await registerAndLogin('scout5@example.com');
    const create = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Deletable FC' });

    const del = await request(app)
      .delete(`/api/teams/${create.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(403);
  });

  it('allows an admin to delete a team', async () => {
    const { token } = await registerAndLogin('admin-only@example.com', true);
    const create = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Deletable By Admin FC' });

    const del = await request(app)
      .delete(`/api/teams/${create.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
  });
});
