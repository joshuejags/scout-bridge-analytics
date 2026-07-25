const Video = require('../models/Video');
const fs = require('fs');
const path = require('path');
const chunkedUploads = require('../utils/chunkedUploads');
const storage = require('../utils/storage');

const ALLOWED_SPORTS = ['soccer', 'basketball', 'hockey', 'rugby'];
const ALLOWED_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv', '.flv'];

// Every video a non-admin user lists or fetches is scoped to their own
// uploads — admins see everything (needed to manage the app, and the only
// way to reach videos uploaded before the `user` field existed, which have
// no owner on record at all). Centralized here so getVideos/getVideoById
// (and analysisController's video-derived checks) can't drift apart.
const ownershipFilter = (req) => (req.user.role === 'admin' ? {} : { user: req.user._id });
const isOwnerOrAdmin = (video, user) =>
  user.role === 'admin' || (video.user && String(video.user) === String(user._id));
// Reused by analysisController (analysis data is exactly as private as the
// video it belongs to) and the /uploads static-file access check in app.js.
exports.isOwnerOrAdmin = isOwnerOrAdmin;

// Upload video file
exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const players = Array.isArray(req.body.players)
      ? req.body.players
      : req.body.players
      ? [req.body.players]
      : [];

    // multer's diskStorage already wrote this to local disk; storeFile is a
    // no-op for the local backend (default) and promotes it to S3 (deleting
    // the local temp copy) when STORAGE_BACKEND=s3 — see utils/storage.js.
    const stored = await storage.storeFile(req.file.path, req.file.filename);

    const video = new Video({
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      filePath: stored.localPath || stored.key,
      storageBackend: stored.backend,
      // The server is the source of truth for who uploaded this, not
      // whatever the client claims — uploadedBy is display-only, `user` is
      // what access control actually checks.
      uploadedBy: req.user.email,
      user: req.user._id,
      status: 'uploaded',
      team: req.body.team || null,
      opponentTeam: req.body.opponentTeam || null,
      players,
      sport: req.body.sport || 'soccer',
    });

    await video.save();
    res.status(201).json(video);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Chunked upload, step 1: declare the file up front and open a session to
// append chunks to. Kept alongside the single-shot /upload endpoint above
// rather than replacing it — small files still work fine as one request;
// this path exists for files large enough that holding one HTTP request
// open for the whole transfer is a real reliability risk.
exports.initChunkedUpload = async (req, res) => {
  try {
    const { originalName, fileSize, sport } = req.body;
    const players = Array.isArray(req.body.players)
      ? req.body.players
      : req.body.players
      ? [req.body.players]
      : [];

    const size = Number(fileSize);
    if (!Number.isFinite(size) || size <= 0) {
      return res.status(400).json({ error: 'fileSize must be a positive integer' });
    }
    const maxSize = Number(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024;
    if (size > maxSize) {
      return res.status(400).json({ error: `File exceeds maximum allowed size of ${maxSize} bytes` });
    }
    const ext = path.extname(originalName || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: 'Only video files are allowed' });
    }

    const uploadId = chunkedUploads.createSession({
      expectedSize: size,
      meta: {
        originalName,
        team: req.body.team || null,
        opponentTeam: req.body.opponentTeam || null,
        sport: ALLOWED_SPORTS.includes(sport) ? sport : 'soccer',
        players,
        uploadedBy: req.user.email,
        userId: req.user._id,
      },
    });

    res.status(201).json({ uploadId, expectedSize: size, chunkSizeHint: 5 * 1024 * 1024 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Chunked upload, step 2 (repeated): append one raw chunk. Body is parsed
// as a raw Buffer (route-level express.raw(), not the global json/urlencoded
// parsers) since a chunk is arbitrary binary data, not a structured body.
exports.uploadChunk = (req, res) => {
  try {
    const { uploadId } = req.params;
    const session = chunkedUploads.getSession(uploadId);
    if (!session || String(session.meta.userId) !== String(req.user._id)) {
      // Same response either way — a real session belonging to someone
      // else shouldn't be distinguishable from a made-up uploadId.
      return res.status(404).json({ error: 'Unknown or expired upload session' });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Chunk body must not be empty' });
    }

    const bytesReceived = chunkedUploads.appendChunk(uploadId, req.body);
    if (bytesReceived > session.expectedSize) {
      chunkedUploads.abort(uploadId);
      return res.status(400).json({
        error: 'Received more bytes than the declared fileSize; upload aborted — start a new session',
      });
    }
    res.json({ bytesReceived, expectedSize: session.expectedSize });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Lets a client that reloaded mid-upload (or retried after a dropped
// connection) find out how many bytes the server already has, instead of
// re-sending the whole file from the start.
exports.getChunkedUploadStatus = (req, res) => {
  const session = chunkedUploads.getSession(req.params.uploadId);
  if (!session || String(session.meta.userId) !== String(req.user._id)) {
    return res.status(404).json({ error: 'Unknown or expired upload session' });
  }
  res.json({ bytesReceived: session.bytesReceived, expectedSize: session.expectedSize });
};

// Chunked upload, step 3: once every declared byte has arrived, assemble
// the final file and create the real Video document — same shape/fields
// as the single-shot uploadVideo above, just fed from a session instead of
// a multer req.file.
exports.completeChunkedUpload = async (req, res) => {
  try {
    const { uploadId } = req.params;
    const session = chunkedUploads.getSession(uploadId);
    if (!session || String(session.meta.userId) !== String(req.user._id)) {
      return res.status(404).json({ error: 'Unknown or expired upload session' });
    }

    const finalFilename = `${Date.now()}${path.extname(session.meta.originalName)}`;
    let stored;
    try {
      stored = await chunkedUploads.finalize(uploadId, finalFilename);
    } catch (e) {
      return res.status(409).json({ error: e.message });
    }

    const video = new Video({
      filename: finalFilename,
      originalName: session.meta.originalName,
      fileSize: session.expectedSize,
      filePath: stored.localPath || stored.key,
      storageBackend: stored.backend,
      uploadedBy: session.meta.uploadedBy,
      user: session.meta.userId,
      status: 'uploaded',
      team: session.meta.team,
      opponentTeam: session.meta.opponentTeam,
      players: session.meta.players,
      sport: session.meta.sport,
    });
    await video.save();
    res.status(201).json(video);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all videos — scoped to the requesting user (admins see everything).
exports.getVideos = async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const videos = await Video.find(ownershipFilter(req))
      .populate('analysis')
      .populate('team')
      .populate('opponentTeam')
      .populate('players');
    const response = videos.map((video) => ({
      ...video.toObject(),
      url: `${baseUrl}/uploads/${video.filename}`,
    }));
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get video by ID — 404 (not 403) for a video that exists but isn't
// owned by the requester, so its existence isn't distinguishable from it
// simply not being there.
exports.getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('analysis')
      .populate('team')
      .populate('opponentTeam')
      .populate('players');
    if (!video || !isOwnerOrAdmin(video, req.user)) {
      return res.status(404).json({ error: 'Video not found' });
    }
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete video
exports.deleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Delete the underlying file from whichever backend actually stored
    // it — not necessarily today's STORAGE_BACKEND, since that can change
    // over a video's lifetime (see Video.storageBackend).
    if (video.storageBackend === 's3') {
      await storage.deleteObject(video.filename).catch((err) => {
        console.error(`Failed to delete s3 object for video ${video._id}: ${err.message}`);
      });
    } else if (fs.existsSync(video.filePath)) {
      fs.unlinkSync(video.filePath);
    }

    await Video.findByIdAndDelete(req.params.id);
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
