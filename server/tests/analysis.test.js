require('./setup');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Video = require('../models/Video');
const { reconcileOrphanedJobs } = require('../controllers/analysisController');

const registerUser = async (email) =>
  (
    await request(app).post('/api/auth/register').send({
      name: 'Analysis Tester',
      email,
      password: 'password123',
    })
  ).body;

describe('POST /api/analysis/:videoId/process — crash-path handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a clean 500 instead of crashing when a DB call throws before the response is sent', async () => {
    const { token } = await registerUser('crash-fix@example.com');
    const videoId = new mongoose.Types.ObjectId().toString();

    // processAnalysis's very first line (before any response is sent) is
    // `await Video.findById(videoId)`. Prior to the fix, that whole
    // pre-response block had no try/catch — Express 4 doesn't catch async
    // rejections, so this exact failure became an unhandled promise
    // rejection capable of crashing the whole Node process for every user,
    // not just returning an error for this one request. If that guard is
    // ever removed again, this request hangs or Jest surfaces an unhandled
    // rejection instead of the assertions below ever running.
    const dbError = new Error('simulated Mongo connection blip');
    jest.spyOn(Video, 'findById').mockRejectedValueOnce(dbError);

    const res = await request(app)
      .post(`/api/analysis/${videoId}/process`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'simulated Mongo connection blip' });
  });

  it('still returns 404 for a non-owned video once the DB call succeeds normally', async () => {
    // Sanity check alongside the crash-path test above: confirms the new
    // try/catch didn't change ordinary (non-throwing) behavior.
    const { token } = await registerUser('crash-fix-control@example.com');
    const videoId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post(`/api/analysis/${videoId}/process`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Video not found' });
  });
});

describe('reconcileOrphanedJobs — startup recovery from a lost in-memory queue', () => {
  const makeVideo = (status) =>
    Video.create({
      filename: `${status}-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`,
      originalName: 'test.mp4',
      fileSize: 1000,
      filePath: '/tmp/does-not-matter.mp4',
      status,
    });

  it('marks queued/processing videos as failed with a clear reason, and leaves other statuses untouched', async () => {
    // analysisWorkerPool's queue is purely in-memory (see its own module
    // comment) — a server restart loses any job it was holding, silently
    // leaving the video stuck exactly at whichever of these two statuses
    // it was in. Since this simulates that: no worker pool involved, just
    // Video documents sitting in these states when reconciliation runs.
    const queued = await makeVideo('queued');
    const processing = await makeVideo('processing');
    const uploaded = await makeVideo('uploaded');
    const analyzed = await makeVideo('analyzed');
    const alreadyFailed = await makeVideo('failed');

    const count = await reconcileOrphanedJobs();
    expect(count).toBe(2);

    const [freshQueued, freshProcessing, freshUploaded, freshAnalyzed, freshFailed] =
      await Promise.all(
        [queued, processing, uploaded, analyzed, alreadyFailed].map((v) => Video.findById(v._id))
      );

    expect(freshQueued.status).toBe('failed');
    expect(freshQueued.lastError).toBe(
      'Processing was interrupted by a server restart. Please try again.'
    );
    expect(freshProcessing.status).toBe('failed');
    expect(freshProcessing.lastError).toBe(
      'Processing was interrupted by a server restart. Please try again.'
    );

    // Untouched: reconciliation only ever affects queued/processing.
    expect(freshUploaded.status).toBe('uploaded');
    expect(freshAnalyzed.status).toBe('analyzed');
    expect(freshFailed.status).toBe('failed');
    expect(freshFailed.lastError).toBeNull();
  });

  it('is a no-op (returns 0) when nothing is stuck', async () => {
    await makeVideo('uploaded');
    await makeVideo('analyzed');

    const count = await reconcileOrphanedJobs();
    expect(count).toBe(0);
  });
});
