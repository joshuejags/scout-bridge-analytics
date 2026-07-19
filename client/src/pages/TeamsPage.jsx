import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Toast from '../components/Toast';
import './TeamsPage.css';

const TeamsPage = () => {
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/teams`);
        setTeams(response.data);
      } catch (err) {
        setError('Unable to load teams.');
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/teams`, {
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
      await axios.delete(`${process.env.REACT_APP_API_URL}/teams/${teamId}`);
      setTeams((prev) => prev.filter((team) => team._id !== teamId));
      setMessage('Team deleted successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to delete team.');
    }
  };

  if (loading) {
    return <div className="team-page">Loading teams...</div>;
  }

  return (
    <div className="team-page">
      <h2>Teams</h2>
      {message && <Toast type="success" message={message} onClose={() => setMessage(null)} />}
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      <form className="team-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="teamName">Name</label>
          <input
            id="teamName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="teamDescription">Description</label>
          <textarea
            id="teamDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button type="submit">Create Team</button>
      </form>

      <div className="team-list">
        {teams.length === 0 ? (
          <p>No teams yet.</p>
        ) : (
          <ul>
            {teams.map((team) => (
              <li key={team._id} className="team-card">
                <div>
                  <strong>{team.name}</strong>
                  <p>{team.description || 'No description'}</p>
                </div>
                <button onClick={() => handleDelete(team._id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TeamsPage;
