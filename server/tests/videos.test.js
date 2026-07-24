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

  it("scopes an upload's owner to the authenticated user, ignoring any uploadedBy the client sends", async () =>
    withUploadCleanup(async () => {
      const { token } = await registerUser('v4@example.com');
      const res = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('uploadedBy', 'someone-else@attacker.example')
        .attach('video', dummyVideoPath);
      expect(res.status).toBe(201);
      expect(res.body.uploadedBy).toBe('v4@example.com');
    }));
});

describe('Video data isolation — user A cannot see or fetch user B\'s videos', () => {
  const dummyVideoPath = path.join(os.tmpdir(), 'sba-isolation-test-video.mp4');
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');

  beforeAll(() => {
    fs.writeFileSync(dummyVideoPath, Buffer.from('not a real video, just bytes for multer'));
  });

  afterAll(() => {
    fs.unlinkSync(dummyVideoPath);
  });

  const withUploadCleanup = async (fn) => {
    const before = new Set(fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : []);
    try {
      return await fn();
    } finally {
      const after = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
      after.filter((f) => !before.has(f)).forEach((f) => fs.unlinkSync(path.join(uploadDir, f)));
    }
  };

  // The very first account registered in a fresh DB is auto-promoted to
  // admin (see authController.js) — register a throwaway one first so
  // userA/userB below are both ordinary, unprivileged scouts, which is the
  // actual bug report: a normal signed-up user seeing another normal
  // user's videos, not an admin's (separately-intended) full visibility.
  const setupTwoScouts = async () => {
    await registerUser('iso-admin-bootstrap@example.com');
    const userA = await registerUser('iso-userA@example.com');
    const userB = await registerUser('iso-userB@example.com');
    return { userA, userB };
  };

  it('user B does not see user A\'s video in the video list', async () =>
    withUploadCleanup(async () => {
      const { userA, userB } = await setupTwoScouts();
      await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${userA.token}`)
        .attach('video', dummyVideoPath);

      const listAsA = await request(app).get('/api/videos').set('Authorization', `Bearer ${userA.token}`);
      expect(listAsA.body).toHaveLength(1);

      const listAsB = await request(app).get('/api/videos').set('Authorization', `Bearer ${userB.token}`);
      expect(listAsB.body).toHaveLength(0);
    }));

  it('user B gets 404 fetching user A\'s video by id directly', async () =>
    withUploadCleanup(async () => {
      const { userA, userB } = await setupTwoScouts();
      const uploadRes = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${userA.token}`)
        .attach('video', dummyVideoPath);
      const videoId = uploadRes.body._id;

      const asOwner = await request(app)
        .get(`/api/videos/${videoId}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(asOwner.status).toBe(200);

      const asOther = await request(app)
        .get(`/api/videos/${videoId}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(asOther.status).toBe(404);
    }));

  it('user B gets 404 fetching user A\'s raw video file from /uploads', async () =>
    withUploadCleanup(async () => {
      const { userA, userB } = await setupTwoScouts();
      const uploadRes = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${userA.token}`)
        .attach('video', dummyVideoPath);
      const filename = uploadRes.body.filename;

      const asOwner = await request(app)
        .get(`/uploads/${filename}`)
        .set('Authorization', `Bearer ${userA.token}`);
      expect(asOwner.status).toBe(200);

      const asOther = await request(app)
        .get(`/uploads/${filename}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(asOther.status).toBe(404);
    }));

  it('user B cannot trigger or read analysis for user A\'s video', async () =>
    withUploadCleanup(async () => {
      const { userA, userB } = await setupTwoScouts();
      const uploadRes = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${userA.token}`)
        .attach('video', dummyVideoPath);
      const videoId = uploadRes.body._id;

      const processAsOther = await request(app)
        .post(`/api/analysis/${videoId}/process`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(processAsOther.status).toBe(404);

      const getAnalysisAsOther = await request(app)
        .get(`/api/analysis/${videoId}`)
        .set('Authorization', `Bearer ${userB.token}`);
      expect(getAnalysisAsOther.status).toBe(404);
    }));

  it('an admin can still see and fetch every user\'s videos', async () =>
    withUploadCleanup(async () => {
      const admin = await registerUser('iso-admin2@example.com'); // first registered -> admin
      const userA = await registerUser('iso-userA2@example.com');
      const uploadRes = await request(app)
        .post('/api/videos/upload')
        .set('Authorization', `Bearer ${userA.token}`)
        .attach('video', dummyVideoPath);
      const videoId = uploadRes.body._id;

      const listAsAdmin = await request(app)
        .get('/api/videos')
        .set('Authorization', `Bearer ${admin.token}`);
      expect(listAsAdmin.body.map((v) => v._id)).toContain(videoId);

      const getAsAdmin = await request(app)
        .get(`/api/videos/${videoId}`)
        .set('Authorization', `Bearer ${admin.token}`);
      expect(getAsAdmin.status).toBe(200);
    }));
});
