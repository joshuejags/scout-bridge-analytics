const mongoose = require('mongoose');

const systemMetricSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
      expires: 2592000, // Auto-delete after 30 days
    },
    metric: {
      type: String,
      enum: [
        'api_requests',
        'api_latency',
        'database_queries',
        'database_latency',
        'active_users',
        'active_subscriptions',
        'storage_usage',
        'video_processing_queue',
        'error_rate',
        'memory_usage',
        'cpu_usage',
      ],
      index: true,
    },
    value: Number,
    unit: String, // ms, bytes, %, count, etc.
    tags: {
      endpoint: String,
      environment: String,
      status: String,
    },
    context: mongoose.Schema.Types.Mixed,
  },
  { timestamps: false }
);

const operationalAlertSchema = new mongoose.Schema(
  {
    alertType: {
      type: String,
      enum: ['performance', 'error', 'security', 'quota', 'billing', 'system'],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      required: true,
      index: true,
    },
    title: String,
    message: String,
    affectedResource: String,
    metric: String,
    threshold: Number,
    currentValue: Number,
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    acknowledgedAt: Date,
    resolvedAt: Date,
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved'],
      default: 'active',
      index: true,
    },
    recommendedAction: String,
  },
  { timestamps: true }
);

const subscriptionAnalyticsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metric: {
      type: String,
      enum: [
        'total_users',
        'free_users',
        'scout_pro_subscribers',
        'club_pro_subscribers',
        'enterprise_subscribers',
        'mrr',
        'arr',
        'churn_rate',
        'activation_rate',
        'trial_conversions',
      ],
      index: true,
    },
    value: Number,
    breakdown: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

module.exports = {
  SystemMetric: mongoose.model('SystemMetric', systemMetricSchema),
  OperationalAlert: mongoose.model('OperationalAlert', operationalAlertSchema),
  SubscriptionAnalytics: mongoose.model('SubscriptionAnalytics', subscriptionAnalyticsSchema),
};
