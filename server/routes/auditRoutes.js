const router = require('express').Router();
const auditController = require('../controllers/auditController');

// Get audit logs for organization
router.get('/organizations/:organizationId/audit-logs', auditController.getLogs);

// Get audit summary
router.get('/organizations/:organizationId/audit-summary', auditController.getSummary);

// Export audit logs
router.get('/organizations/:organizationId/audit-logs/export', auditController.exportLogs);

// Get security alerts
router.get('/organizations/:organizationId/security-alerts', auditController.getSecurityAlerts);

// Check suspicious activity for user
router.get(
  '/organizations/:organizationId/users/:userId/suspicious-activity',
  auditController.checkSuspiciousActivity
);

// Purge old logs (compliance)
router.post('/audit-logs/purge', auditController.purgeOldLogs);

module.exports = router;
