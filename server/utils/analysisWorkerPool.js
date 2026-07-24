const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Mirrors the path-resolution comment in analysisController.js: this file
// lives in server/utils/, so PROJECT_ROOT assumes a full repo checkout
// (true for local dev), overridable via env for Docker (only server/ is
// copied into the image there).
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const PYTHON_BIN =
  process.env.PYTHON_BIN ||
  (process.platform === 'win32'
    ? path.join(PROJECT_ROOT, 'venv', 'Scripts', 'python.exe')
    : path.join(PROJECT_ROOT, 'venv', 'bin', 'python'));

const CV_DIR = process.env.CV_DIR || path.join(PROJECT_ROOT, 'server', 'cv');
const WORKER_SCRIPT = path.join(CV_DIR, 'worker.py');

// How many analyses can genuinely run at once. Spawning a fresh analyzer
// process per request had no concurrency control at all — N simultaneous
// uploads meant N simultaneous cold YOLO/torch/EasyOCR inits competing for
// the same CPU cores. A small fixed pool bounds that, and doubles as the
// "job queue" this module exists to provide: jobs beyond POOL_SIZE just
// wait their turn instead of piling onto the machine unbounded.
const POOL_SIZE = process.env.ANALYSIS_WORKER_POOL_SIZE
  ? Number(process.env.ANALYSIS_WORKER_POOL_SIZE)
  : 2;

let nextJobId = 1;
const workers = []; // { proc, ready, busy, stdoutTail }
const pendingQueue = []; // jobs waiting for a free ready worker
const activeJobs = new Map(); // jobId -> job, while a worker is running it
let shuttingDown = false;

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
  if (!job) return; // stale message for a job we've already given up on

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

  // The worker's own logger.info/warning calls (from video_analyzer.py's
  // module-level logging config) land here — informational only, the
  // structured progress/result/error protocol is entirely on stdout.
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
    // Fail any job this worker was holding rather than leaving it hanging.
    for (const [jobId, job] of activeJobs) {
      if (job.worker === workerState) {
        activeJobs.delete(jobId);
        job.reject(new Error('Analysis worker exited unexpectedly'));
      }
    }
    // Keep the pool at full size so one crashed worker doesn't permanently
    // shrink capacity, unless the whole server is going down.
    if (!shuttingDown) spawnWorker();
  });

  workers.push(workerState);
  return workerState;
}

/**
 * Spawn the pool now rather than waiting for the first real job, so a
 * user's first upload doesn't pay the ~2-3s EasyOCR init cold start —
 * that cost is paid once here, at server startup, instead.
 */
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

/**
 * Queue an analysis job and return a Promise resolving to the analyzer's
 * result dict (the same shape the old per-request spawn produced). Callers
 * get three optional hooks: onQueued (no worker was free at submit time),
 * onDispatch (a worker just picked this job up), and onProgress (periodic
 * frame-count updates while it runs).
 */
function submitJob(params, { onProgress, onQueued, onDispatch } = {}) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(WORKER_SCRIPT)) {
      return reject(new Error(`Analyzer worker script not found at ${WORKER_SCRIPT}`));
    }
    warmUp(); // no-op if already warm; lazily starts the pool otherwise

    const jobId = String(nextJobId++);
    const hasIdleWorker = workers.some((w) => w.ready && !w.busy);
    if (!hasIdleWorker && onQueued) onQueued();

    pendingQueue.push({ jobId, params, onProgress, onDispatch, resolve, reject });
    dispatchNext();
  });
}

function shutdown() {
  shuttingDown = true;
  workers.forEach((w) => {
    try {
      w.proc.kill();
    } catch (e) {
      // already gone
    }
  });
}

module.exports = { submitJob, warmUp, shutdown };
