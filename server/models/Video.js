const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    duration: Number,
    // Display-only string (the uploader's email at upload time); the real
    // access-control check is against `user` below, not this field.
    uploadedBy: { type: String },
    // The account that owns this video. Every video a non-admin user lists
    // or fetches is scoped to this field (see videoController.js) — not
    // required, since videos created before this field existed have no
    // owner on record and are intentionally admin-only until manually
    // assigned one.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    filePath: { type: String, required: true },
    // Which backend actually stored this video's file — recorded per-video
    // (not just read from the current STORAGE_BACKEND env var) since that
    // config can change over a video's lifetime, e.g. after migrating from
    // local disk to S3; older videos must still resolve against whichever
    // backend they were actually written to. See utils/storage.js.
    storageBackend: { type: String, enum: ['local', 's3'], default: 'local' },
    status: {
      type: String,
      // 'queued' means a job has been submitted but every analysis worker
      // is currently busy with another video; it transitions to
      // 'processing' once a worker actually picks it up (see
      // analysisController.processAnalysis / utils/analysisWorkerPool.js).
      enum: ['uploaded', 'queued', 'processing', 'analyzed', 'failed'],
      default: 'uploaded',
    },
    // Controls the analyzer's field-size calibration (distance/speed
    // accuracy) and ball-color detection — see SPORT_PRESETS in
    // server/cv/video_analyzer.py. Fixed at upload time since it can't be
    // inferred from the footage itself.
    sport: {
      type: String,
      enum: ['soccer', 'basketball', 'hockey', 'rugby'],
      default: 'soccer',
    },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    opponentTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    progress: { type: Number, default: 0 },
    analysis: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis' },
    metadata: {
      width: Number,
      height: Number,
      fps: Number,
      frameCount: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Video', videoSchema);
