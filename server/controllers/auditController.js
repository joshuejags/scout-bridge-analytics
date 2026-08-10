const AuditLog = require('../models/AuditLog');
const AuditService = require('../services/AuditService');
const { validateObjectId, validatePagination } = require('../utils/validators');

exports.getLogs = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only admins can view audit logs
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { organizationId } = req.params;
    validateObjectId(organizationId);

    const { action, severity, resourceType, startDate, endDate, page = 1, limit = 50 } = req.query;

    const filters = {
      organizationId,
      action,
      severity,
      resourceType,
      startDate,
      endDate,
    };

    Object.keys(filters).forEach((key) => !filters[key] && delete filters[key]);

    const pagination = validatePagination(page, limit);

    const result = await AuditService.getLogs(filters, pagination);

    // Log the audit log retrieval itself
    await AuditService.log(req.user._id, 'admin.action', {
      organizationId,
      resourceType: 'audit_log',
      details: { action: 'view_logs' },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

exports.getSummary = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { organizationId } = req.params;
    validateObjectId(organizationId);

    const { days = 30 } = req.query;

    const summary = await AuditService.getSummary(organizationId, parseInt(days));

    res.json(summary);
  } catch (error) {
    console.error('Error fetching audit summary:', error);
    res.status(500).json({ error: 'Failed to fetch audit summary' });
  }
};

exports.exportLogs = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { organizationId } = req.params;
    validateObjectId(organizationId);

    const { format = 'csv', action, severity, resourceType, startDate, endDate } = req.query;

    const filters = { action, severity, resourceType, startDate, endDate };
    Object.keys(filters).forEach((key) => !filters[key] && delete filters[key]);

    const content = await AuditService.exportLogs(organizationId, format, filters);

    // Set appropriate headers and content type
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Log the export
    await AuditService.log(req.user._id, 'export.create', {
      organizationId,
      resourceType: 'audit_log',
      details: { format, filters },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.send(content);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
};

exports.getSecurityAlerts = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { organizationId } = req.params;
    validateObjectId(organizationId);

    const alerts = await AuditLog.find({
      organizationId,
      severity: { $in: ['warning', 'critical'] },
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ alerts, count: alerts.length });
  } catch (error) {
    console.error('Error fetching security alerts:', error);
    res.status(500).json({ error: 'Failed to fetch security alerts' });
  }
};

exports.checkSuspiciousActivity = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { organizationId, userId } = req.params;
    validateObjectId(organizationId);
    validateObjectId(userId);

    const result = await AuditService.checkSuspiciousActivity(userId, organizationId);

    res.json(result);
  } catch (error) {
    console.error('Error checking suspicious activity:', error);
    res.status(500).json({ error: 'Failed to check suspicious activity' });
  }
};

exports.purgeOldLogs = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { daysToKeep = 730 } = req.body;

    const result = await AuditService.purgeOldLogs(daysToKeep);

    // Log this compliance action
    await AuditService.log(req.user._id, 'admin.action', {
      resourceType: 'audit_log',
      details: { action: 'purge_logs', daysToKeep },
      severity: 'info',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Error purging audit logs:', error);
    res.status(500).json({ error: 'Failed to purge audit logs' });
  }
};
