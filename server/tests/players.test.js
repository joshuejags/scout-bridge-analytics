require('./setup');
const request = require('supertest');
const app = require('../app');
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');

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

describe('Player comparison (GET /api/players/compare)', () => {
  const makeVideo = async () =>
    Video.create({
      filename: `${Date.now()}-${Math.random()}.mp4`,
      originalName: 'match.mp4',
      fileSize: 1024,
      filePath: '/tmp/does-not-matter.mp4',
      status: 'analyzed',
    });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/players/compare?ids=a,b');
    expect(res.status).toBe(401);
  });

  it('rejects fewer than two ids', async () => {
    const { token } = await registerAdmin('cmp1@example.com');
    const player = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Solo' });

    const res = await request(app)
      .get(`/api/players/compare?ids=${player.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('rejects a malformed id', async () => {
    const { token } = await registerAdmin('cmp2@example.com');
    const res = await request(app)
      .get('/api/players/compare?ids=not-an-id,also-not-an-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('404s when one of the ids does not exist', async () => {
    const { token } = await registerAdmin('cmp3@example.com');
    const player = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Real Player' });
    const fakeId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .get(`/api/players/compare?ids=${player.body._id},${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('aggregates distance, sprints, speed, and actions across multiple analyses', async () => {
    const { token } = await registerAdmin('cmp4@example.com');

    const p1 = (
      await request(app)
        .post('/api/players')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Aggregate Player One', jerseyNumber: 7 })
    ).body;
    const p2 = (
      await request(app)
        .post('/api/players')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Aggregate Player Two', jerseyNumber: 11 })
    ).body;

    const video1 = await makeVideo();
    const video2 = await makeVideo();

    // Player 1 appears in both matches; player 2 only in the second.
    await Analysis.create({
      video: video1._id,
      playerData: [
        {
          playerId: p1._id,
          trackId: '1',
          verified: true,
          statistics: { distanceCovered: 1000, averageSpeed: 5, sprintCount: 3, activationArea: 'Center' },
        },
      ],
      actions: [
        { type: 'shot', playerId: '1', frameNumber: 10, confidence: 0.9 },
        { type: 'pass', playerId: '1', frameNumber: 20, confidence: 0.8 },
      ],
    });

    await Analysis.create({
      video: video2._id,
      playerData: [
        {
          playerId: p1._id,
          trackId: '1',
          verified: true,
          statistics: { distanceCovered: 2000, averageSpeed: 7, sprintCount: 5, activationArea: 'Center' },
        },
        {
          playerId: p2._id,
          trackId: '2',
          verified: false,
          statistics: { distanceCovered: 1500, averageSpeed: 6, sprintCount: 2, activationArea: 'Left' },
        },
      ],
      actions: [
        { type: 'tackle', playerId: '2', frameNumber: 15, confidence: 0.7 },
      ],
    });

    const res = await request(app)
      .get(`/api/players/compare?ids=${p1._id},${p2._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const [result1, result2] = res.body;
    expect(result1.player.name).toBe('Aggregate Player One');
    expect(result1.matchesPlayed).toBe(2);
    expect(result1.totalDistanceCovered).toBe(3000);
    expect(result1.averageDistancePerMatch).toBe(1500);
    expect(result1.totalSprints).toBe(8);
    expect(result1.actions).toEqual({ pass: 1, shot: 1, tackle: 0, interception: 0 });
    expect(result1.totalActions).toBe(2);
    expect(result1.verifiedTracks).toBe(2);

    expect(result2.player.name).toBe('Aggregate Player Two');
    expect(result2.matchesPlayed).toBe(1);
    expect(result2.totalDistanceCovered).toBe(1500);
    expect(result2.actions).toEqual({ pass: 0, shot: 0, tackle: 1, interception: 0 });
    expect(result2.verifiedTracks).toBe(0);
  });
});
