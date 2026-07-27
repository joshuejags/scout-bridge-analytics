const mongoose = require('mongoose');

// `this` is the document being validated - used as a required() condition
// below for the fields that don't exist yet while a URL import is still
// downloading.
function notImporting() {
  return this.status !== 'importing';
}

const videoSchema = new mongoose.Schema(
  {
    // Indexed: looked up on every /uploads/* request (see
    // middleware/uploadAccess.js) to resolve the requesting file back to
    // its owning video. Not required while status is 'importing' - the
    // Video document is created up front so the import shows up in the
    // list right away, before the file backing it exists yet (see
    // videoController.importVideoFromUrl / utils/videoUrlImport.js).
    filename: { type: String, required: notImporting, index: true },
    originalName: { type: String, required: notImporting },
    fileSize: { type: Number, required: notImporting },
    duration: Number,
    // Set when this video came from importVideoFromUrl instead of a direct
    // file upload - kept for provenance/audit, not read by the analysis
    // pipeline itself.
    sourceUrl: { type: String, default: null },
    // Display-only string (the uploader's email at upload time); the real
    // access-control check is against `user` below, not this field.
    uploadedBy: { type: String },
    // The account that owns this video. Every video a non-admin user lists
    // or fetches is scoped to this field (see videoController.js) — not
    // required, since videos created before this field existed have no
    // owner on record and are intentionally admin-only until manually
    // assigned one. Indexed: this is the filter on every GET /api/videos.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    filePath: { type: String, required: notImporting },
    // Which backend actually stored this video's file — recorded per-video
    // (not just read from the current STORAGE_BACKEND env var) since that
    // config can change over a video's lifetime, e.g. after migrating from
    // local disk to S3; older videos must still resolve against whichever
    // backend they were actually written to. See utils/storage.js.
    storageBackend: { type: String, enum: ['local', 's3'], default: 'local' },
    status: {
      type: String,
      // 'importing' is the URL-import equivalent of 'uploaded' - set the
      // moment a POST /api/videos/import-url request is accepted, while
      // utils/videoUrlImport.js downloads the file in the background; it
      // moves to 'uploaded' once the file lands, or 'failed' if the
      // download itself fails (unsupported site, private/age-restricted
      // video, over the duration/size limit, etc.).
      // 'queued' means an analysis job has been submitted but every
      // worker is currently busy with another video; it transitions to
      // 'processing' once a worker actually picks it up (see
      // analysisController.processAnalysis / utils/analysisWorkerPool.js).
      enum: ['importing', 'uploaded', 'queued', 'processing', 'analyzed', 'failed'],
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
    // Set whenever status transitions to 'failed' — either a real analysis
    // error, or (see analysisController.reconcileOrphanedJobs) a job lost
    // to a server restart while queued/processing. Cleared on success, so
    // it never shows a stale reason next to a since-succeeded analysis.
    // Without this, the *only* place a failure reason ever existed was a
    // transient Socket.IO event — invisible to anyone not already watching
    // live, and gone forever after a page reload.
    lastError: { type: String, default: null },
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
