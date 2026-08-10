require('./setup');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Video = require('../models/Video');
const Team = require('../models/Team');
const Player = require('../models/Player');

jest.setTimeout(20000);

describe('Admin routes - jobs', () => {
  let token;
  beforeEach(async () => {
    // create admin user and token
    const user = new User({ name: 'Admin', email: 'admin@example.com', password: 'password123', role: 'admin' });
    await user.save();
    token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  });

  it('returns platform summary metrics for the admin portal', async () => {
    await Team.create({ name: 'United FC' });
    const team = await Team.findOne({ name: 'United FC' });
    await Player.create({ name: 'Sam Striker', team: team._id, position: 'Forward', jerseyNumber: 9 });
    await User.create({
      name: 'Scout User',
      email: 'scout@example.com',
      password: 'password123',
      role: 'scout',
      emailVerified: false,
    });
    await Video.create([
      { originalName: 'a.mp4', filename: 'a.mp4', fileSize: 10, filePath: 'a.mp4', status: 'failed' },
      { originalName: 'b.mp4', filename: 'b.mp4', fileSize: 10, filePath: 'b.mp4', status: 'queued' },
    ]);

    const res = await request(app)
      .get('/api/admin/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.users.total).toBe(2);
    expect(res.body.users.byRole.admin).toBe(1);
    expect(res.body.users.byRole.scout).toBe(1);
    expect(res.body.content.teams).toBe(1);
    expect(res.body.content.players).toBe(1);
    expect(res.body.jobs.failed).toBe(1);
    expect(res.body.jobs.queued).toBe(1);
    expect(Array.isArray(res.body.recentVideos)).toBe(true);
  });

  it('lists jobs filtered by state', async () => {
    await Video.create([{ originalName: 'a.mp4', filename: 'a.mp4', fileSize: 10, filePath: 'a.mp4', status: 'failed' }, { originalName: 'b.mp4', filename: 'b.mp4', fileSize: 10, filePath: 'b.mp4', status: 'queued' }]);

    const res = await request(app)
      .get('/api/admin/jobs?state=failed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].status).toBe('failed');
  });

  it('retries a failed job by id', async () => {
    const v = await Video.create({ originalName: 'c.mp4', filename: 'c.mp4', fileSize: 10, filePath: 'c.mp4', status: 'failed', lastError: 'boom' });

    const res = await request(app)
      .post(`/api/admin/jobs/${v._id}/retry`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    const reloaded = await Video.findById(v._id);
    expect(reloaded.status).toBe('queued');
    expect(reloaded.lastError).toBeNull();
  });
});
