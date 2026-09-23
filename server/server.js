const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');

// The server process always runs with cwd=server/, but the documented
// .env lives at the project root (see README setup steps), so it was
// never actually being loaded by the bare dotenv.config() default.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Fail during startup instead of accepting production traffic with a known
// fallback signing key. Local development retains the documented fallback.
require('./utils/jwt').getJwtSecret();

const errorTracking = require('./utils/errorTracking');
errorTracking.init();

const app = require('./app');
const { initSocket } = require('./utils/socket');
const { verifySmtpConnection } = require('./utils/email');
const { getBackendName, verifyStorageConnection, cleanupAbandonedMultipartUploads } = require('./utils/storage');
const { reconcileOrphanedJobs } = require('./controllers/analysisController');
const analysisWorkerPool = require('./utils/analysisWorkerPool');
const multipartSessions = require('./utils/multipartUploadSessions');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scout-bridge-analytics', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }

  // Isolated from the connection try/catch above: a reconciliation failure
  // shouldn't be treated as fatal the way an actual DB-connection failure
  // is — worst case, some videos stay stuck exactly as they would have
  // without this fix at all, not any worse off.
  try {
    await reconcileOrphanedJobs();
  } catch (error) {
    console.error('[analysis] Failed to reconcile orphaned jobs:', error);
  }
};

connectDB();

// Safety net, not the primary fix: every code path that can reject a
// promise should already have its own .catch() (see processAnalysis's
// try/catch and the analysis worker pool's job .catch()). This exists so
// a future gap of the same kind logs loudly instead of silently killing
// the process — Node terminates on an unhandled rejection by default.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  errorTracking.captureException(reason instanceof Error ? reason : new Error(String(reason)));
});

// Surfaces email misconfiguration at startup instead of only when a real
// user's registration/reset email silently fails later. Purely
// informational — never blocks startup, since console-fallback mode
// (no provider configured) is a valid, deliberate state for local dev.
verifySmtpConnection().then((result) => {
  const provider = process.env.RESEND_API_KEY ? 'Resend' : process.env.SMTP_HOST;
  if (result === null) {
    console.log('[email] No email provider configured, emails will be logged to this console instead of sent.');
  } else if (result.ok) {
    console.log(`[email] Connection verified (${provider}).`);
  } else {
    console.error(`[email] Configured (${provider}) but connection/auth failed: ${result.error}`);
  }
});

// Same idea for storage: confirm the configured backend is actually
// reachable at startup, not only when a real user's upload fails.
console.log(`[storage] Backend: ${getBackendName()}${getBackendName() === 'local' ? ' (uploads/)' : ''}`);
verifyStorageConnection().then((result) => {
  if (result && !result.ok) {
    console.error(`[storage] S3 is configured but the bucket is unreachable: ${result.error}`);
  } else if (result && result.ok) {
    console.log(`[storage] S3 bucket "${process.env.S3_BUCKET}" reachable.`);
  }
});

// Safety net for direct multipart uploads abandoned by a browser/network
// failure. S3 lifecycle rules remain the preferred long-term cleanup, but
// this startup sweep also protects providers where lifecycle configuration
// is unavailable or not yet configured.
if (getBackendName() === 's3') {
  cleanupAbandonedMultipartUploads()
    .then(({ scanned, aborted }) => console.log(`[storage] Multipart cleanup: scanned ${scanned}, aborted ${aborted} abandoned upload(s).`))
    .catch((error) => console.error(`[storage] Multipart cleanup failed: ${error.message}`));
}

// socket.io needs the raw HTTP server (not just the Express app) so it can
// upgrade connections to WebSocket alongside the existing HTTP routes.
const server = http.createServer(app);
initSocket(server);


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

let shuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] Received ${signal}; draining workers and closing connections...`);

  const forceExit = setTimeout(() => {
    console.error('[shutdown] Graceful shutdown timed out; forcing exit.');
    process.exit(1);
  }, Number(process.env.SHUTDOWN_TIMEOUT_MS) || 30000);
  forceExit.unref();

  server.close(async () => {
    try {
      await analysisWorkerPool.shutdown();
      await multipartSessions.close();
      await mongoose.connection.close();
      console.log('[shutdown] HTTP, analysis workers, Redis, and MongoDB closed.');
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      console.error('[shutdown] Error while closing resources:', error);
      clearTimeout(forceExit);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', () => { gracefulShutdown('SIGINT'); });
