const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    action: {
      type: String,
      required: true,
      enum: [
        'user.login',
        'user.logout',
        'user.signup',
        'user.password_change',
        'user.profile_update',
        'user.mfa_enable',
        'user.mfa_disable',
        'subscription.create',
        'subscription.upgrade',
        'subscription.downgrade',
        'subscription.cancel',
        'payment.success',
        'payment.failed',
        'organization.create',
        'organization.update',
        'organization.delete',
        'member.invite',
        'member.add',
        'member.remove',
        'member.role_change',
        'video.upload',
        'video.process',
        'video.delete',
        'report.create',
        'report.update',
        'report.delete',
        'report.share',
        'search.query',
        'export.create',
        'admin.action',
        'security.alert',
      ],
      index: true,
    },
    resourceType: {
      type: String,
      enum: [
        'user',
        'organization',
        'subscription',
        'video',
        'report',
        'payment',
        'member',
        'export',
      ],
    },
    resourceId: {
      type: String,
    },
    ipAddress: String,
    userAgent: String,
    statusCode: {
      type: Number,
      enum: [200, 201, 400, 401, 403, 404, 500],
    },
    details: mongoose.Schema.Types.Mixed,
    severity: {
      type: String,
      enum: ['info', 'warning', 'error', 'critical'],
      default: 'info',
      index: true,
    },
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, createdAt: -1 },
      { organizationId: 1, createdAt: -1 },
      { action: 1, createdAt: -1 },
      { severity: 1, createdAt: -1 },
    ],
  }
);

// Auto-delete logs older than 2 years (for compliance)
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 63072000 } // 2 years
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
