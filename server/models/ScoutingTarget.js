const mongoose = require('mongoose');

const scoutingTargetSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    stage: {
      type: String,
      enum: ['discovered', 'under-review', 'shortlisted', 'scouted', 'recommended', 'trial', 'signed', 'rejected'],
      default: 'discovered',
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
    handoffNote: { type: String, trim: true, default: '' },
    collaborationNote: { type: String, trim: true, default: '' },
    activityLog: {
      type: [
        new mongoose.Schema(
          {
            type: { type: String, trim: true, default: 'update' },
            message: { type: String, trim: true, default: '' },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

scoutingTargetSchema.index({ owner: 1, player: 1 }, { unique: true });

module.exports = mongoose.model('ScoutingTarget', scoutingTargetSchema);
