const { SystemMetric, OperationalAlert, SubscriptionAnalytics } = require('../models/OperationalMetrics');

class MonitoringService {
  /**
   * Record system metric
   */
  static async recordMetric(metricName, value, options = {}) {
    try {
      const { unit = '', tags = {}, context = {} } = options;

      const metric = new SystemMetric({
        metric: metricName,
        value,
        unit,
        tags,
        context,
      });

      await metric.save();
      return metric;
    } catch (error) {
      console.error('Error recording metric:', error);
    }
  }

  /**
   * Get system metrics over time range
   */
  static async getMetrics(metricName, startDate, endDate, options = {}) {
    try {
      const { limit = 1000 } = options;

      const metrics = await SystemMetric.find({
        metric: metricName,
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return metrics;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      throw error;
    }
  }

  /**
   * Get current system health
   */
  static async getSystemHealth() {
    try {
      const lastHour = new Date(Date.now() - 60 * 60 * 1000);

      const errorRate = await this.getAverageMetric('error_rate', lastHour);
      const apiLatency = await this.getAverageMetric('api_latency', lastHour);
      const dbLatency = await this.getAverageMetric('database_latency', lastHour);
      const activeUsers = await this.getLatestMetric('active_users', lastHour);
      const memoryUsage = await this.getLatestMetric('memory_usage', lastHour);
      const cpuUsage = await this.getLatestMetric('cpu_usage', lastHour);

      const status = this.determineHealthStatus({
        errorRate,
        apiLatency,
        dbLatency,
        memoryUsage,
        cpuUsage,
      });

      return {
        status, // 'healthy', 'degraded', 'down'
        metrics: {
          errorRate: errorRate || 0,
          apiLatency: apiLatency || 0,
          dbLatency: dbLatency || 0,
          activeUsers: activeUsers || 0,
          memoryUsage: memoryUsage || 0,
          cpuUsage: cpuUsage || 0,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error getting system health:', error);
      throw error;
    }
  }

  /**
   * Create operational alert
   */
  static async createAlert(alertData) {
    try {
      const alert = new OperationalAlert(alertData);
      await alert.save();

      // Notify admins (would integrate with notification service)
      console.log(`[ALERT] ${alert.severity}: ${alert.title}`);

      return alert;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  }

  /**
   * Get active alerts
   */
  static async getActiveAlerts(options = {}) {
    try {
      const { severity, alertType, limit = 50 } = options;

      const query = { status: { $in: ['active', 'acknowledged'] } };

      if (severity) query.severity = severity;
      if (alertType) query.alertType = alertType;

      const alerts = await OperationalAlert.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return alerts;
    } catch (error) {
      console.error('Error fetching active alerts:', error);
      throw error;
    }
  }

  /**
   * Acknowledge alert
   */
  static async acknowledgeAlert(alertId, userId) {
    try {
      const alert = await OperationalAlert.findByIdAndUpdate(
        alertId,
        {
          status: 'acknowledged',
          acknowledgedBy: userId,
          acknowledgedAt: new Date(),
        },
        { new: true }
      );

      return alert;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  /**
   * Resolve alert
   */
  static async resolveAlert(alertId) {
    try {
      const alert = await OperationalAlert.findByIdAndUpdate(
        alertId,
        {
          status: 'resolved',
          resolvedAt: new Date(),
        },
        { new: true }
      );

      return alert;
    } catch (error) {
      console.error('Error resolving alert:', error);
      throw error;
    }
  }

  /**
   * Record subscription analytics
   */
  static async recordSubscriptionAnalytics(metrics) {
    try {
      const { totalUsers, freeUsers, scoutProSubscribers, clubProSubscribers, enterpriseSubscribers, mrr, arr } =
        metrics;

      const analytics = [
        { metric: 'total_users', value: totalUsers },
        { metric: 'free_users', value: freeUsers },
        { metric: 'scout_pro_subscribers', value: scoutProSubscribers },
        { metric: 'club_pro_subscribers', value: clubProSubscribers },
        { metric: 'enterprise_subscribers', value: enterpriseSubscribers },
        { metric: 'mrr', value: mrr },
        { metric: 'arr', value: arr },
      ];

      const results = await SubscriptionAnalytics.insertMany(
        analytics.map((a) => ({ ...a, date: new Date() }))
      );

      return results;
    } catch (error) {
      console.error('Error recording subscription analytics:', error);
      throw error;
    }
  }

  /**
   * Get subscription analytics
   */
  static async getSubscriptionAnalytics(startDate, endDate) {
    try {
      const analytics = await SubscriptionAnalytics.find({
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      })
        .sort({ date: -1 })
        .lean();

      // Group by metric
      const grouped = {};
      analytics.forEach((a) => {
        if (!grouped[a.metric]) {
          grouped[a.metric] = [];
        }
        grouped[a.metric].push({
          date: a.date,
          value: a.value,
        });
      });

      return grouped;
    } catch (error) {
      console.error('Error fetching subscription analytics:', error);
      throw error;
    }
  }

  /**
   * Helper: Get average metric value
   */
  static async getAverageMetric(metricName, startDate) {
    try {
      const result = await SystemMetric.aggregate([
        {
          $match: {
            metric: metricName,
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            average: { $avg: '$value' },
          },
        },
      ]);

      return result[0]?.average || 0;
    } catch (error) {
      console.error('Error calculating average metric:', error);
      return 0;
    }
  }

  /**
   * Helper: Get latest metric value
   */
  static async getLatestMetric(metricName, startDate) {
    try {
      const metric = await SystemMetric.findOne({
        metric: metricName,
        timestamp: { $gte: startDate },
      })
        .sort({ timestamp: -1 })
        .lean();

      return metric?.value || 0;
    } catch (error) {
      console.error('Error fetching latest metric:', error);
      return 0;
    }
  }

  /**
   * Helper: Determine health status based on metrics
   */
  static determineHealthStatus(metrics) {
    const { errorRate, apiLatency, dbLatency, memoryUsage, cpuUsage } = metrics;

    if (errorRate > 5 || apiLatency > 5000 || memoryUsage > 90 || cpuUsage > 90) {
      return 'down';
    }

    if (errorRate > 1 || apiLatency > 2000 || memoryUsage > 75 || cpuUsage > 75) {
      return 'degraded';
    }

    return 'healthy';
  }
}

module.exports = MonitoringService;
