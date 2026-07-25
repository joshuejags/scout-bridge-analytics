require('./setup');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Exercises videoController/chunkedUploads' wiring to the storage
// abstraction without needing to actually flip STORAGE_BACKEND=s3 (which
// utils/storage.js reads once at module-load time — reconfiguring that
// mid-test-run would mean resetting the whole app module graph). Mocking
// the module directly is more surgical: it proves the *wiring* is correct
// (Video.filePath/storageBackend reflect whatever storeFile returns)
// independent of storage.js's own S3 behavior, which utils/storage.test.js
// already covers in isolation.
jest.mock('../utils/storage', () => ({
  storeFile: jest.fn(),
  deleteObject: jest.fn().mockResolvedValue(undefined),
  pipeObjectToResponse: jest.fn(),
  isCloudBackend: jest.fn(() => false),
  getBackendName: jest.fn(() => 'local'),
}));

const app = require('../app');
const storage = require('../utils/storage');

const registerUser = async (email) =>
  (
    await request(app).post('/api/auth/register').send({
      name: 'Storage Wiring Tester',
      email,
      password: 'password123',
    })
  ).body;

describe('Video storage backend wiring', () => {
  const dummyVideoPath = path.join(os.tmpdir(), 'sba-storage-wiring-test.mp4');

  beforeAll(() => {
    fs.writeFileSync(dummyVideoPath, Buffer.from('not a real video, just bytes for multer'));
  });

  afterAll(() => {
    fs.unlinkSync(dummyVideoPath);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records storageBackend and filePath from what storeFile returns (single-shot upload)', async () => {
    storage.storeFile.mockResolvedValue({ backend: 's3', key: '169999-clip.mp4', localPath: null });
    const { token } = await registerUser('wiring1@example.com');

    const res = await request(app)
      .post('/api/videos/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('video', dummyVideoPath);

    expect(res.status).toBe(201);
    expect(res.body.storageBackend).toBe('s3');
    expect(res.body.filePath).toBe('169999-clip.mp4');
    // storeFile must be called with the local path multer actually wrote
    // to and the same filename the Video document ends up recording.
    expect(storage.storeFile).toHaveBeenCalledWith(
      expect.stringContaining(res.body.filename),
      res.body.filename
    );
  });

  it('falls back to the local path when storeFile reports the local backend', async () => {
    storage.storeFile.mockImplementation(async (localPath, key) => ({
      backend: 'local',
      key,
      localPath,
    }));
    const { token } = await registerUser('wiring2@example.com');

    const res = await request(app)
      .post('/api/videos/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('video', dummyVideoPath);

    expect(res.status).toBe(201);
    expect(res.body.storageBackend).toBe('local');
    expect(res.body.filePath).toContain(res.body.filename);

    // Clean up the real local file multer actually wrote, since this
    // path's storeFile mock doesn't move/delete it (mirrors real local
    // behavior — see storage.test.js for the no-op contract).
    if (fs.existsSync(res.body.filePath)) fs.unlinkSync(res.body.filePath);
  });

  it('calls storage.deleteObject (not fs.unlink) when deleting an s3-backed video', async () => {
    // storeFile's real (s3) implementation always uses the key it was
    // *called* with as the S3 object key — uploadVideo calls it with
    // req.file.filename, so that's what deleteVideo must later pass to
    // deleteObject too. Echoing the real key back here (rather than an
    // unrelated fixed string) keeps the mock honest about that contract.
    storage.storeFile.mockImplementation(async (localPath, key) => ({
      backend: 's3',
      key,
      localPath: null,
    }));
    const { token } = await registerUser('wiring3@example.com');

    const upload = await request(app)
      .post('/api/videos/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('video', dummyVideoPath);

    const del = await request(app)
      .delete(`/api/videos/${upload.body._id}`)
      .set('Authorization', `Bearer ${token}`); // first registered user in this test is admin
    expect(del.status).toBe(200);
    expect(storage.deleteObject).toHaveBeenCalledWith(upload.body.filename);
  });
});
