const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema(
  {
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
    playerData: [
      {
        playerId: String,
        trackingData: [
          {
            frameNumber: Number,
            position: { x: Number, y: Number },
            confidence: Number,
            pose: Object,
          },
        ],
        statistics: {
          distanceCovered: Number,
          averageSpeed: Number,
          sprintCount: Number,
          activationArea: String,
        },
      },
    ],
    ballData: {
      trackingData: [
        {
          frameNumber: Number,
          position: { x: Number, y: Number },
          confidence: Number,
        },
      ],
      possessionStats: [
        {
          playerId: String,
          duration: Number,
          startFrame: Number,
          endFrame: Number,
        },
      ],
    },
    actions: [
      {
        type: { type: String, enum: ['pass', 'shot', 'tackle', 'interception'] },
        playerId: String,
        frameNumber: Number,
        confidence: Number,
      },
    ],
    heatmapData: {
      grid: [[Number]],
      cellSize: Number,
    },
    summary: {
      totalPlayers: Number,
      matchDuration: Number,
      highlightedMoments: [
        {
          frameNumber: Number,
          type: String,
          description: String,
        },
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Analysis', analysisSchema);
