const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    duration: Number,
    uploadedBy: { type: String },
    filePath: { type: String, required: true },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'analyzed', 'failed'],
      default: 'uploaded',
    },
    progress: { type: Number, default: 0 },
    analysis: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis' },
    metadata: {
      width: Number,
      height: Number,
      fps: Number,
      frameCount: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Video', videoSchema);
