const NotificationService = require('../services/NotificationService');

/**
 * Get unread notifications
 */
exports.getUnreadNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 20 } = req.query;

    const notifications = await NotificationService.getUnreadNotifications(userId, parseInt(limit));

    res.json({
      success: true,
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error('Error fetching unread notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread notifications',
    });
  }
};

/**
 * Get all notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 20, skip = 0, read, archived } = req.query;

    const result = await NotificationService.getNotifications(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      read: read !== undefined ? read === 'true' : undefined,
      archived: archived !== undefined ? archived === 'true' : undefined,
    });

    res.json({
      success: true,
      notifications: result.notifications,
      total: result.total,
      skip: parseInt(skip),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    });
  }
};

/**
 * Mark notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await NotificationService.markAsRead(notificationId);

    res.json({
      success: true,
      notification,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
    });
  }
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await NotificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read',
    });
  }
};

/**
 * Archive notification
 */
exports.archiveNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await NotificationService.archiveNotification(notificationId);

    res.json({
      success: true,
      notification,
      message: 'Notification archived',
    });
  } catch (error) {
    console.error('Error archiving notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive notification',
    });
  }
};

/**
 * Delete notification
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    await NotificationService.deleteNotification(notificationId);

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
    });
  }
};

/**
 * Get notification preferences
 */
exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user._id;

    const preferences = await NotificationService.getPreferences(userId);

    res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification preferences',
    });
  }
};

/**
 * Update notification preferences
 */
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    const preferences = await NotificationService.updatePreferences(userId, updates);

    res.json({
      success: true,
      preferences,
      message: 'Notification preferences updated',
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification preferences',
    });
  }
};

/**
 * Get unread notification count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const count = await NotificationService.getUnreadCount(userId);

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count',
    });
  }
};
