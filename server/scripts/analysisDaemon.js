#!/usr/bin/env node
const mongoose = require('mongoose');
const Video = require('../models/Video');
const workerPool = require('../utils/analysisWorkerPool');
const { persistAnalysis } = require('../controllers/analysisController');
const { emitEvent } = require('../utils/socket');

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/scoutbridge';
const POLL_INTERVAL = Number(process.env.ANALYSIS_DAEMON_POLL_MS || 2000);

async function processNextJob() {
  // Atomically claim a queued video
  const video = await Video.findOneAndUpdate(
    { status: 'queued' },
    { $set: { status: 'processing', processingStartedAt: new Date() } },
    { sort: { createdAt: 1 }, returnDocument: 'after' }
  );
  if (!video) return null;

  const PROJECT_ROOT = require('path').resolve(__dirname, '..');
  const videoPath = require('path').isAbsolute(video.filePath)
    ? video.filePath
    : require('path').join(PROJECT_ROOT, 'server', video.filePath);
  const maxFrames = process.env.ANALYZER_MAX_FRAMES ? Number(process.env.ANALYZER_MAX_FRAMES) : null;
  const thumbnailDir = require('path').join(process.env.UPLOAD_DIR || require('path').join(PROJECT_ROOT, 'server', 'uploads', 'thumbnails'), String(video._id));

  const videoIdStr = String(video._id);
  const onProgress = ({ frame, total, progress }) => {
    emitEvent('analysis:progress', { videoId: videoIdStr, frame, total, progress });
    if (progress != null && progress % 10 === 0) {
      Video.updateOne({ _id: video._id }, { progress }).catch(() => {});
    }
  };

  try {
    const result = await workerPool.submitJob(
      { videoPath, maxFrames, thumbnailDir, sport: video.sport, enableJerseyOcr: true },
      { onProgress }
    );
    const analysis = await persistAnalysis(video, result);
    console.log(`Analysis complete for video ${video._id}`);
    emitEvent('analysis:complete', { videoId: videoIdStr, analysisId: String(analysis._id) });
    return { ok: true, analysisId: analysis._id };
  } catch (err) {
    console.error(`Analysis failed for video ${video._id}: ${err.message}`);
    try {
      const fresh = await Video.findById(video._id);
      if (fresh) {
        fresh.status = 'failed';
        fresh.lastError = err.message;
        await fresh.save();
      }
    } catch (saveErr) {
      console.error(`Failed to mark video ${video._id} as failed: ${saveErr.message}`);
    }
    emitEvent('analysis:failed', { videoId: videoIdStr, error: err.message });
    return { ok: false, error: err.message };
  }
}

async function runDaemon() {
  await mongoose.connect(MONGO);
  console.log('analysis daemon connected to mongo');
  while (true) {
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

if (require.main === module) {
  runDaemon().catch((e) => {
    console.error('daemon failed to start', e);
    process.exit(1);
  });
}

module.exports = { processNextJob };
