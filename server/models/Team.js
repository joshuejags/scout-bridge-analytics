const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    league: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    tier: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Team', teamSchema);
