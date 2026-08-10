const mongoose = require('mongoose');

const savedFilterPresetSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scope: {
      type: String,
      enum: ['players', 'reports', 'scouting'],
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

savedFilterPresetSchema.index({ owner: 1, scope: 1, name: 1 }, { unique: false });

module.exports = mongoose.model('SavedFilterPreset', savedFilterPresetSchema);
