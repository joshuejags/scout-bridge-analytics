require('./setup');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

jest.mock('../utils/videoUrlImport');
const videoUrlImport = require('../utils/videoUrlImport');

const app = require('../app');
const Video = require('../models/Video');

const registerUser = async (email) =>
  (
    await request(app).post('/api/auth/register').send({
      name: 'Import Tester',
      email,
      password: 'password123',
    })
  ).body;

// The background job (videoController.runUrlImport) isn't awaited by the
// request handler - it starts right after the 202 response is sent, same
// as analysisController's queue-then-report-over-socket pattern. These
// tests give it a moment to finish against the mocked import before
// asserting on the resulting Video document.
const waitFor = async (check, { timeoutMs = 2000, intervalMs = 20 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await check();
    if (result) return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('waitFor: condition not met in time');
};

describe('POST /api/videos/import-url', () => {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a non-http(s) url with 400', async () => {
    const { token } = await registerUser('import-badurl@example.com');
    const res = await request(app)
      .post('/api/videos/import-url')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(videoUrlImport.importFromUrl).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/videos/import-url').send({ url: 'https://youtube.com/watch?v=x' });
    expect(res.status).toBe(401);
  });

  it('creates the video with status importing and responds 202 immediately', async () => {
    videoUrlImport.importFromUrl.mockImplementation(() => new Promise(() => {})); // never resolves in this test
    const { token } = await registerUser('import-pending@example.com');

    const res = await request(app)
      .post('/api/videos/import-url')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', sport: 'basketball' });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('importing');
    expect(res.body.sourceUrl).toBe('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    expect(res.body.sport).toBe('basketball');
  });

  it('moves the video to uploaded once the download resolves', async () => {
    const downloadedPath = path.join(uploadDir, 'import-test-fixture.mp4');
    fs.writeFileSync(downloadedPath, Buffer.from('not a real video, just bytes'));

    videoUrlImport.importFromUrl.mockResolvedValue({
      filePath: downloadedPath,
      title: 'A Real Match Highlight',
      duration: 120,
      width: 1280,
      height: 720,
      extractor: 'youtube',
    });

    const { token } = await registerUser('import-success@example.com');
    const res = await request(app)
      .post('/api/videos/import-url')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' });

    const videoId = res.body._id;
    const updated = await waitFor(async () => {
      const video = await Video.findById(videoId);
      return video.status !== 'importing' ? video : null;
    });

    expect(updated.status).toBe('uploaded');
    expect(updated.originalName).toBe('A Real Match Highlight');
    expect(updated.duration).toBe(120);
    expect(updated.metadata.width).toBe(1280);

    fs.unlinkSync(downloadedPath);
  });

  it('marks the video failed with lastError when the download rejects', async () => {
    videoUrlImport.importFromUrl.mockRejectedValue(new Error('video is 9000s long, over the 3600s limit'));

    const { token } = await registerUser('import-failure@example.com');
    const res = await request(app)
      .post('/api/videos/import-url')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' });

    const videoId = res.body._id;
    const updated = await waitFor(async () => {
      const video = await Video.findById(videoId);
      return video.status === 'failed' ? video : null;
    });

    expect(updated.lastError).toBe('video is 9000s long, over the 3600s limit');
  });
});
