const MonitoringService = require('../services/MonitoringService');

exports.getSystemHealth = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const health = await MonitoringService.getSystemHealth();
    res.json(health);
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
};

exports.getMetrics = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { metric, startDate, endDate } = req.query;

    if (!metric) {
      return res.status(400).json({ error: 'metric parameter required' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate parameters required' });
    }

    const metrics = await MonitoringService.getMetrics(metric, startDate, endDate);
    res.json({ metric, metrics });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { severity, alertType } = req.query;

    const alerts = await MonitoringService.getActiveAlerts({
      severity,
      alertType,
    });

    res.json({ alerts, count: alerts.length });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

exports.acknowledgeAlert = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { alertId } = req.params;

    const alert = await MonitoringService.acknowledgeAlert(alertId, req.user._id);
    res.json(alert);
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { alertId } = req.params;

    const alert = await MonitoringService.resolveAlert(alertId);
    res.json(alert);
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
};

exports.getSubscriptionAnalytics = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate parameters required' });
    }

    const analytics = await MonitoringService.getSubscriptionAnalytics(startDate, endDate);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching subscription analytics:', error);
    res.status(500).json({ error: 'Failed to fetch subscription analytics' });
  }
};
