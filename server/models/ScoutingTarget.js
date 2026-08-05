const mongoose = require('mongoose');

const scoutingTargetSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    stage: {
      type: String,
      enum: ['discovery', 'watchlist', 'shortlist', 'live', 'decision'],
      default: 'discovery',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    fitScore: { type: Number, min: 0, max: 100, default: 70 },
    note: { type: String, trim: true, default: '' },
    nextAction: { type: String, trim: true, default: '' },
    dueDate: Date,
  },
  { timestamps: true }
);

scoutingTargetSchema.index({ owner: 1, player: 1 }, { unique: true });

module.exports = mongoose.model('ScoutingTarget', scoutingTargetSchema);
