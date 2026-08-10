import React, { useState, useEffect } from 'react';
import './AdminDashboardPage.css';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminDashboardPage = () => {
  const [health, setHealth] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('api_latency');

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [healthRes, alertsRes, metricsRes] = await Promise.all([
        fetch('/api/monitoring/health', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/monitoring/alerts', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch(
          `/api/monitoring/metrics?metric=${selectedMetric}&startDate=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}&endDate=${new Date().toISOString()}`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }
        ),
      ]);

      if (healthRes.ok) setHealth(await healthRes.json());
      if (alertsRes.ok) setAlerts((await alertsRes.json()).alerts);
      if (metricsRes.ok) setMetrics(await metricsRes.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (status) => {
    const colors = {
      healthy: '#4caf50',
      degraded: '#ff9800',
      down: '#f44336',
    };
    return colors[status] || '#999';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      info: '#2196F3',
      warning: '#ff9800',
      critical: '#f44336',
    };
    return colors[severity] || '#999';
  };

  if (loading) {
    return <LoadingSpinner message="Loading admin dashboard..." />;
  }

  return (
    <div className="admin-dashboard-page">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p>System health, alerts, and platform analytics</p>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* System Health Status */}
      {health && (
        <div className="health-status-card">
          <h2>System Health</h2>
          <div
            className="status-indicator"
            style={{ backgroundColor: getHealthColor(health.status) }}
          >
            {health.status.toUpperCase()}
          </div>

          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">Error Rate</span>
              <span className="metric-value">{health.metrics.errorRate.toFixed(2)}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">API Latency</span>
              <span className="metric-value">{health.metrics.apiLatency.toFixed(0)}ms</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">DB Latency</span>
              <span className="metric-value">{health.metrics.dbLatency.toFixed(0)}ms</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Active Users</span>
              <span className="metric-value">{health.metrics.activeUsers}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Memory Usage</span>
              <span className="metric-value">{health.metrics.memoryUsage.toFixed(1)}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">CPU Usage</span>
              <span className="metric-value">{health.metrics.cpuUsage.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Active Alerts */}
      <div className="alerts-section">
        <h2>Active Alerts ({alerts.length})</h2>

        {alerts.length === 0 ? (
          <div className="empty-state">
            <p>✓ No active alerts</p>
          </div>
        ) : (
          <div className="alerts-list">
            {alerts.map((alert) => (
              <div
                key={alert._id}
                className="alert-item"
                style={{ borderLeftColor: getSeverityColor(alert.severity) }}
              >
                <div className="alert-header">
                  <span className="severity-badge" style={{ backgroundColor: getSeverityColor(alert.severity) }}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <h3>{alert.title}</h3>
                </div>
                <p>{alert.message}</p>
                {alert.currentValue && alert.threshold && (
                  <p className="alert-details">
                    Current: {alert.currentValue} (Threshold: {alert.threshold})
                  </p>
                )}
                <div className="alert-actions">
                  {alert.status === 'active' && (
                    <button
                      className="acknowledge-btn"
                      onClick={() => {
                        // Call API to acknowledge
                        fetch(`/api/monitoring/alerts/${alert._id}/acknowledge`, {
                          method: 'PATCH',
                          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                        }).then(() => fetchDashboardData());
                      }}
                    >
                      Acknowledge
                    </button>
                  )}
                  {alert.status !== 'resolved' && (
                    <button
                      className="resolve-btn"
                      onClick={() => {
                        // Call API to resolve
                        fetch(`/api/monitoring/alerts/${alert._id}/resolve`, {
                          method: 'PATCH',
                          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                        }).then(() => fetchDashboardData());
                      }}
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      <div className="metrics-section">
        <h2>Performance Metrics</h2>

        <div className="metric-selector">
          <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)}>
            <option value="api_latency">API Latency</option>
            <option value="error_rate">Error Rate</option>
            <option value="database_latency">Database Latency</option>
            <option value="active_users">Active Users</option>
            <option value="memory_usage">Memory Usage</option>
            <option value="cpu_usage">CPU Usage</option>
          </select>
        </div>

        {metrics && metrics.metrics && metrics.metrics.length > 0 ? (
          <div className="metrics-chart">
            <p>Last 7 days - {metrics.metrics.length} data points</p>
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {metrics.metrics.slice(0, 20).map((m, idx) => (
                  <tr key={idx}>
                    <td>{new Date(m.timestamp).toLocaleString()}</td>
                    <td>{m.value.toFixed(2)} {m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No metrics available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardPage;
