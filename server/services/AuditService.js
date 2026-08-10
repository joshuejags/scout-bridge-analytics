const AuditLog = require('../models/AuditLog');

class AuditService {
  /**
   * Log user action for compliance
   */
  static async log(userId, action, options = {}) {
    try {
      const {
        organizationId,
        resourceType,
        resourceId,
        ipAddress,
        userAgent,
        statusCode = 200,
        details = {},
        severity = 'info',
        metadata = {},
      } = options;

      const log = new AuditLog({
        userId,
        organizationId,
        action,
        resourceType,
        resourceId,
        ipAddress,
        userAgent,
        statusCode,
        details,
        severity,
        metadata,
      });

      await log.save();
      return log;
    } catch (error) {
      console.error('Error logging audit:', error);
      // Don't throw - audit failures shouldn't break the main application
      return null;
    }
  }

  /**
   * Retrieve audit logs with filtering
   */
  static async getLogs(filters = {}, pagination = {}) {
    try {
      const {
        userId,
        organizationId,
        action,
        severity,
        resourceType,
        startDate,
        endDate,
      } = filters;

      const { page = 1, limit = 50 } = pagination;
      const skip = (page - 1) * limit;

      const query = {};

      if (userId) query.userId = userId;
      if (organizationId) query.organizationId = organizationId;
      if (action) query.action = action;
      if (severity) query.severity = severity;
      if (resourceType) query.resourceType = resourceType;

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const logs = await AuditLog.find(query)
        .populate('userId', 'email name')
        .populate('organizationId', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await AuditLog.countDocuments(query);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error retrieving audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit summary for organization
   */
  static async getSummary(organizationId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const logs = await AuditLog.find({
        organizationId,
        createdAt: { $gte: startDate },
      });

      const summary = {
        totalActions: logs.length,
        actionsByType: {},
        actionsBySeverity: {},
        topUsers: {},
        securityAlerts: logs.filter((l) => l.severity === 'critical' || l.severity === 'warning'),
      };

      logs.forEach((log) => {
        summary.actionsByType[log.action] = (summary.actionsByType[log.action] || 0) + 1;
        summary.actionsBySeverity[log.severity] =
          (summary.actionsBySeverity[log.severity] || 0) + 1;
        summary.topUsers[log.userId] = (summary.topUsers[log.userId] || 0) + 1;
      });

      return summary;
    } catch (error) {
      console.error('Error getting audit summary:', error);
      throw error;
    }
  }

  /**
   * Export audit logs (for compliance)
   */
  static async exportLogs(organizationId, format = 'csv', filters = {}) {
    try {
      const { logs } = await this.getLogs(
        { organizationId, ...filters },
        { limit: 10000 }
      );

      if (format === 'csv') {
        return this.logsToCSV(logs);
      } else if (format === 'json') {
        return JSON.stringify(logs, null, 2);
      }

      throw new Error('Unsupported export format');
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      throw error;
    }
  }

  /**
   * Convert logs to CSV format
   */
  static logsToCSV(logs) {
    const headers = ['Timestamp', 'User', 'Action', 'Resource', 'Severity', 'Status'];
    const rows = logs.map((log) => [
      log.createdAt,
      log.userId?.email || log.userId,
      log.action,
      `${log.resourceType}:${log.resourceId || ''}`,
      log.severity,
      log.statusCode,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Check for suspicious activity
   */
  static async checkSuspiciousActivity(userId, organizationId) {
    try {
      const recentLogs = await AuditLog.find({
        userId,
        organizationId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      const failedLogins = recentLogs.filter(
        (l) => l.action === 'user.login' && l.statusCode !== 200
      ).length;

      const passwordChanges = recentLogs.filter((l) => l.action === 'user.password_change')
        .length;

      return {
        suspicious: failedLogins > 5 || passwordChanges > 2,
        failedLogins,
        passwordChanges,
        recommendAction: failedLogins > 5 ? 'lockout_account' : passwordChanges > 2 ? 'verify_identity' : 'none',
      };
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
      throw error;
    }
  }

  /**
   * Purge old logs (compliance requirement)
   */
  static async purgeOldLogs(daysToKeep = 730) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await AuditLog.deleteMany({
        createdAt: { $lt: cutoffDate },
      });

      console.log(`Purged ${result.deletedCount} old audit logs`);
      return result;
    } catch (error) {
      console.error('Error purging old logs:', error);
      throw error;
    }
  }
}

module.exports = AuditService;
