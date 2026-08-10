const router = require('express').Router();
const monitoringController = require('../controllers/monitoringController');

// Get system health
router.get('/health', monitoringController.getSystemHealth);

// Get metrics
router.get('/metrics', monitoringController.getMetrics);

// Get active alerts
router.get('/alerts', monitoringController.getAlerts);

// Acknowledge alert
router.patch('/alerts/:alertId/acknowledge', monitoringController.acknowledgeAlert);

// Resolve alert
router.patch('/alerts/:alertId/resolve', monitoringController.resolveAlert);

// Get subscription analytics
router.get('/subscription-analytics', monitoringController.getSubscriptionAnalytics);

module.exports = router;
