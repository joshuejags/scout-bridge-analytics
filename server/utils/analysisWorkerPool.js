/**
 * Analysis Worker Pool - BullMQ-based implementation with Redis persistence
 *
 * This module provides a backward-compatible API for submitting analysis jobs.
 * Jobs are now persisted in Redis via BullMQ, providing durability across restarts,
 * automatic retry logic with exponential backoff, and proper error handling.
 *
 * The submitJob() API is unchanged; existing callers in analysisController.js
 * and analysisDaemon.js continue to work transparently.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Configuration: Redis backend for job persistence
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_DB = process.env.REDIS_DB || 0;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// Fallback to in-memory mode if Redis is not available (for backward compatibility)
// This can be disabled via DISABLE_FALLBACK_MODE=true
const FALLBACK_MODE_ENABLED = process.env.DISABLE_FALLBACK_MODE !== 'true';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CV_DIR = process.env.CV_DIR || path.join(PROJECT_ROOT, 'server', 'cv');
const WORKER_SCRIPT = path.join(CV_DIR, 'worker.py');

const PYTHON_BIN =
  process.env.PYTHON_BIN ||
  (process.platform === 'win32'
    ? path.join(PROJECT_ROOT, 'venv', 'Scripts', 'python.exe')
    : path.join(PROJECT_ROOT, 'venv', 'bin', 'python'));

const POOL_SIZE = process.env.ANALYSIS_WORKER_POOL_SIZE
  ? Number(process.env.ANALYSIS_WORKER_POOL_SIZE)
  : 2;

const MAX_QUEUE_LENGTH = process.env.ANALYSIS_QUEUE_MAX
  ? Number(process.env.ANALYSIS_QUEUE_MAX)
  : 20;

let useBullMQ = false;
let bullmqQueue = null;

// In-memory fallback for when Redis is unavailable
let nextJobId = 1;
const workers = [];
const pendingQueue = [];
const activeJobs = new Map();
let shuttingDown = false;

/**
 * Initialize BullMQ backend if Redis is available, otherwise use in-memory pool
 */
async function ensureInitialized() {
  if (useBullMQ || bullmqQueue) return;

  try {
    // Attempt to use BullMQ + Redis
    const bullmq = require('bullmq');
    const redis = require('redis');

    // Quick Redis connectivity check
    const testClient = redis.createClient({
      host: REDIS_HOST,
      port: REDIS_PORT,
      ...(REDIS_PASSWORD && { password: REDIS_PASSWORD }),
      db: REDIS_DB,
      connectTimeout: 2000,
      retryStrategy: () => null, // fail fast on timeout
    });

    await new Promise((resolve, reject) => {
      testClient.on('ready', resolve);
      testClient.on('error', reject);
      setTimeout(() => reject(new Error('Redis connection timeout')), 3000);
    });

    testClient.quit();

    // Redis is available, initialize BullMQ
    bullmqQueue = require('./bullmqQueue');
    await bullmqQueue.initializeQueue();
    await bullmqQueue.startWorker();
    useBullMQ = true;
    console.log('[analysisWorkerPool] Using BullMQ backend with Redis persistence');
  } catch (err) {
    if (!FALLBACK_MODE_ENABLED) {
      throw new Error(`[analysisWorkerPool] Redis/BullMQ unavailable and fallback disabled: ${err.message}`);
    }
    console.warn(`[analysisWorkerPool] Redis/BullMQ unavailable, falling back to in-memory pool: ${err.message}`);
    useBullMQ = false;
    bullmqQueue = null;
    // Initialize in-memory pool as fallback
    warmUp();
  }
}

// ========================
// In-memory pool fallback (used when Redis is unavailable)
// ========================

function handleWorkerMessage(workerState, msg) {
  if (msg.type === 'ready') {
    workerState.ready = true;
    dispatchNext();
    return;
  }
  if (msg.type === 'workerLog') {
    console.log(`[analysis-worker] ${msg.message}`);
    return;
  }

  const job = activeJobs.get(msg.jobId);
  if (!job) return;

  if (msg.type === 'progress') {
    if (job.onProgress) {
      const progress =
        msg.total > 0 ? Math.min(99, Math.round((msg.frame / msg.total) * 100)) : null;
      job.onProgress({ frame: msg.frame, total: msg.total, progress });
    }
    return;
  }
  if (msg.type === 'result') {
    activeJobs.delete(msg.jobId);
    workerState.busy = false;
    job.resolve(msg.data);
    dispatchNext();
    return;
  }
  if (msg.type === 'error') {
    activeJobs.delete(msg.jobId);
    workerState.busy = false;
    job.reject(new Error(msg.message));
    dispatchNext();
    return;
  }
}

function spawnWorker() {
  const proc = spawn(PYTHON_BIN, [WORKER_SCRIPT], {
    cwd: CV_DIR,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    windowsHide: true,
  });

  const workerState = { proc, ready: false, busy: false, stdoutTail: '' };

  proc.stdout.on('data', (b) => {
    workerState.stdoutTail += b.toString();
    const lines = workerState.stdoutTail.split('\n');
    workerState.stdoutTail = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch (e) {
        continue;
      }
      handleWorkerMessage(workerState, msg);
    }
  });

  proc.stderr.on('data', (b) => {
    const str = b.toString().trim();
    if (str) console.log(`[analysis-worker] ${str}`);
  });

  proc.on('error', (err) => {
    console.error(`[analysis-worker] failed to spawn: ${err.message}`);
  });

  proc.on('exit', (code) => {
    const idx = workers.indexOf(workerState);
    if (idx !== -1) workers.splice(idx, 1);
    if (workerState.busy) {
      console.error(`[analysis-worker] exited unexpectedly (code ${code}) mid-job`);
    }
    for (const [jobId, job] of activeJobs) {
      if (job.worker === workerState) {
        activeJobs.delete(jobId);
        job.reject(new Error('Analysis worker exited unexpectedly'));
      }
    }
    if (!shuttingDown) spawnWorker();
  });

  workers.push(workerState);
  return workerState;
}

function warmUp() {
  if (!fs.existsSync(WORKER_SCRIPT)) {
    console.warn(
      `[analysis-worker] worker script not found at ${WORKER_SCRIPT}; analysis requests will fail until it's available`
    );
    return;
  }
  while (workers.length < POOL_SIZE) spawnWorker();
}

function dispatchNext() {
  if (pendingQueue.length === 0) return;
  const idleWorker = workers.find((w) => w.ready && !w.busy);
  if (!idleWorker) return;

  const job = pendingQueue.shift();
  idleWorker.busy = true;
  job.worker = idleWorker;
  activeJobs.set(job.jobId, job);
  if (job.onDispatch) job.onDispatch();

  idleWorker.proc.stdin.write(
    JSON.stringify({
      jobId: job.jobId,
      videoPath: job.params.videoPath,
      maxFrames: job.params.maxFrames,
      thumbnailDir: job.params.thumbnailDir,
      sport: job.params.sport,
      enableJerseyOcr: job.params.enableJerseyOcr,
    }) + '\n'
  );
}

// ========================
// Unified API (routing to BullMQ or in-memory)
// ========================

/**
 * Submit an analysis job. Returns a Promise resolving to the analyzer result.
 * Transparently uses BullMQ if Redis is available, otherwise in-memory pool.
 */
async function submitJob(params, { onProgress, onQueued, onDispatch } = {}) {
  await ensureInitialized();

  if (useBullMQ && bullmqQueue) {
    // BullMQ path: job is persistent and queued in Redis
    try {
      return await bullmqQueue.submitJob(params);
    } catch (err) {
      // If BullMQ fails, fall back to in-memory (if enabled)
      if (!FALLBACK_MODE_ENABLED) throw err;
      console.warn(`[analysisWorkerPool] BullMQ submission failed, falling back: ${err.message}`);
      useBullMQ = false;
      return submitJobInMemory(params, { onProgress, onQueued, onDispatch });
    }
  } else {
    // In-memory path (fallback or when Redis unavailable)
    return submitJobInMemory(params, { onProgress, onQueued, onDispatch });
  }
}

function submitJobInMemory(params, { onProgress, onQueued, onDispatch } = {}) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(WORKER_SCRIPT)) {
      return reject(new Error(`Analyzer worker script not found at ${WORKER_SCRIPT}`));
    }
    if (pendingQueue.length >= MAX_QUEUE_LENGTH) {
      return reject(
        new Error('Analysis queue is full right now — try again in a few minutes.')
      );
    }
    warmUp();

    const jobId = String(nextJobId++);
    const hasIdleWorker = workers.some((w) => w.ready && !w.busy);
    if (!hasIdleWorker && onQueued) onQueued();

    pendingQueue.push({ jobId, params, onProgress, onDispatch, resolve, reject });
    dispatchNext();
  });
}

async function shutdown() {
  shuttingDown = true;

  if (useBullMQ && bullmqQueue) {
    await bullmqQueue.shutdown();
  }

  workers.forEach((w) => {
    try {
      w.proc.kill();
    } catch (e) {
      // already gone
    }
  });
}

function warmUpSync() {
  if (!useBullMQ) warmUp();
}

module.exports = { submitJob, warmUp: warmUpSync, shutdown };
