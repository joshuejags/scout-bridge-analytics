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
    summary: {
      totalPlayers: Number,
      matchDuration: Number,
      highlightedMoments: { type: [HighlightedMomentSchema], default: [] },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Analysis', AnalysisSchema);
