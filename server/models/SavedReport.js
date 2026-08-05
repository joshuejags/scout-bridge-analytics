const mongoose = require('mongoose');

const savedReportSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true, index: true },
    analysis: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true },
    template: {
      type: String,
      enum: ['scout-summary', 'recruitment-decision', 'player-development'],
      default: 'scout-summary',
    },
    title: { type: String, required: true, trim: true },
    summary: { type: String, trim: true, default: '' },
    tags: { type: [String], default: [] },
    insightSnapshot: {
      suggestedSummary: { type: String, default: '' },
      recommendation: {
        label: { type: String, default: '' },
        score: { type: Number, default: 0 },
        reason: { type: String, default: '' },
      },
      confidence: {
        label: { type: String, default: '' },
        score: { type: Number, default: 0 },
      },
      metrics: {
        trackedPlayers: { type: Number, default: 0 },
        verifiedTracks: { type: Number, default: 0 },
        totalActions: { type: Number, default: 0 },
        highlightedMoments: { type: Number, default: 0 },
      },
      eventBreakdown: {
        type: [
          new mongoose.Schema(
            {
              type: { type: String, default: '' },
              count: { type: Number, default: 0 },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
      recruitmentSignals: { type: [String], default: [] },
      tacticalSignals: { type: [String], default: [] },
      developmentAreas: { type: [String], default: [] },
      standoutPlayers: {
        type: [
          new mongoose.Schema(
            {
              label: { type: String, default: '' },
              distanceCovered: { type: Number, default: 0 },
              sprintCount: { type: Number, default: 0 },
              activationArea: { type: String, default: '' },
              verified: { type: Boolean, default: false },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
      highlightedMoments: {
        type: [
          new mongoose.Schema(
            {
              frameNumber: { type: Number, default: 0 },
              type: { type: String, default: '' },
              description: { type: String, default: '' },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
    },
  },
  { timestamps: true }
);

savedReportSchema.index({ owner: 1, video: 1 }, { unique: true });

module.exports = mongoose.model('SavedReport', savedReportSchema);
