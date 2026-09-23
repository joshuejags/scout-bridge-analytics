import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Toast from '../components/Toast';
import SearchFilter from '../components/SearchFilter';
import { apiUrl } from '../utils/api';
import './TeamsPage.css';

const TeamsPage = () => {
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const response = await axios.get(apiUrl('/teams'), {
          params: { paginated: true, page, limit: 25, q: searchQuery || undefined },
        });
        const data = response.data;
        setTeams(data.items || []);
        setPagination(data.pagination || pagination);
      } catch (err) {
        setError('Unable to load teams.');
      } finally {
        setLoading(false);
      }
    }, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery]);

  const filteredTeams = teams;
  const summary = {
    total: pagination.total,
    filtered: pagination.total,
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const response = await axios.post(apiUrl('/teams'), {
        name,
        description,
      });
      setTeams((prev) => [...prev, response.data]);
      setName('');
      setDescription('');
      setMessage('Team added successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create team.');
    }
  };

  const startEdit = (team) => {
    setEditingTeamId(team._id);
    setEditName(team.name || '');
    setEditDescription(team.description || '');
    setError(null);
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingTeamId(null);
    setEditName('');
    setEditDescription('');
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingTeamId) return;
    try {
      const response = await axios.put(apiUrl(`/teams/${editingTeamId}`), {
        name: editName,
        description: editDescription,
      });
      setTeams((prev) => prev.map((team) => (team._id === editingTeamId ? response.data : team)));
      cancelEdit();
      setMessage('Team updated successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update team.');
    }
  };

  const handleDelete = async (teamId) => {
    if (!window.confirm('Delete this team?')) return;
    try {
      await axios.delete(apiUrl(`/teams/${teamId}`));
      setTeams((prev) => prev.filter((team) => team._id !== teamId));
      setMessage('Team deleted successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to delete team.');
    }
  };

  if (loading) {
    return <div className="page-shell team-page">Loading teams...</div>;
  }

  return (
    <div className="page-shell page-shell--wide team-page">
      <div className="page-header">
        <div className="page-heading">
          <div className="page-kicker">Team database</div>
          <h1 className="page-title">Organize teams and recruitment contexts.</h1>
          <p className="page-lead">
            Create team records, add descriptions, and search the rostered clubs available for analysis.
          </p>
        </div>
      </div>

      {message && <Toast type="success" message={message} onClose={() => setMessage(null)} />}
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-card__label">Total teams</p>
          <p className="kpi-card__value">{summary.total}</p>
          <p className="kpi-card__meta">Current team records</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Visible teams</p>
          <p className="kpi-card__value">{summary.filtered}</p>
          <p className="kpi-card__meta">After search filtering</p>
        </div>
      </div>

      <section className="surface-card teams-form-card">
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Add team</h2>
            <p className="card-subtitle">Create a team record for recruitment and match analysis.</p>
          </div>
        </div>
        <form className="team-form" onSubmit={handleSubmit}>
          <div className="teams-form-grid">
            <div className="form-row">
              <label htmlFor="teamName">Name</label>
              <input id="teamName" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-row teams-description-row">
              <label htmlFor="teamDescription">Description</label>
              <textarea id="teamDescription" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="button button-primary">
            Create team
          </button>
        </form>
      </section>

      <SearchFilter
        title="Team filters"
        placeholder="Search teams by name or description..."
        value={searchQuery}
        onChange={(value) => { setSearchQuery(value); setPage(1); }}
        summary={`${filteredTeams.length} visible`}
        onClear={() => { setSearchQuery(''); setPage(1); }}
      />

      <section className="surface-card teams-list-card">
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Teams</h2>
            <p className="card-subtitle">Maintain the club list used throughout uploads and player assignments.</p>
          </div>
        </div>

        {filteredTeams.length === 0 ? (
          <div className="empty-state-card">No teams match your search.</div>
        ) : (
          <div className="teams-grid">
            {filteredTeams.map((team) => (
              <article key={team._id} className="team-card surface-card">
                {editingTeamId === team._id ? (
                  <form className="team-form" onSubmit={handleUpdate}>
                    <div className="form-row">
                      <label htmlFor={`editTeamName-${team._id}`}>Name</label>
                      <input
                        id={`editTeamName-${team._id}`}
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        required
                      />
                    </div>
                    <div className="form-row">
                      <label htmlFor={`editTeamDescription-${team._id}`}>Description</label>
                      <textarea
                        id={`editTeamDescription-${team._id}`}
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                      />
                    </div>
                    <div className="team-card-actions">
                      <button type="submit" className="button button-primary">Save</button>
                      <button type="button" className="button button-secondary" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <strong>{team.name}</strong>
                      <p>{team.description || 'No description'}</p>
                    </div>
                    <div className="team-card-actions">
                      <Link to={`/teams/${team._id}/analytics`} className="button button-secondary">
                        View analytics
                      </Link>
                      <button type="button" className="button button-secondary" onClick={() => startEdit(team)}>
                        Edit
                      </button>
                      <button type="button" className="button button-danger" onClick={() => handleDelete(team._id)}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {pagination.totalPages > 1 && (
        <div className="card-title-row" style={{ marginTop: '1rem' }}>
          <span className="card-subtitle">Page {pagination.page} of {pagination.totalPages}</span>
          <div className="team-card-actions">
            <button type="button" className="button button-secondary" disabled={!pagination.hasPreviousPage || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
            <button type="button" className="button button-secondary" disabled={!pagination.hasNextPage || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsPage;
