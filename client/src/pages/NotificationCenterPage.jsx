import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './NotificationCenterPage.css';

const NotificationCenterPage = () => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState({
    emailNotificationsEnabled: true,
    pushNotificationsEnabled: false,
    inAppNotificationsEnabled: true,
    digestFrequency: 'daily',
    quietHours: false,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [notificationsResponse, preferencesResponse] = await Promise.all([
        axios.get(apiUrl('/notifications'), { headers: authHeaders }),
        axios.get(apiUrl('/notifications/preferences'), { headers: authHeaders }),
      ]);
      setNotifications(notificationsResponse.data.notifications || []);
      setPreferences(preferencesResponse.data.preferences || preferencesResponse.data || {});
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    loadData();
  }, [loadData, token]);

  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(apiUrl(`/notifications/${notificationId}/read`), {}, { headers: authHeaders });
      setNotifications((prev) => prev.map((item) => (item._id === notificationId ? { ...item, read: true } : item)));
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update the notification.');
    }
  };

  const markAllAsRead = async () => {
    setBusy(true);
    try {
      await axios.patch(apiUrl('/notifications/read-all'), {}, { headers: authHeaders });
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setMessage('All notifications marked as read.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to mark notifications as read.');
    } finally {
      setBusy(false);
    }
  };

  const updatePreferences = async (nextPreferences) => {
    try {
      await axios.put(apiUrl('/notifications/preferences'), nextPreferences, { headers: authHeaders });
      setPreferences(nextPreferences);
      setMessage('Notification preferences updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update preferences.');
    }
  };

  const unreadCount = notifications.filter((item) => !item.read).length;

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading notifications..." />;
  }

  return (
    <div className="page-shell page-shell--wide">
      <div className="page-header">
        <div className="page-heading">
          <div className="page-kicker">SaaS operations</div>
          <h1 className="page-title">Notification center</h1>
          <p className="page-lead">Keep scouts, coaches, and club operators aligned with the latest activity from video processing, reports, recruitment, and subscription events.</p>
        </div>
        <div className="page-toolbar">
          <button type="button" className="button button-secondary" onClick={markAllAsRead} disabled={busy}>
            {busy ? 'Updating...' : 'Mark all as read'}
          </button>
        </div>
      </div>

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}

      <div className="saas-grid">
        <section className="surface-card saas-card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Activity feed</h2>
              <p className="card-subtitle">{unreadCount} unread updates</p>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="empty-state">No notifications yet. New report completions and video processing updates will appear here automatically.</div>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <article key={notification._id} className={`notification-item ${notification.read ? '' : 'notification-item--unread'}`}>
                  <div>
                    <div className="notification-item__heading">
                      <strong>{notification.title || notification.type}</strong>
                      {!notification.read && <span className="pill pill--warning">Unread</span>}
                    </div>
                    <p>{notification.message}</p>
                    <div className="notification-item__meta">
                      <span>{notification.type}</span>
                      <span>{new Date(notification.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  {!notification.read && (
                    <button type="button" className="button button-secondary" onClick={() => markAsRead(notification._id)}>
                      Mark read
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="surface-card saas-card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Delivery preferences</h2>
              <p className="card-subtitle">Tune when and how you receive updates.</p>
            </div>
          </div>

          <div className="preference-list">
            <label className="preference-row">
              <span>In-app notifications</span>
              <input
                type="checkbox"
                checked={preferences.inAppNotificationsEnabled}
                onChange={(event) => updatePreferences({ ...preferences, inAppNotificationsEnabled: event.target.checked })}
              />
            </label>
            <label className="preference-row">
              <span>Email notifications</span>
              <input
                type="checkbox"
                checked={preferences.emailNotificationsEnabled}
                onChange={(event) => updatePreferences({ ...preferences, emailNotificationsEnabled: event.target.checked })}
              />
            </label>
            <label className="preference-row">
              <span>Push notifications</span>
              <input
                type="checkbox"
                checked={preferences.pushNotificationsEnabled}
                onChange={(event) => updatePreferences({ ...preferences, pushNotificationsEnabled: event.target.checked })}
              />
            </label>
            <label className="preference-row">
              <span>Quiet hours</span>
              <input
                type="checkbox"
                checked={preferences.quietHours}
                onChange={(event) => updatePreferences({ ...preferences, quietHours: event.target.checked })}
              />
            </label>
            <label className="preference-row preference-row--select">
              <span>Digest frequency</span>
              <select
                value={preferences.digestFrequency || 'daily'}
                onChange={(event) => updatePreferences({ ...preferences, digestFrequency: event.target.value })}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="never">Never</option>
              </select>
            </label>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default NotificationCenterPage;
