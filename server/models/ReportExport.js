const mongoose = require('mongoose');

const reportExportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
    },
    type: {
      type: String,
      enum: ['scout_report', 'player_profile', 'team_analysis', 'match_analysis', 'analytics'],
      required: true,
      index: true,
    },
    format: {
      type: String,
      enum: ['pdf', 'csv', 'excel', 'json'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    fileName: String,
    fileSize: Number, // bytes
    filePath: String,
    downloadUrl: String,
    expiresAt: Date, // When download link expires
    filters: mongoose.Schema.Types.Mixed, // Applied filters (if any)
    metadata: {
      playerCount: Number,
      matchCount: Number,
      dateRange: {
        startDate: Date,
        endDate: Date,
      },
      generatedBy: String,
    },
    error: String, // Error message if export failed
    progress: {
      current: { type: Number, default: 0 },
      total: { type: Number, default: 100 },
    },
    scheduled: {
      enabled: Boolean,
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
      },
      nextRun: Date,
      lastRun: Date,
    },
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, createdAt: -1 },
      { organizationId: 1, type: 1 },
      { status: 1, createdAt: -1 },
      { expiresAt: 1 },
    ],
  }
);

// Auto-delete expired download links
reportExportSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $exists: true } } }
);

module.exports = mongoose.model('ReportExport', reportExportSchema);
