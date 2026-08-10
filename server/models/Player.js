const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    // Indexed: queried via Player.find({ team: { $in: ... } }) every time
    // an analysis run persists results (see analysisController.js).
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', index: true },
    position: String,
    jerseyNumber: Number,
    age: { type: Number, min: 0, max: 60 },
    heightCm: { type: Number, min: 130, max: 220 },
    weightKg: { type: Number, min: 40, max: 180 },
    nationality: { type: String, trim: true, default: '' },
    preferredFoot: { type: String, trim: true, default: '' },
    contractStatus: { type: String, trim: true, default: '' },
    marketValue: { type: Number, min: 0, default: 0 },
    profileSummary: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Player', playerSchema);
