import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { apiUrl } from '../utils/api';
import { roleLabels } from '../config/workspace';
import './AdminPortalPage.css';

const ROLE_OPTIONS = ['admin', 'scout', 'team', 'player'];

const AdminPortalPage = () => {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyUserId, setBusyUserId] = useState(null);
  const [retryingJobId, setRetryingJobId] = useState(null);

  const loadPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, usersRes, jobsRes] = await Promise.all([
        axios.get(apiUrl('/admin/summary')),
        axios.get(apiUrl('/auth/users')),
        axios.get(apiUrl('/admin/jobs')),
      ]);
      setSummary(summaryRes.data);
      setUsers(usersRes.data);
      setJobs(jobsRes.data.items || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load the admin portal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortal();
  }, []);

  const roleMix = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.users.byRole).map(([role, count]) => ({
      role,
      count,
    }));
  }, [summary]);

  const updateRole = async (userId, role) => {
    setBusyUserId(userId);
    setError(null);
    try {
      const response = await axios.patch(apiUrl(`/auth/users/${userId}/role`), { role });
      setUsers((prev) => prev.map((user) => (user._id === userId ? response.data : user)));
      setMessage(`Updated user role to ${roleLabels[role] || role}.`);
      await loadPortal();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update role.');
    } finally {
      setBusyUserId(null);
    }
  };

  const retryJob = async (jobId) => {
    setRetryingJobId(jobId);
    setError(null);
    try {
      await axios.post(apiUrl(`/admin/jobs/${jobId}/retry`));
      setMessage('Job moved back to the queue.');
      await loadPortal();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to retry job.');
    } finally {
      setRetryingJobId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading admin portal..." />;
  }

  return (
    <div className="page-shell page-shell--wide admin-portal">
      <div className="page-header">
        <div className="page-heading">
          <div className="page-kicker">Admin portal</div>
          <h1 className="page-title">Operate the platform like a premium scouting SaaS.</h1>
          <p className="page-lead">
            Manage users, moderate video processing, and monitor platform-level analytics from one control surface.
          </p>
        </div>
        <div className="page-toolbar">
          <Link to="/dashboard" className="button button-secondary">Open analytics</Link>
          <Link to="/players" className="button button-ghost">Review player database</Link>
        </div>
      </div>

      {message && <Toast type="success" message={message} onClose={() => setMessage(null)} />}
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      {summary && (
        <>
          <div className="kpi-grid admin-kpi-grid">
            <div className="kpi-card">
              <p className="kpi-card__label">Users</p>
              <p className="kpi-card__value">{summary.users.total}</p>
              <p className="kpi-card__meta">{summary.users.pendingVerification} waiting for verification</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-card__label">Teams</p>
              <p className="kpi-card__value">{summary.content.teams}</p>
              <p className="kpi-card__meta">Club and opposition workspaces</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-card__label">Players</p>
              <p className="kpi-card__value">{summary.content.players}</p>
              <p className="kpi-card__meta">Profiles available to scouting flows</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-card__label">Failed jobs</p>
              <p className="kpi-card__value">{summary.jobs.failed}</p>
              <p className="kpi-card__meta">Processing items that need moderation</p>
            </div>
          </div>

          <div className="admin-layout">
            <section className="surface-card admin-card">
              <div className="card-title-row">
                <div>
                  <h2 className="card-title">User management</h2>
                  <p className="card-subtitle">Assign the correct workspace for each account.</p>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user._id}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          <select
                            value={user.role}
                            disabled={busyUserId === user._id}
                            onChange={(e) => updateRole(user._id, e.target.value)}
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {roleLabels[role]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span className={`pill ${user.emailVerified ? 'pill--success' : 'pill--warning'}`}>
                            {user.emailVerified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="admin-side">
              <section className="surface-card admin-card">
                <div className="card-title-row">
                  <div>
                    <h2 className="card-title">Role distribution</h2>
                    <p className="card-subtitle">Check whether the portal mix matches your customer base.</p>
                  </div>
                </div>
                <div className="admin-role-list">
                  {roleMix.map((entry) => (
                    <div key={entry.role} className="admin-role-item">
                      <div>
                        <strong>{roleLabels[entry.role]}</strong>
                        <p>{entry.count} account{entry.count === 1 ? '' : 's'}</p>
                      </div>
                      <span className="pill pill--neutral">{entry.role}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="surface-card admin-card">
                <div className="card-title-row">
                  <div>
                    <h2 className="card-title">Processing moderation</h2>
                    <p className="card-subtitle">Failed and queued jobs that impact trust in the platform.</p>
                  </div>
                </div>
                <div className="admin-job-list">
                  {jobs.length === 0 ? (
                    <div className="empty-state">No active jobs to review.</div>
                  ) : (
                    jobs.slice(0, 8).map((job) => (
                      <div key={job._id} className="admin-job-item">
                        <div>
                          <strong>{job.originalName}</strong>
                          <p>{job.status}{job.lastError ? ` · ${job.lastError}` : ''}</p>
                        </div>
                        {job.status === 'failed' ? (
                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={retryingJobId === job._id}
                            onClick={() => retryJob(job._id)}
                          >
                            {retryingJobId === job._id ? 'Retrying...' : 'Retry'}
                          </button>
                        ) : (
                          <span className="pill pill--neutral">{job.status}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPortalPage;
