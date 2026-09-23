require('./setup');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
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

    const dbError = new Error('simulated Mongo connection blip');
    jest.spyOn(Video, 'findById').mockRejectedValueOnce(dbError);

    const res = await request(app)
      .post(`/api/analysis/${videoId}/process`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'simulated Mongo connection blip' });
  });

  it('still returns 404 for a non-owned video once the DB call succeeds normally', async () => {
    const { token } = await registerUser('crash-fix-control@example.com');
    const videoId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post(`/api/analysis/${videoId}/process`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Video not found' });
  });
});

describe('reconcileOrphanedJobs — recovery after API/worker restart', () => {
  const makeVideo = (status, extra = {}) =>
    Video.create({
      filename: `${status}-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`,
      originalName: 'test.mp4',
      fileSize: 1000,
      filePath: '/tmp/does-not-matter.mp4',
      status,
      ...extra,
    });

  it('leaves queued jobs durable, re-queues stale processing jobs, and leaves other statuses untouched', async () => {
    const queued = await makeVideo('queued');

    // processingStartedAt is older than the default 30-minute recovery
    // window, so this job is treated as abandoned and returned to queued.
    const staleProcessing = await makeVideo('processing', {
      processingStartedAt: new Date(Date.now() - 31 * 60 * 1000),
      processingHeartbeatAt: new Date(Date.now() - 31 * 60 * 1000),
      processingLeaseId: 'stale-worker',
    });

    const freshProcessing = await makeVideo('processing', {
      processingStartedAt: new Date(Date.now() - 31 * 60 * 1000),
      processingHeartbeatAt: new Date(),
      processingLeaseId: 'live-worker',
    });

    const uploaded = await makeVideo('uploaded');
    const analyzed = await makeVideo('analyzed');
    const alreadyFailed = await makeVideo('failed');

    const count = await reconcileOrphanedJobs();
    expect(count).toBe(1);

    const [
      freshQueued,
      recoveredProcessing,
      untouchedProcessing,
      freshUploaded,
      freshAnalyzed,
      freshFailed,
    ] = await Promise.all(
      [queued, staleProcessing, freshProcessing, uploaded, analyzed, alreadyFailed].map((v) =>
        Video.findById(v._id)
      )
    );

    expect(freshQueued.status).toBe('queued');
    expect(recoveredProcessing.status).toBe('queued');
    expect(recoveredProcessing.processingStartedAt).toBeNull();
    expect(recoveredProcessing.lastError).toBeNull();
    expect(untouchedProcessing.status).toBe('processing');
    expect(untouchedProcessing.processingLeaseId).toBe('live-worker');
    expect(freshUploaded.status).toBe('uploaded');
    expect(freshAnalyzed.status).toBe('analyzed');
    expect(freshFailed.status).toBe('failed');
    expect(freshFailed.lastError).toBeNull();
  });

  it('is a no-op when nothing is stale', async () => {
    await makeVideo('queued');
    await makeVideo('processing', {
      processingStartedAt: new Date(),
      processingHeartbeatAt: new Date(),
      processingLeaseId: 'live-worker',
    });
    await makeVideo('uploaded');
    await makeVideo('analyzed');

    const count = await reconcileOrphanedJobs();
    expect(count).toBe(0);
  });
});

describe('Analysis persistence invariant', () => {
  it('rejects a second analysis for the same video', async () => {
    const video = await Video.create({
      filename: `analysis-unique-${Date.now()}.mp4`,
      originalName: 'analysis-unique.mp4',
      fileSize: 1000,
      filePath: '/tmp/does-not-matter.mp4',
      status: 'uploaded',
    });

    await Analysis.create({
      video: video._id,
      playerData: [],
      ballData: { trackingData: [], possessionStats: [] },
      actions: [],
      heatmapData: { grid: [], cellSize: 50 },
      tacticalData: { teams: [] },
      summary: {
        totalPlayers: 0,
        matchDuration: 0,
        highlightedMoments: [],
        qualityFlag: null,
      },
    });

    await expect(
      Analysis.create({
        video: video._id,
        playerData: [],
        ballData: { trackingData: [], possessionStats: [] },
        actions: [],
        heatmapData: { grid: [], cellSize: 50 },
        tacticalData: { teams: [] },
        summary: {
          totalPlayers: 0,
          matchDuration: 0,
          highlightedMoments: [],
          qualityFlag: null,
        },
      })
    ).rejects.toMatchObject({ code: 11000 });

    expect(await Analysis.countDocuments({ video: video._id })).toBe(1);
  });
});
