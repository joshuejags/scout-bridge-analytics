const { Notification, NotificationPreferences, NOTIFICATION_TYPES, NOTIFICATION_CHANNELS } = require('../models/Notification');
const { model: User } = require('../models/User');
const nodemailer = require('nodemailer');

/**
 * Notification Service for managing notifications and delivery
 */
class NotificationService {
  /**
   * Initialize email transporter (configure from env)
   */
  static getMailer() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Create and send a notification
   */
  static async createNotification(userId, notification) {
    try {
      const {
        type,
        title,
        message,
        description,
        actionUrl,
        actionLabel,
        resourceType,
        resourceId,
        icon,
        color,
        data = {},
        expiresAt,
      } = notification;

      // Create notification in database
      const doc = new Notification({
        userId,
        type,
        title,
        message,
        description,
        actionUrl,
        actionLabel,
        resourceType,
        resourceId,
        icon,
        color,
        data,
        expiresAt,
        channels: [
          { channel: NOTIFICATION_CHANNELS.IN_APP, status: 'pending' },
        ],
      });

      // Get user preferences
      const preferences = await NotificationPreferences.findOne({ userId });
      
      // Determine which channels to use
      const channels = [];
      
      if (!preferences) {
        // Default preferences
        channels.push(NOTIFICATION_CHANNELS.IN_APP);
        channels.push(NOTIFICATION_CHANNELS.EMAIL);
      } else {
        if (preferences.inAppNotificationsEnabled) {
          channels.push(NOTIFICATION_CHANNELS.IN_APP);
        }
        if (preferences.emailNotificationsEnabled) {
          channels.push(NOTIFICATION_CHANNELS.EMAIL);
        }
      }

      // Update channels
      doc.channels = channels.map((channel) => ({
        channel,
        status: 'pending',
      }));

      await doc.save();

      // Send notifications asynchronously
      this.sendNotification(userId, doc, channels, preferences).catch((error) => {
        console.error(`Error sending notification ${doc._id}:`, error);
      });

      return doc;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send notification through specified channels
   */
  static async sendNotification(userId, notification, channels, preferences) {
    const user = await User.findById(userId);
    if (!user) return;

    const promises = channels.map((channel) => {
      if (channel === NOTIFICATION_CHANNELS.EMAIL) {
        return this.sendEmailNotification(user, notification, preferences);
      } else if (channel === NOTIFICATION_CHANNELS.IN_APP) {
        return this.markChannelAsSent(notification, NOTIFICATION_CHANNELS.IN_APP);
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
  }

  /**
   * Send email notification
   */
  static async sendEmailNotification(user, notification, preferences) {
    try {
      // Check quiet hours
      if (preferences && this.isInQuietHours(preferences)) {
        return;
      }

      const mailer = this.getMailer();

      const subject = notification.title;
      const html = `
        <h2>${notification.title}</h2>
        <p>${notification.message}</p>
        ${notification.description ? `<p>${notification.description}</p>` : ''}
        ${
          notification.actionUrl
            ? `<a href="${notification.actionUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
            ${notification.actionLabel || 'View'}
          </a>`
            : ''
        }
      `;

      await mailer.sendMail({
        to: user.email,
        subject,
        html,
        from: process.env.SMTP_FROM || 'noreply@scoutbridge.com',
      });

      await this.markChannelAsSent(notification, NOTIFICATION_CHANNELS.EMAIL);
    } catch (error) {
      console.error(`Error sending email notification: ${error}`);
      await this.markChannelAsFailed(notification, NOTIFICATION_CHANNELS.EMAIL, error.message);
    }
  }

  /**
   * Check if current time is in quiet hours
   */
  static isInQuietHours(preferences) {
    if (!preferences.quietHoursEnabled) return false;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    const { quietHoursStart, quietHoursEnd } = preferences;

    if (quietHoursStart < quietHoursEnd) {
      return currentTime >= quietHoursStart && currentTime <= quietHoursEnd;
    } else {
      return currentTime >= quietHoursStart || currentTime <= quietHoursEnd;
    }
  }

  /**
   * Mark channel as sent
   */
  static async markChannelAsSent(notification, channel) {
    const channelEntry = notification.channels.find((c) => c.channel === channel);
    if (channelEntry) {
      channelEntry.status = 'sent';
      channelEntry.sentAt = new Date();
    }
    await notification.save();
  }

  /**
   * Mark channel as failed
   */
  static async markChannelAsFailed(notification, channel, reason) {
    const channelEntry = notification.channels.find((c) => c.channel === channel);
    if (channelEntry) {
      channelEntry.status = 'failed';
      channelEntry.failureReason = reason;
    }
    await notification.save();
  }

  /**
   * Get user's unread notifications
   */
  static async getUnreadNotifications(userId, limit = 20) {
    try {
      const notifications = await Notification.find({
        userId,
        read: false,
        archived: false,
      })
        .sort({ createdAt: -1 })
        .limit(limit);

      return notifications;
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      throw error;
    }
  }

  /**
   * Get all notifications for user
   */
  static async getNotifications(userId, { limit = 20, skip = 0, read, archived } = {}) {
    try {
      const query = { userId };

      if (typeof read === 'boolean') {
        query.read = read;
      }

      if (typeof archived === 'boolean') {
        query.archived = archived;
      }

      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Notification.countDocuments(query);

      return { notifications, total };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId) {
    try {
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        { read: true, readAt: new Date() },
        { new: true }
      );

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany({ userId, read: false }, { read: true, readAt: new Date() });

      return result;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Archive notification
   */
  static async archiveNotification(notificationId) {
    try {
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        { archived: true, archivedAt: new Date() },
        { new: true }
      );

      return notification;
    } catch (error) {
      console.error('Error archiving notification:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId) {
    try {
      await Notification.findByIdAndDelete(notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get or create notification preferences
   */
  static async getPreferences(userId) {
    try {
      let preferences = await NotificationPreferences.findOne({ userId });

      if (!preferences) {
        preferences = new NotificationPreferences({ userId });
        await preferences.save();
      }

      return preferences;
    } catch (error) {
      console.error('Error fetching preferences:', error);
      throw error;
    }
  }

  /**
   * Update notification preferences
   */
  static async updatePreferences(userId, updates) {
    try {
      let preferences = await NotificationPreferences.findOne({ userId });

      if (!preferences) {
        preferences = new NotificationPreferences({ userId, ...updates });
      } else {
        Object.assign(preferences, updates);
      }

      await preferences.save();
      return preferences;
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        userId,
        read: false,
        archived: false,
      });

      return count;
    } catch (error) {
      console.error('Error counting unread notifications:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
