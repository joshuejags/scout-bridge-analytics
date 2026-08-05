require('./setup');
const request = require('supertest');
const app = require('../app');

const register = async (name, email) =>
  (
    await request(app).post('/api/auth/register').send({
      name,
      email,
      password: 'password123',
    })
  ).body;

describe('Filter preset routes', () => {
  it('saves, lists, updates, and deletes filter presets for a user', async () => {
    const { token } = await register('Filter Preset User', 'filter-preset@example.com');

    const saved = await request(app)
      .post('/api/filter-presets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Scout shortlist',
        scope: 'scouting',
        filters: { stage: 'shortlist', priority: 'high', searchQuery: 'winger' },
      })
      .expect(201);

    const listed = await request(app)
      .get('/api/filter-presets')
      .query({ scope: 'scouting' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].name).toBe('Scout shortlist');

    const updated = await request(app)
      .patch(`/api/filter-presets/${saved.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Scout shortlist v2', filters: { stage: 'watchlist', priority: 'medium' } })
      .expect(200);

    expect(updated.body.name).toBe('Scout shortlist v2');
    expect(updated.body.filters.priority).toBe('medium');

    await request(app).delete(`/api/filter-presets/${saved.body._id}`).set('Authorization', `Bearer ${token}`).expect(200);

    const afterDelete = await request(app)
      .get('/api/filter-presets')
      .query({ scope: 'scouting' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(afterDelete.body).toHaveLength(0);
  });
});
