const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // Indexed: queried via Player.find({ team: { $in: ... } }) every time
    // an analysis run persists results (see analysisController.js).
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', index: true },
    position: String,
    jerseyNumber: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Player', playerSchema);
