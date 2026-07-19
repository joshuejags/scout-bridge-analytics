const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Team', teamSchema);
