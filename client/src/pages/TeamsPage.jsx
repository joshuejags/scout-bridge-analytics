import React, { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await axios.get(apiUrl('/teams'));
        setTeams(response.data);
      } catch (err) {
        setError('Unable to load teams.');
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  const filteredTeams = useMemo(
    () =>
      teams.filter((team) => {
        const haystack = `${team.name} ${team.description || ''}`.toLowerCase();
        return !searchQuery || haystack.includes(searchQuery.toLowerCase());
      }),
    [teams, searchQuery]
  );

  const summary = useMemo(
    () => ({
      total: teams.length,
      filtered: filteredTeams.length,
    }),
    [teams.length, filteredTeams.length]
  );

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
        onChange={setSearchQuery}
        summary={`${filteredTeams.length} visible`}
        onClear={() => setSearchQuery('')}
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
                <div>
                  <strong>{team.name}</strong>
                  <p>{team.description || 'No description'}</p>
                </div>
                <button type="button" className="button button-danger" onClick={() => handleDelete(team._id)}>
                  Delete
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default TeamsPage;
