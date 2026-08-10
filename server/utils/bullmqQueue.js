const { Queue, Worker, QueueEvents } = require('bullmq');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Configuration: use Redis backend for job persistence
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_DB = process.env.REDIS_DB || 0;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// BullMQ queue configuration
const CONNECTION = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  db: REDIS_DB,
  ...(REDIS_PASSWORD && { password: REDIS_PASSWORD }),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CV_DIR = process.env.CV_DIR || path.join(PROJECT_ROOT, 'server', 'cv');
const WORKER_SCRIPT = path.join(CV_DIR, 'worker.py');

const PYTHON_BIN =
  process.env.PYTHON_BIN ||
  (process.platform === 'win32'
    ? path.join(PROJECT_ROOT, 'venv', 'Scripts', 'python.exe')
    : path.join(PROJECT_ROOT, 'venv', 'bin', 'python'));

// Queue concurrency: how many jobs can run in parallel (bounded by CPU cores + torch/YOLO resources)
const QUEUE_CONCURRENCY = process.env.ANALYSIS_WORKER_POOL_SIZE
  ? Number(process.env.ANALYSIS_WORKER_POOL_SIZE)
  : 2;

// Job timeout (ms): if a job runs longer than this, it's marked failed
const JOB_TIMEOUT = process.env.ANALYSIS_JOB_TIMEOUT
  ? Number(process.env.ANALYSIS_JOB_TIMEOUT)
  : 1800000; // 30 minutes

// Max attempts before moving job to DLQ (Dead Letter Queue)
const JOB_MAX_ATTEMPTS = process.env.ANALYSIS_JOB_MAX_ATTEMPTS
  ? Number(process.env.ANALYSIS_JOB_MAX_ATTEMPTS)
  : 3;

let analysisQueue = null;
let worker = null;
let queueEvents = null;
let isShuttingDown = false;

/**
 * Initialize the BullMQ-based analysis queue.
 * Returns the queue instance for direct use (testing, monitoring).
 */
async function initializeQueue() {
  if (analysisQueue) {
    console.log('[analysisQueue] Queue already initialized');
    return analysisQueue;
  }

  try {
    // Create the queue with retry and backoff configuration
    analysisQueue = new Queue('analysis', {
      connection: CONNECTION,
      defaultJobOptions: {
        attempts: JOB_MAX_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: 2000, // start at 2s, exponentially increase
        },
        removeOnComplete: {
          age: 3600, // keep completed jobs for 1 hour
        },
        removeOnFail: false, // keep failed jobs for debugging
      },
    });

    // Queue events listener for debugging/monitoring
    queueEvents = new QueueEvents('analysis', { connection: CONNECTION });

    queueEvents.on('waiting', ({ jobId }) => {
      console.log(`[analysisQueue] Job ${jobId} is waiting to be processed`);
    });

    queueEvents.on('active', ({ jobId }) => {
      console.log(`[analysisQueue] Job ${jobId} is now being processed`);
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`[analysisQueue] Job ${jobId} progress:`, data);
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`[analysisQueue] Job ${jobId} completed successfully`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`[analysisQueue] Job ${jobId} failed: ${failedReason}`);
    });

    queueEvents.on('error', (err) => {
      console.error(`[analysisQueue] QueueEvents error:`, err);
    });

    console.log(`[analysisQueue] Initialized with ${QUEUE_CONCURRENCY} concurrent workers`);
    return analysisQueue;
  } catch (err) {
    console.error('[analysisQueue] Failed to initialize queue:', err);
    throw err;
  }
}

/**
 * Start the worker that processes analysis jobs.
 * The worker spawns Python analysis processes.
 */
async function startWorker() {
  if (worker) {
    console.log('[analysisWorker] Worker already running');
    return worker;
  }

  if (!fs.existsSync(WORKER_SCRIPT)) {
    throw new Error(`Worker script not found at ${WORKER_SCRIPT}`);
  }

  try {
    worker = new Worker(
      'analysis',
      async (job) => {
        return processAnalysisJob(job);
      },
      {
        connection: CONNECTION,
        concurrency: QUEUE_CONCURRENCY,
      }
    );

    worker.on('completed', (job) => {
      console.log(`[analysisWorker] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[analysisWorker] Job ${job.id} failed after ${job.attemptsMade} attempts:`, err.message);
    });

    worker.on('error', (err) => {
      console.error('[analysisWorker] Worker error:', err);
    });

    console.log('[analysisWorker] Worker started');
    return worker;
  } catch (err) {
    console.error('[analysisWorker] Failed to start worker:', err);
    throw err;
  }
}

/**
 * Process a single analysis job by spawning the Python worker process.
 * The job data contains video analysis parameters.
 */
async function processAnalysisJob(job) {
  return new Promise((resolve, reject) => {
    const { videoPath, maxFrames, thumbnailDir, sport, enableJerseyOcr } = job.data;

    console.log(`[analysisWorker] Processing job ${job.id}: ${videoPath}`);

    // Spawn Python worker process for this job
    const proc = spawn(PYTHON_BIN, [WORKER_SCRIPT], {
      cwd: CV_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      windowsHide: true,
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let result = null;

    // Handle stdout from Python worker
    proc.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'progress') {
            // Update job progress
            const progress = msg.total > 0 ? Math.min(99, Math.round((msg.frame / msg.total) * 100)) : null;
            job.progress(progress);
          } else if (msg.type === 'result') {
            result = msg.data;
          }
        } catch (e) {
          // Non-JSON output, log as-is
          console.log(`[analysisWorker] ${line}`);
        }
      }
    });

    // Handle stderr from Python worker
    proc.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      const line = data.toString().trim();
      if (line) console.log(`[analysisWorker] stderr: ${line}`);
    });

    // Handle process errors
    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn analysis worker: ${err.message}`));
    });

    // Handle process exit
    proc.on('exit', (code) => {
      if (code === 0 && result) {
        resolve(result);
      } else {
        reject(new Error(`Analysis worker exited with code ${code}`));
      }
    });

    // Send job parameters to the worker
    const jobInput = {
      jobId: job.id,
      videoPath,
      maxFrames,
      thumbnailDir,
      sport,
      enableJerseyOcr,
    };

    proc.stdin.write(JSON.stringify(jobInput) + '\n');
  });
}

/**
 * Submit an analysis job to the queue.
 * Returns a promise that resolves when the job completes successfully.
 */
async function submitJob(params) {
  if (!analysisQueue) {
    throw new Error('Queue not initialized. Call initializeQueue() first.');
  }

  try {
    const job = await analysisQueue.add('analyze', params, {
      jobId: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      priority: 5,
    });

    console.log(`[analysisQueue] Job ${job.id} submitted to queue`);

    // Wait for job completion with timeout
    const result = await job.waitUntilFinished(queueEvents, JOB_TIMEOUT);
    return result;
  } catch (err) {
    if (err.message.includes('timeout')) {
      throw new Error('Analysis job timed out - try again later');
    }
    throw err;
  }
}

/**
 * Get job status by ID (for monitoring/UI updates).
 */
async function getJobStatus(jobId) {
  if (!analysisQueue) {
    return null;
  }

  try {
    const job = await analysisQueue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      state: await job.getState(),
      progress: job.progress(),
      data: job.data,
      attempts: job.attemptsMade,
      failedReason: job.failedReason,
    };
  } catch (err) {
    console.error(`[analysisQueue] Error fetching job ${jobId}:`, err);
    return null;
  }
}

/**
 * Get queue statistics (for monitoring).
 */
async function getQueueStats() {
  if (!analysisQueue) {
    return null;
  }

  try {
    return {
      waiting: await analysisQueue.count('waiting'),
      active: await analysisQueue.count('active'),
      completed: await analysisQueue.count('completed'),
      failed: await analysisQueue.count('failed'),
      delayed: await analysisQueue.count('delayed'),
    };
  } catch (err) {
    console.error('[analysisQueue] Error fetching stats:', err);
    return null;
  }
}

/**
 * Graceful shutdown: drain pending jobs and close connections.
 */
async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('[analysisQueue] Shutting down gracefully...');

  try {
    if (worker) {
      await worker.close();
      console.log('[analysisWorker] Worker closed');
    }

    if (queueEvents) {
      await queueEvents.close();
      console.log('[analysisQueue] QueueEvents closed');
    }

    if (analysisQueue) {
      // Drain queue: wait for all active jobs to complete
      await analysisQueue.drain();
      await analysisQueue.close();
      console.log('[analysisQueue] Queue closed and drained');
    }
  } catch (err) {
    console.error('[analysisQueue] Error during shutdown:', err);
  }
}

module.exports = {
  initializeQueue,
  startWorker,
  submitJob,
  getJobStatus,
  getQueueStats,
  shutdown,
};
