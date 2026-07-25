const mongoose = require('mongoose');

const TrackingDataSchema = new mongoose.Schema(
  {
    frameNumber: Number,
    position: { x: Number, y: Number },
    confidence: Number,
    pose: Object,
  },
  { _id: false }
);

const PlayerDataSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    trackId: String,
    jerseyNumber: Number,
    jerseyConfidence: Number,
    teamColor: String,
    thumbnail: String,
    // True once a human has confirmed or corrected this track's identity
    // via the manual review UI, as opposed to an OCR-only guess.
    verified: { type: Boolean, default: false },
    trackingData: { type: [TrackingDataSchema], default: [] },
    statistics: {
      distanceCovered: Number,
      averageSpeed: Number,
      sprintCount: Number,
      activationArea: String,
    },
  },
  { _id: false }
);

const BallTrackingSchema = new mongoose.Schema(
  {
    frameNumber: Number,
    position: { x: Number, y: Number },
    confidence: Number,
  },
  { _id: false }
);

const BallPossessionSchema = new mongoose.Schema(
  {
    playerId: String,
    duration: Number,
    startFrame: Number,
    endFrame: Number,
  },
  { _id: false }
);

const ActionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['pass', 'shot', 'tackle', 'interception'] },
    playerId: String,
    frameNumber: Number,
    confidence: Number,
  },
  { _id: false }
);

const HighlightedMomentSchema = new mongoose.Schema(
  {
    frameNumber: Number,
    type: String,
    description: String,
  },
  { _id: false }
);

const TacticalTeamSchema = new mongoose.Schema(
  {
    teamColor: String,
    playerCount: Number,
    // width/depth/compactness in meters, averaged across every sampled
    // frame — see video_analyzer.py's _team_shape.
    shape: {
      width: Number,
      depth: Number,
      compactness: Number,
      sampledFrames: Number,
    },
    // Gap-based line banding heuristic — see _formation_lines. lineup is
    // player-count per line, ordered by increasing on-frame depth (not
    // defense-to-attack, which isn't knowable from this data).
    formation: {
      lineCount: Number,
      lineup: { type: [Number], default: [] },
    },
  },
  { _id: false }
);

const AnalysisSchema = new mongoose.Schema(
  {
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
    playerData: { type: [PlayerDataSchema], default: [] },
    ballData: {
      trackingData: { type: [BallTrackingSchema], default: [] },
      possessionStats: { type: [BallPossessionSchema], default: [] },
    },
    actions: { type: [ActionSchema], default: [] },
    heatmapData: {
      grid: { type: [[Number]], default: [] },
      cellSize: Number,
    },
    tacticalData: {
      teams: { type: [TacticalTeamSchema], default: [] },
    },
    summary: {
      totalPlayers: Number,
      matchDuration: Number,
      highlightedMoments: { type: [HighlightedMomentSchema], default: [] },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Analysis', AnalysisSchema);
