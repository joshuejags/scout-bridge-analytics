#!/usr/bin/env node
const mongoose = require('mongoose');
const crypto = require('crypto');
const Video = require('../models/Video');
const workerPool = require('../utils/analysisWorkerPool');
const { persistAnalysis } = require('../controllers/analysisController');
const { emitEvent } = require('../utils/socket');

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/scout-bridge-analytics';
const POLL_INTERVAL = Number(process.env.ANALYSIS_DAEMON_POLL_MS || 2000);
const SHUTDOWN_TIMEOUT = Number(process.env.SHUTDOWN_TIMEOUT_MS || 30000);
const LEASE_HEARTBEAT_MS = Number(process.env.ANALYSIS_LEASE_HEARTBEAT_MS || 30000);
const LEASE_STALE_MS = Number(
  process.env.ANALYSIS_LEASE_STALE_MS || Math.max(LEASE_HEARTBEAT_MS * 3, 120000)
);
let shuttingDown = false;
let shutdownPromise = null;
let lastRecoveryAt = 0;
const RECOVERY_INTERVAL_MS = Number(process.env.ANALYSIS_LEASE_RECOVERY_INTERVAL_MS || 10000);

async function recoverStaleJobs() {
  const staleBefore = new Date(Date.now() - LEASE_STALE_MS);
  const result = await Video.updateMany(
    {
      status: 'processing',
      $or: [
        { processingHeartbeatAt: { $lt: staleBefore } },
        { processingHeartbeatAt: null, processingStartedAt: { $lt: staleBefore } },
        { processingHeartbeatAt: { $exists: false }, processingStartedAt: { $lt: staleBefore } },
      ],
    },
    {
      $set: {
        status: 'queued',
        lastError: 'Recovered after an analysis worker lease expired.',
        progress: 0,
      },
      $unset: {
        processingStartedAt: 1,
        processingLeaseId: 1,
        processingHeartbeatAt: 1,
      },
    }
  );

  if (result.modifiedCount > 0) {
    console.warn(
      `[analysis-daemon] Re-queued ${result.modifiedCount} stale processing job(s).`
    );
  }
  return result.modifiedCount;
}

async function processNextJob() {
  // Recover jobs whose daemon/worker disappeared. Throttle the recovery
  // query so multiple daemon replicas do not hammer MongoDB every poll.
  const now = Date.now();
  if (now - lastRecoveryAt >= RECOVERY_INTERVAL_MS) {
    lastRecoveryAt = now;
    await recoverStaleJobs();
  }

  // Atomically claim a queued video
  const video = await Video.findOneAndUpdate(
    { status: 'queued' },
    { $set: { status: 'processing', processingStartedAt: new Date(), processingHeartbeatAt: new Date(), processingLeaseId: crypto.randomUUID() } },
    { sort: { createdAt: 1 }, returnDocument: 'after' }
  );
  if (!video) return null;

  const processingLeaseId = video.processingLeaseId;
  const heartbeat = setInterval(() => {
    Video.updateOne(
      { _id: video._id, status: 'processing', processingLeaseId },
      { $set: { processingHeartbeatAt: new Date() } }
    ).catch(() => {});
  }, LEASE_HEARTBEAT_MS);
  heartbeat.unref?.();

  const PROJECT_ROOT = require('path').resolve(__dirname, '..');
  const videoPath = require('path').isAbsolute(video.filePath)
    ? video.filePath
    : require('path').join(PROJECT_ROOT, 'server', video.filePath);
  const maxFrames = process.env.ANALYZER_MAX_FRAMES ? Number(process.env.ANALYZER_MAX_FRAMES) : null;
  const thumbnailDir = require('path').join(process.env.UPLOAD_DIR || require('path').join(PROJECT_ROOT, 'server', 'uploads', 'thumbnails'), String(video._id));

  const videoIdStr = String(video._id);
  const onQueued = () => emitEvent('analysis:queued', { videoId: videoIdStr });
  const onDispatch = () => {
    emitEvent('analysis:started', { videoId: videoIdStr });
    Video.updateOne(
      { _id: video._id, status: 'processing', processingLeaseId },
      { $set: { processingHeartbeatAt: new Date() } }
    ).catch(() => {});
  };
  const onProgress = ({ frame, total, progress }) => {
    emitEvent('analysis:progress', { videoId: videoIdStr, frame, total, progress });
    if (progress != null && progress % 10 === 0) {
      Video.updateOne(
        { _id: video._id, status: 'processing', processingLeaseId },
        { $set: { progress, processingHeartbeatAt: new Date() } }
      ).catch(() => {});
    }
  };

  try {
    const result = await workerPool.submitJob(
      { videoId: videoIdStr, videoPath, maxFrames, thumbnailDir, sport: video.sport, enableJerseyOcr: true },
      { onProgress, onQueued, onDispatch }
    );
    const analysis = await persistAnalysis(video, result, processingLeaseId);
    if (!analysis) throw new Error('Analysis result could not be persisted');
    // persistAnalysis atomically clears the lease only if this worker still owns it.
    console.log(`Analysis complete for video ${video._id}`);
    emitEvent('analysis:complete', { videoId: videoIdStr, analysisId: String(analysis._id) });
    clearInterval(heartbeat);
    return { ok: true, analysisId: analysis._id };
  } catch (err) {
    console.error(`Analysis failed for video ${video._id}: ${err.message}`);
    try {
      await Video.updateOne(
        { _id: video._id, status: 'processing', processingLeaseId },
        {
          $set: { status: 'failed', lastError: err.message },
          $unset: { processingStartedAt: 1, processingLeaseId: 1, processingHeartbeatAt: 1 },
        }
      );
    } catch (saveErr) {
      console.error(`Failed to mark video ${video._id} as failed: ${saveErr.message}`);
    }
    emitEvent('analysis:failed', { videoId: videoIdStr, error: err.message });
    clearInterval(heartbeat);
    return { ok: false, error: err.message };
  }
}

async function runDaemon() {
  await mongoose.connect(MONGO);
  console.log('analysis daemon connected to mongo');
  while (!shuttingDown) {
    try {
      const res = await processNextJob();
      if (!res) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      }
    } catch (err) {
      console.error('daemon error', err);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    }
  }
}

async function shutdown(signal) {
  if (shutdownPromise) return shutdownPromise;
  shuttingDown = true;
  console.log(`[analysis-daemon] Received ${signal}; stopping new claims and draining workers...`);

  shutdownPromise = (async () => {
    const forceExit = setTimeout(() => {
      console.error('[analysis-daemon] Graceful shutdown timed out; forcing exit.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);
    forceExit.unref();

    try {
      await workerPool.shutdown();
      await mongoose.connection.close();
      clearTimeout(forceExit);
      console.log('[analysis-daemon] Workers and MongoDB closed.');
      process.exit(0);
    } catch (err) {
      console.error('[analysis-daemon] Shutdown failed:', err);
      clearTimeout(forceExit);
      process.exit(1);
    }
  })();

  return shutdownPromise;
}

if (require.main === module) {
  process.on('SIGTERM', () => { shutdown('SIGTERM'); });
  process.on('SIGINT', () => { shutdown('SIGINT'); });

  runDaemon().catch((e) => {
    console.error('daemon failed to start', e);
    process.exit(1);
  });
}

module.exports = { processNextJob, shutdown };
