const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const path = require('path');
const { requireAuth } = require('./middleware/auth');
const authorizeUploadAccess = require('./middleware/uploadAccess');
const storage = require('./utils/storage');
const errorTracking = require('./utils/errorTracking');

const app = express();

// Middleware
// Adds baseline security headers (X-Content-Type-Options, X-Frame-Options,
// a default CSP, etc.). This API is deliberately cross-origin (a separate
// client service talks to it — see the CORS config right below), so
// helmet's same-origin defaults for CORP/COEP are overridden: those exist
// to stop a *different* site from embedding this one, not to stop our own
// client (on a different port/domain) from fetching its own API.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);
// CLIENT_URL already exists (used to build password-reset/verify-email
// links) and is exactly the origin this should be scoped to. Falls back
// to cors()'s permissive default (reflects any origin) when unset, same
// as today's behavior, rather than hard-failing local/CI setups that
// haven't configured it.
app.use(cors(process.env.CLIENT_URL ? { origin: process.env.CLIENT_URL } : {}));
app.use(express.json());
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');

// A video stored on S3 (see utils/storage.js) has nothing for
// express.static to serve locally — proxy it through instead, after the
// same ownership check. Thumbnails and local-backend videos fall straight
// through to express.static below, which handles range requests/caching
// better than reimplementing that for the local case too.
const serveFromCloudIfNeeded = async (req, res, next) => {
  if (req.isThumbnailRequest || req.video.storageBackend !== 's3') {
    return next();
  }
  try {
    await storage.pipeObjectToResponse(req.video.filename, res);
  } catch (error) {
    console.error(`[uploads] failed to stream s3 object for video ${req.video._id}: ${error.message}`);
    if (!res.headersSent) res.status(502).json({ error: 'Failed to fetch stored video' });
  }
};

// Video files and player-verification thumbnails are private scouting
// data, scoped per-owner (see authorizeUploadAccess) — requireAuth alone
// only proves a valid session, not that it owns this particular file.
app.use(
  '/uploads',
  requireAuth,
  authorizeUploadAccess,
  serveFromCloudIfNeeded,
  express.static(uploadDir)
);

// Routes
// A liveness check that always returns 200 regardless of dependencies is
// indistinguishable from "up and actually able to serve requests" to
// something like Railway's healthcheck — checking Mongo's connection
// state (not issuing a real query, just reading the driver's own tracked
// state) means a down database is reported as unhealthy instead of hidden.
app.get('/api/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res
    .status(dbConnected ? 200 : 503)
    .json({ status: dbConnected ? 'ok' : 'degraded', database: dbConnected ? 'connected' : 'disconnected' });
});

// Auth routes are unprotected (register/login must be reachable without a token)
app.use('/api/auth', require('./routes/authRoutes'));

// Everything below requires a valid session
app.use('/api/videos', requireAuth, require('./routes/videoRoutes'));
app.use('/api/analysis', requireAuth, require('./routes/analysisRoutes'));
app.use('/api/teams', requireAuth, require('./routes/teamRoutes'));
app.use('/api/players', requireAuth, require('./routes/playerRoutes'));
// Admin-only endpoints (requireAuth already applied by the mount above in
// server.js; additionally requireRole('admin') is enforced per-route).
app.use('/api/admin', requireAuth, require('./routes/adminRoutes'));

// Error handling middleware
app.use((err, req, res, next) => {
  // Multer's own file-size-limit error and the fileFilter rejection in
  // videoRoutes.js (tagged with statusCode there) are client input errors
  // — wrong file type or too large — not server faults. Surfaced with
  // their real status instead of a blanket 500 so a client that branches
  // on status code handles them correctly, rather than treating a bad
  // upload as a backend crash.
  if (err && err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File exceeds the maximum allowed upload size.' });
  }
  if (err && err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  // Only genuinely unexpected (500-level) errors go to error tracking —
  // the branches above are normal client-input rejections, not crashes.
  errorTracking.captureException(err);
  console.error(err);
  res.status(500).json({ error: err.message });
});

module.exports = app;
