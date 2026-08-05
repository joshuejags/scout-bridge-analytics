const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const Video = require('../models/Video');

jest.setTimeout(20000);

describe('Admin routes - jobs', () => {
  let token;
  beforeEach(async () => {
    // create admin user and token
    const user = new User({ name: 'Admin', email: 'admin@example.com', password: 'password123', role: 'admin' });
    await user.save();
    token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
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
