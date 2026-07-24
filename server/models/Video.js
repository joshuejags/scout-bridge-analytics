const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    duration: Number,
    uploadedBy: { type: String },
    filePath: { type: String, required: true },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'analyzed', 'failed'],
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
