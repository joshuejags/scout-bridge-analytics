import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './OrganizationSettingsPage.css';

const OrganizationSettingsPage = () => {
  const { token } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formState, setFormState] = useState({ name: '', type: 'club' });
  const [inviteState, setInviteState] = useState({ email: '', role: 'scout' });

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadOrganizations = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(apiUrl('/organizations/my'), { headers: authHeaders });
      const orgs = response.data.organizations || [];
      setOrganizations(orgs);
      if (!selectedOrganization && orgs[0]) {
        setSelectedOrganization(orgs[0]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load organizations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    loadOrganizations();
  }, [authHeaders, token]);

  const selectOrganization = async (organization) => {
    setSelectedOrganization(organization);
    try {
      const response = await axios.get(apiUrl(`/organizations/${organization._id}`), { headers: authHeaders });
      setOrganizations((prev) => prev.map((item) => (item._id === organization._id ? response.data.organization : item)));
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load organization details.');
    }
  };

  const createOrganization = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const response = await axios.post(apiUrl('/organizations'), formState, { headers: authHeaders });
      const nextOrg = response.data.organization;
      setOrganizations((prev) => [nextOrg, ...prev]);
      setSelectedOrganization(nextOrg);
      setFormState({ name: '', type: 'club' });
      setMessage('Organization created successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create organization.');
    }
  };

  const inviteMember = async (event) => {
    event.preventDefault();
    if (!selectedOrganization) return;
    try {
      await axios.post(apiUrl(`/organizations/${selectedOrganization._id}/invite`), inviteState, { headers: authHeaders });
      setInviteState({ email: '', role: 'scout' });
      setMessage('Invitation sent.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to send invitation.');
    }
  };

  const updateRole = async (memberId, role) => {
    if (!selectedOrganization) return;
    try {
      await axios.patch(apiUrl(`/organizations/${selectedOrganization._id}/members/${memberId}/role`), { role }, { headers: authHeaders });
      setOrganizations((prev) => prev.map((organization) => (organization._id === selectedOrganization._id ? {
        ...organization,
        members: organization.members.map((member) => (member._id === memberId ? { ...member, role } : member)),
      } : organization)));
      setSelectedOrganization((prev) => prev && { ...prev, members: prev.members.map((member) => (member._id === memberId ? { ...member, role } : member)) });
      setMessage('Member role updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update member role.');
    }
  };

  const removeMember = async (memberId) => {
    if (!selectedOrganization) return;
    try {
      await axios.delete(apiUrl(`/organizations/${selectedOrganization._id}/members/${memberId}`), { headers: authHeaders });
      setOrganizations((prev) => prev.map((organization) => (organization._id === selectedOrganization._id ? {
        ...organization,
        members: organization.members.filter((member) => member._id !== memberId),
      } : organization)));
      setSelectedOrganization((prev) => prev && { ...prev, members: prev.members.filter((member) => member._id !== memberId) });
      setMessage('Member removed.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to remove member.');
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading organizations..." />;
  }

  return (
    <div className="page-shell page-shell--wide">
      <div className="page-header">
        <div className="page-heading">
          <div className="page-kicker">Enterprise</div>
          <h1 className="page-title">Organization workspace</h1>
          <p className="page-lead">Create club or academy organizations, manage members, and keep your teams aligned through shared scouting workflows.</p>
        </div>
      </div>

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}

      <div className="saas-grid">
        <section className="surface-card saas-card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Organizations</h2>
              <p className="card-subtitle">Switch between clubs, academies, or partner scout groups.</p>
            </div>
          </div>

          <div className="organization-list">
            {organizations.map((organization) => (
              <button
                key={organization._id}
                type="button"
                className={`organization-item ${selectedOrganization?._id === organization._id ? 'organization-item--active' : ''}`}
                onClick={() => selectOrganization(organization)}
              >
                <div>
                  <strong>{organization.name}</strong>
                  <p>{organization.type}</p>
                </div>
                <span className="pill pill--neutral">{organization.members?.length || 0} members</span>
              </button>
            ))}
          </div>

          <form className="organization-form" onSubmit={createOrganization}>
            <h3>Create organization</h3>
            <input
              type="text"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Club or academy name"
              required
            />
            <select value={formState.type} onChange={(event) => setFormState((prev) => ({ ...prev, type: event.target.value }))}>
              <option value="club">Club</option>
              <option value="academy">Academy</option>
              <option value="scout">Scout org</option>
            </select>
            <button type="submit" className="button button-primary">Create organization</button>
          </form>
        </section>

        {selectedOrganization && (
          <section className="surface-card saas-card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">{selectedOrganization.name}</h2>
                <p className="card-subtitle">Manage members and approval workflows.</p>
              </div>
            </div>

            <div className="organization-summary">
              <div className="kpi-card">
                <p className="kpi-card__label">Members</p>
                <p className="kpi-card__value">{selectedOrganization.members?.length || 0}</p>
              </div>
              <div className="kpi-card">
                <p className="kpi-card__label">Status</p>
                <p className="kpi-card__value">{selectedOrganization.status || 'active'}</p>
              </div>
            </div>

            <form className="organization-form" onSubmit={inviteMember}>
              <h3>Invite member</h3>
              <input
                type="email"
                value={inviteState.email}
                onChange={(event) => setInviteState((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="member@club.com"
                required
              />
              <select value={inviteState.role} onChange={(event) => setInviteState((prev) => ({ ...prev, role: event.target.value }))}>
                <option value="scout">Scout</option>
                <option value="coach">Coach</option>
                <option value="analyst">Analyst</option>
                <option value="manager">Manager</option>
              </select>
              <button type="submit" className="button button-secondary">Send invite</button>
            </form>

            <div className="member-list">
              {selectedOrganization.members?.length ? selectedOrganization.members.map((member) => (
                <div key={member._id} className="member-item">
                  <div>
                    <strong>{member.email || member.user?.email || 'Member'}</strong>
                    <p>{member.role}</p>
                  </div>
                  <div className="member-item__actions">
                    <select value={member.role} onChange={(event) => updateRole(member._id, event.target.value)}>
                      <option value="scout">Scout</option>
                      <option value="coach">Coach</option>
                      <option value="analyst">Analyst</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button type="button" className="button button-secondary" onClick={() => removeMember(member._id)}>Remove</button>
                  </div>
                </div>
              )) : <div className="empty-state">No members yet. Invite your first scout or analyst to get started.</div>}
            </div>

            <div className="audit-log-list">
              <h3>Recent activity</h3>
              {selectedOrganization.auditLogs?.length ? selectedOrganization.auditLogs.slice(0, 6).map((entry, index) => (
                <div key={`${entry.action}-${index}`} className="audit-item">
                  <strong>{entry.action}</strong>
                  <p>{entry.details || 'Activity recorded'}</p>
                  <span>{new Date(entry.timestamp || Date.now()).toLocaleString()}</span>
                </div>
              )) : <div className="empty-state">No audit events recorded yet.</div>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default OrganizationSettingsPage;
