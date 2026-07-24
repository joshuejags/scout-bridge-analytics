require('./setup');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = require('../app');

const registerUser = async (email) =>
  (
    await request(app).post('/api/auth/register').send({
      name: 'Chunk Upload Tester',
      email,
      password: 'password123',
    })
  ).body;

describe('Chunked video upload', () => {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
  // A few chunks' worth of pseudo-random bytes, not a real video — these
  // endpoints only care about byte counts/assembly, not video content.
  const fileBytes = crypto.randomBytes(3 * 64 * 1024); // 192KB across 3x 64KB chunks

  const withUploadCleanup = async (fn) => {
    const before = new Set(fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : []);
    try {
      return await fn();
    } finally {
      const after = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
      after
        .filter((f) => !before.has(f) && f !== '.chunked-uploads')
        .forEach((f) => fs.unlinkSync(path.join(uploadDir, f)));
    }
  };

  const initUpload = (token, overrides = {}) =>
    request(app)
      .post('/api/videos/upload/init')
      .set('Authorization', `Bearer ${token}`)
      .send({ originalName: 'match.mp4', fileSize: fileBytes.length, ...overrides });

  const sendChunk = (token, uploadId, buf) =>
    request(app)
      .post(`/api/videos/upload/${uploadId}/chunk`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/octet-stream')
      .send(buf);

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).post('/api/videos/upload/init').send({});
    expect(res.status).toBe(401);
  });

  it('rejects init with a non-video extension', async () => {
    const { token } = await registerUser('cu1@example.com');
    const res = await initUpload(token, { originalName: 'notes.txt' });
    expect(res.status).toBe(400);
  });

  it('rejects init with a file exceeding MAX_FILE_SIZE', async () => {
    const { token } = await registerUser('cu2@example.com');
    const res = await initUpload(token, { fileSize: Number(process.env.MAX_FILE_SIZE || 500 * 1024 * 1024) + 1 });
    expect(res.status).toBe(400);
  });

  it('rejects init with an invalid sport', async () => {
    const { token } = await registerUser('cu3@example.com');
    const res = await initUpload(token, { sport: 'cricket' });
    expect(res.status).toBe(400);
  });

  it('404s on a chunk request for an unknown upload session', async () => {
    const { token } = await registerUser('cu4@example.com');
    const res = await sendChunk(token, 'does-not-exist', Buffer.from('abc'));
    expect(res.status).toBe(404);
  });

  it('404s on status/complete for an unknown upload session', async () => {
    const { token } = await registerUser('cu5@example.com');
    const statusRes = await request(app)
      .get('/api/videos/upload/does-not-exist/status')
      .set('Authorization', `Bearer ${token}`);
    expect(statusRes.status).toBe(404);

    const completeRes = await request(app)
      .post('/api/videos/upload/does-not-exist/complete')
      .set('Authorization', `Bearer ${token}`);
    expect(completeRes.status).toBe(404);
  });

  it('409s completing before all declared bytes have arrived', async () =>
    withUploadCleanup(async () => {
      const { token } = await registerUser('cu6@example.com');
      const { body } = await initUpload(token);
      // Send only the first third.
      await sendChunk(token, body.uploadId, fileBytes.subarray(0, 64 * 1024));

      const completeRes = await request(app)
        .post(`/api/videos/upload/${body.uploadId}/complete`)
        .set('Authorization', `Bearer ${token}`);
      expect(completeRes.status).toBe(409);
    }));

  it('reports bytesReceived via the status endpoint as chunks arrive', async () =>
    withUploadCleanup(async () => {
      const { token } = await registerUser('cu7@example.com');
      const { body } = await initUpload(token);

      await sendChunk(token, body.uploadId, fileBytes.subarray(0, 64 * 1024));
      const statusRes = await request(app)
        .get(`/api/videos/upload/${body.uploadId}/status`)
        .set('Authorization', `Bearer ${token}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body).toEqual({ bytesReceived: 64 * 1024, expectedSize: fileBytes.length });

      // Clean up this session's partial file directly since it's never completed.
      const tempDir = path.join(uploadDir, '.chunked-uploads');
      if (fs.existsSync(tempDir)) {
        fs.readdirSync(tempDir).forEach((f) => fs.unlinkSync(path.join(tempDir, f)));
      }
    }));

  it('assembles multiple chunks into a byte-correct file and creates the Video document', async () =>
    withUploadCleanup(async () => {
      const { token } = await registerUser('cu8@example.com');
      const { body: initBody } = await initUpload(token, {
        sport: 'basketball',
      });
      expect(initBody.uploadId).toBeTruthy();

      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < fileBytes.length; offset += chunkSize) {
        const chunkRes = await sendChunk(
          token,
          initBody.uploadId,
          fileBytes.subarray(offset, offset + chunkSize)
        );
        expect(chunkRes.status).toBe(200);
        expect(chunkRes.body.bytesReceived).toBe(Math.min(offset + chunkSize, fileBytes.length));
      }

      const completeRes = await request(app)
        .post(`/api/videos/upload/${initBody.uploadId}/complete`)
        .set('Authorization', `Bearer ${token}`);
      expect(completeRes.status).toBe(201);
      expect(completeRes.body.originalName).toBe('match.mp4');
      expect(completeRes.body.fileSize).toBe(fileBytes.length);
      expect(completeRes.body.sport).toBe('basketball');
      expect(completeRes.body.status).toBe('uploaded');

      // The assembled file on disk must match the original bytes exactly.
      const assembled = fs.readFileSync(completeRes.body.filePath);
      expect(Buffer.compare(assembled, fileBytes)).toBe(0);

      // The session is gone after completion.
      const statusRes = await request(app)
        .get(`/api/videos/upload/${initBody.uploadId}/status`)
        .set('Authorization', `Bearer ${token}`);
      expect(statusRes.status).toBe(404);
    }));

  it('rejects a chunk that would push bytesReceived past the declared fileSize', async () =>
    withUploadCleanup(async () => {
      const { token } = await registerUser('cu9@example.com');
      const { body } = await initUpload(token, { fileSize: 10 });

      const res = await sendChunk(token, body.uploadId, Buffer.alloc(20));
      expect(res.status).toBe(400);

      // Session should be aborted — a retry with a fresh session is required.
      const statusRes = await request(app)
        .get(`/api/videos/upload/${body.uploadId}/status`)
        .set('Authorization', `Bearer ${token}`);
      expect(statusRes.status).toBe(404);
    }));

  it("404s a different user trying to append a chunk to someone else's upload session", async () =>
    withUploadCleanup(async () => {
      const owner = await registerUser('cu10-owner@example.com');
      const other = await registerUser('cu10-other@example.com');
      const { body } = await initUpload(owner.token);

      const res = await sendChunk(other.token, body.uploadId, fileBytes.subarray(0, 1024));
      expect(res.status).toBe(404);
    }));

  it("404s a different user checking status or completing someone else's upload session", async () =>
    withUploadCleanup(async () => {
      const owner = await registerUser('cu11-owner@example.com');
      const other = await registerUser('cu11-other@example.com');
      const { body } = await initUpload(owner.token);

      const statusRes = await request(app)
        .get(`/api/videos/upload/${body.uploadId}/status`)
        .set('Authorization', `Bearer ${other.token}`);
      expect(statusRes.status).toBe(404);

      const completeRes = await request(app)
        .post(`/api/videos/upload/${body.uploadId}/complete`)
        .set('Authorization', `Bearer ${other.token}`);
      expect(completeRes.status).toBe(404);

      // The owner's session is untouched by the other user's failed attempts.
      const ownerStatusRes = await request(app)
        .get(`/api/videos/upload/${body.uploadId}/status`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(ownerStatusRes.status).toBe(200);
    }));
});
