const mongoose = require('mongoose');

// Notification types
const NOTIFICATION_TYPES = {
  VIDEO_PROCESSED: 'video_processed',
  REPORT_GENERATED: 'report_generated',
  RECRUITMENT_UPDATE: 'recruitment_update',
  SCOUT_ASSIGNMENT: 'scout_assignment',
  TEAM_INVITATION: 'team_invitation',
  SUBSCRIPTION_UPDATE: 'subscription_update',
  SYSTEM_ALERT: 'system_alert',
  COMMENT_MENTION: 'comment_mention',
  REPORT_SHARED: 'report_shared',
};

// Notification channels
const NOTIFICATION_CHANNELS = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
};

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
    },
    
    // Notification content
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    description: String,
    
    // Action/navigation
    actionUrl: String,
    actionLabel: String,
    
    // Related resource
    resourceType: {
      type: String,
      enum: ['video', 'analysis', 'report', 'player', 'team', 'user', 'subscription'],
    },
    resourceId: mongoose.Schema.Types.ObjectId,
    
    // Notification metadata
    icon: String, // Icon name or URL
    color: String, // Color code
    
    // Status
    read: { type: Boolean, default: false },
    readAt: Date,
    archived: { type: Boolean, default: false },
    archivedAt: Date,
    
    // Delivery status
    channels: [
      {
        channel: {
          type: String,
          enum: Object.values(NOTIFICATION_CHANNELS),
        },
        status: {
          type: String,
          enum: ['pending', 'sent', 'failed', 'bounced'],
          default: 'pending',
        },
        sentAt: Date,
        failureReason: String,
      },
    ],
    
    // Metadata for dynamic content
    data: mongoose.Schema.Types.Mixed,
    
    // Expiration
    expiresAt: Date,
  },
  { timestamps: true }
);

// Index for common queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

/**
 * Mark notification as read
 */
notificationSchema.methods.markAsRead = function markAsRead() {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
  }
  return this;
};

/**
 * Mark notification as unread
 */
notificationSchema.methods.markAsUnread = function markAsUnread() {
  this.read = false;
  this.readAt = null;
  return this;
};

/**
 * Archive notification
 */
notificationSchema.methods.archive = function archive() {
  this.archived = true;
  this.archivedAt = new Date();
  return this;
};

/**
 * Unarchive notification
 */
notificationSchema.methods.unarchive = function unarchive() {
  this.archived = false;
  this.archivedAt = null;
  return this;
};

// Notification preferences schema
const notificationPreferencesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    
    // Global preferences
    emailNotificationsEnabled: { type: Boolean, default: true },
    pushNotificationsEnabled: { type: Boolean, default: true },
    inAppNotificationsEnabled: { type: Boolean, default: true },
    
    // Per-type preferences
    typePreferences: {
      [NOTIFICATION_TYPES.VIDEO_PROCESSED]: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
      [NOTIFICATION_TYPES.REPORT_GENERATED]: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
      [NOTIFICATION_TYPES.RECRUITMENT_UPDATE]: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: false },
        inApp: { type: Boolean, default: true },
      },
      [NOTIFICATION_TYPES.SCOUT_ASSIGNMENT]: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
      [NOTIFICATION_TYPES.TEAM_INVITATION]: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
      [NOTIFICATION_TYPES.SUBSCRIPTION_UPDATE]: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: false },
        inApp: { type: Boolean, default: true },
      },
      [NOTIFICATION_TYPES.SYSTEM_ALERT]: {
        email: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
      [NOTIFICATION_TYPES.COMMENT_MENTION]: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
      [NOTIFICATION_TYPES.REPORT_SHARED]: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
    },
    
    // Quiet hours
    quietHoursEnabled: { type: Boolean, default: false },
    quietHoursStart: String, // "HH:mm" format
    quietHoursEnd: String,
    timezone: { type: String, default: 'UTC' },
    
    // Digest preferences
    digestEnabled: { type: Boolean, default: true },
    digestFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'never'],
      default: 'daily',
    },
    digestTime: { type: String, default: '09:00' }, // "HH:mm" format
  },
  { timestamps: true }
);

module.exports = {
  Notification: mongoose.model('Notification', notificationSchema),
  NotificationPreferences: mongoose.model('NotificationPreferences', notificationPreferencesSchema),
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
};
