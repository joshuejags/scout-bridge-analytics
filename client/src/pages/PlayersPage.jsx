import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Toast from '../components/Toast';
import './PlayersPage.css';

const PlayersPage = () => {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [position, setPosition] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamRes, playerRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_URL}/teams`),
          axios.get(`${process.env.REACT_APP_API_URL}/players`),
        ]);
        setTeams(teamRes.data);
        setPlayers(playerRes.data);
      } catch (err) {
        setError('Unable to load players or teams.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/players`, {
        name,
        team: teamId || null,
        position,
        jerseyNumber: jerseyNumber ? Number(jerseyNumber) : undefined,
      });
      setPlayers((prev) => [...prev, response.data]);
      setName('');
      setTeamId('');
      setPosition('');
      setJerseyNumber('');
      setMessage('Player added successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create player.');
    }
  };

  const handleDelete = async (playerId) => {
    if (!window.confirm('Delete this player?')) return;
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/players/${playerId}`);
      setPlayers((prev) => prev.filter((player) => player._id !== playerId));
      setMessage('Player deleted successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to delete player.');
    }
  };

  if (loading) {
    return <div className="players-page">Loading players...</div>;
  }

  return (
    <div className="players-page">
      <h2>Players</h2>
      {message && <Toast type="success" message={message} onClose={() => setMessage(null)} />}
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      <form className="player-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="playerName">Name</label>
          <input
            id="playerName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="playerTeam">Team</label>
          <select
            id="playerTeam"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team._id} value={team._id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="playerPosition">Position</label>
          <input
            id="playerPosition"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="jerseyNumber">Jersey Number</label>
          <input
            id="jerseyNumber"
            type="number"
            value={jerseyNumber}
            onChange={(e) => setJerseyNumber(e.target.value)}
          />
        </div>
        <button type="submit">Create Player</button>
      </form>

      <div className="player-list">
        {players.length === 0 ? (
          <p>No players yet.</p>
        ) : (
          <ul>
            {players.map((player) => (
              <li key={player._id} className="player-card">
                <div>
                  <strong>{player.name}</strong>
                  <p>{player.team?.name || 'No team assigned'}</p>
                  <p>{player.position || 'Position not set'} — #{player.jerseyNumber || '-'}</p>
                </div>
                <button onClick={() => handleDelete(player._id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PlayersPage;
