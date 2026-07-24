const express = require('express');
const cors = require('cors');
const path = require('path');
const { requireAuth } = require('./middleware/auth');
const authorizeUploadAccess = require('./middleware/uploadAccess');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
// Video files and player-verification thumbnails are private scouting
// data, scoped per-owner (see authorizeUploadAccess) — requireAuth alone
// only proves a valid session, not that it owns this particular file.
app.use('/uploads', requireAuth, authorizeUploadAccess, express.static(uploadDir));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Auth routes are unprotected (register/login must be reachable without a token)
app.use('/api/auth', require('./routes/authRoutes'));

// Everything below requires a valid session
app.use('/api/videos', requireAuth, require('./routes/videoRoutes'));
app.use('/api/analysis', requireAuth, require('./routes/analysisRoutes'));
app.use('/api/teams', requireAuth, require('./routes/teamRoutes'));
app.use('/api/players', requireAuth, require('./routes/playerRoutes'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

module.exports = app;
