const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    position: String,
    jerseyNumber: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Player', playerSchema);
