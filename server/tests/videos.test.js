require('./setup');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');
const app = require('../app');

const registerUser = async (email) =>
  (
    await request(app).post('/api/auth/register').send({
      name: 'Video Tester',
      email,
      password: 'password123',
    })
  ).body;

describe('Video upload — sport field', () => {
  const dummyVideoPath = path.join(os.tmpdir(), 'sba-test-video.mp4');
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');

  beforeAll(() => {
    fs.writeFileSync(dummyVideoPath, Buffer.from('not a real video, just bytes for multer'));
  });

  afterAll(() => {
    fs.unlinkSync(dummyVideoPath);
  });

  // multer's disk storage writes the file before express-validator's body
  // checks run, so even a request this suite expects to be *rejected* (bad
  // sport value) still leaves a real file in server/uploads/. Snapshotting
  // the directory around each request and removing whatever appeared keeps
  // this suite from littering the real (non-test-database) uploads folder.
  const withUploadCleanup = async (fn) => {
    const before = new Set(fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : []);
    try {
      return await fn();
    } finally {
      const after = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
      after.filter((f) => !before.has(f)).forEach((f) => fs.unlinkSync(path.join(uploadDir, f)));
    }
  };

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/videos');
    expect(res.status).toBe(401);
  });

  it('defaults sport to soccer when not provided', async () =>
    withUploadCleanup(async () => {
      const { token } = await registerUser('v1@example.com');
      const res = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('video', dummyVideoPath);
      expect(res.status).toBe(201);
      expect(res.body.sport).toBe('soccer');
    }));

  it('accepts a valid sport value', async () =>
    withUploadCleanup(async () => {
      const { token } = await registerUser('v2@example.com');
      const res = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('sport', 'basketball')
        .attach('video', dummyVideoPath);
      expect(res.status).toBe(201);
      expect(res.body.sport).toBe('basketball');
    }));

  it('rejects an invalid sport value', async () =>
    withUploadCleanup(async () => {
      const { token } = await registerUser('v3@example.com');
      const res = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('sport', 'cricket')
        .attach('video', dummyVideoPath);
      expect(res.status).toBe(400);
    }));
});
