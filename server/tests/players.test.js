require('./setup');
const request = require('supertest');
const app = require('../app');

const registerAdmin = async (email) =>
  (
    await request(app).post('/api/auth/register').send({
      name: 'Player Tester',
      email,
      password: 'password123',
    })
  ).body;

describe('Players API', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/players');
    expect(res.status).toBe(401);
  });

  it('creates a player without a team', async () => {
    const { token } = await registerAdmin('p1@example.com');
    const res = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sam Striker', position: 'Forward', jerseyNumber: 9 });
    expect(res.status).toBe(201);
    expect(res.body.jerseyNumber).toBe(9);
  });

  it('rejects a jersey number outside 0-99', async () => {
    const { token } = await registerAdmin('p2@example.com');
    const res = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad Number', jerseyNumber: 150 });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid team reference', async () => {
    const { token } = await registerAdmin('p3@example.com');
    const res = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad Team Ref', team: 'not-an-id' });
    expect(res.status).toBe(400);
  });

  it('creates a player linked to a real team and populates it on fetch', async () => {
    const { token } = await registerAdmin('p4@example.com');
    const team = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Linked FC' });

    const player = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Linked Player', team: team.body._id });
    expect(player.status).toBe(201);

    const fetched = await request(app)
      .get(`/api/players/${player.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(fetched.body.team.name).toBe('Linked FC');
  });

  it('updates a player', async () => {
    const { token } = await registerAdmin('p5@example.com');
    const player = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Original Name' });

    const updated = await request(app)
      .put(`/api/players/${player.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Updated Name');
  });

  it('blocks a non-admin from deleting a player', async () => {
    // First registration in this test's DB becomes admin; register a
    // second account which will default to scout.
    await registerAdmin('p6-admin@example.com');
    const scout = await registerAdmin('p6-scout@example.com');

    const player = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${scout.token}`)
      .send({ name: 'Protected Player' });

    const del = await request(app)
      .delete(`/api/players/${player.body._id}`)
      .set('Authorization', `Bearer ${scout.token}`);
    expect(del.status).toBe(403);
  });
});
