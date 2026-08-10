const express = require('express');
const { requireAuth } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

// All notification routes require authentication
router.use(requireAuth);

/**
 * GET /api/notifications - Get all notifications
 */
router.get('/', notificationController.getNotifications);

/**
 * GET /api/notifications/unread - Get unread notifications
 */
router.get('/unread', notificationController.getUnreadNotifications);

/**
 * GET /api/notifications/unread-count - Get unread notification count
 */
router.get('/unread-count', notificationController.getUnreadCount);

/**
 * PATCH /api/notifications/:notificationId/read - Mark as read
 */
router.patch('/:notificationId/read', notificationController.markAsRead);

/**
 * PATCH /api/notifications/read-all - Mark all as read
 */
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * PATCH /api/notifications/:notificationId/archive - Archive notification
 */
router.patch('/:notificationId/archive', notificationController.archiveNotification);

/**
 * DELETE /api/notifications/:notificationId - Delete notification
 */
router.delete('/:notificationId', notificationController.deleteNotification);

/**
 * GET /api/notifications/preferences - Get user preferences
 */
router.get('/preferences', notificationController.getPreferences);

/**
 * PUT /api/notifications/preferences - Update user preferences
 */
router.put('/preferences', notificationController.updatePreferences);

module.exports = router;
