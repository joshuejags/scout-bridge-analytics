import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Toast from '../components/Toast';
import SearchFilter from '../components/SearchFilter';
import SavedFilterPresets from '../components/SavedFilterPresets';
import { apiUrl } from '../utils/api';
import './PlayersPage.css';

const filterOptions = [
  { id: 'all', label: 'All players' },
  { id: 'assigned', label: 'Assigned team' },
  { id: 'unassigned', label: 'No team' },
  { id: 'num', label: 'With jersey number' },
];

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
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamRes, playerRes] = await Promise.all([
          axios.get(apiUrl('/teams')),
          axios.get(apiUrl('/players')),
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

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const haystack = [player.name, player.position, player.team?.name, player.jerseyNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !searchQuery || haystack.includes(searchQuery.toLowerCase());
      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'assigned' && player.team) ||
        (activeFilter === 'unassigned' && !player.team) ||
        (activeFilter === 'num' && player.jerseyNumber != null);
      return matchesSearch && matchesFilter;
    });
  }, [players, searchQuery, activeFilter]);

  const summary = useMemo(() => {
    const assigned = players.filter((player) => player.team).length;
    const numbered = players.filter((player) => player.jerseyNumber != null).length;
    return {
      total: players.length,
      assigned,
      numbered,
      selected: selectedForCompare.length,
    };
  }, [players, selectedForCompare.length]);

  const currentPlayerFilters = useMemo(() => ({ searchQuery, activeFilter }), [searchQuery, activeFilter]);

  const handleApplyPreset = (preset) => {
    setSearchQuery(preset.filters?.searchQuery || '');
    setActiveFilter(preset.filters?.activeFilter || 'all');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    try {
      const response = await axios.post(apiUrl('/players'), {
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
      await axios.delete(apiUrl(`/players/${playerId}`));
      setPlayers((prev) => prev.filter((player) => player._id !== playerId));
      setSelectedForCompare((prev) => prev.filter((id) => id !== playerId));
      setMessage('Player deleted successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to delete player.');
    }
  };

  const toggleCompareSelection = (playerId) => {
    setSelectedForCompare((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  };

  if (loading) {
    return <div className="page-shell players-page">Loading players...</div>;
  }

  return (
    <div className="page-shell page-shell--wide players-page">
      <div className="page-header">
        <div className="page-heading">
          <div className="page-kicker">Player database</div>
          <h1 className="page-title">Build and compare your scouting shortlist.</h1>
          <p className="page-lead">
            Add rostered players, search the library, and launch comparisons from a single page.
          </p>
        </div>
      </div>

      {message && <Toast type="success" message={message} onClose={() => setMessage(null)} />}
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      <div className="kpi-grid players-kpis">
        <div className="kpi-card">
          <p className="kpi-card__label">Total players</p>
          <p className="kpi-card__value">{summary.total}</p>
          <p className="kpi-card__meta">Current roster entries</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Assigned</p>
          <p className="kpi-card__value">{summary.assigned}</p>
          <p className="kpi-card__meta">Linked to a team</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">With jersey number</p>
          <p className="kpi-card__value">{summary.numbered}</p>
          <p className="kpi-card__meta">Ready for OCR matching</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Comparison queue</p>
          <p className="kpi-card__value">{summary.selected}</p>
          <p className="kpi-card__meta">Players selected for compare</p>
        </div>
      </div>

      <section className="surface-card players-form-card">
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Add player</h2>
            <p className="card-subtitle">Create roster entries for recruitment and verification workflows.</p>
          </div>
        </div>
        <form className="player-form" onSubmit={handleSubmit}>
          <div className="players-form-grid">
            <div className="form-row">
              <label htmlFor="playerName">Name</label>
              <input id="playerName" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-row">
              <label htmlFor="playerTeam">Team</label>
              <select id="playerTeam" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
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
              <input id="playerPosition" value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="jerseyNumber">Jersey number</label>
              <input
                id="jerseyNumber"
                type="number"
                min="0"
                max="99"
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="button button-primary">
            Create player
          </button>
        </form>
      </section>

      <SavedFilterPresets scope="players" currentFilters={currentPlayerFilters} onApplyPreset={handleApplyPreset} />

      <SearchFilter
        title="Player filters"
        placeholder="Search by name, position, team, or jersey..."
        value={searchQuery}
        onChange={setSearchQuery}
        filters={filterOptions.map((filter) => ({ ...filter, active: activeFilter === filter.id }))}
        onFilterChange={setActiveFilter}
        onClear={() => {
          setSearchQuery('');
          setActiveFilter('all');
        }}
        summary={`${filteredPlayers.length} visible`}
      />

      {selectedForCompare.length > 0 && (
        <div className="compare-bar surface-card">
          <span>
            {selectedForCompare.length} player{selectedForCompare.length === 1 ? '' : 's'} selected
          </span>
          <div className="compare-bar-actions">
            <button
              type="button"
              className="button button-primary compare-btn"
              disabled={selectedForCompare.length < 2}
              onClick={() => navigate(`/players/compare?ids=${selectedForCompare.join(',')}`)}
            >
              Compare
            </button>
            <button type="button" className="button button-secondary compare-clear-btn" onClick={() => setSelectedForCompare([])}>
              Clear
            </button>
          </div>
        </div>
      )}

      <section className="surface-card players-list-card">
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Players</h2>
            <p className="card-subtitle">Open a profile or select players to compare side by side.</p>
          </div>
        </div>

        {filteredPlayers.length === 0 ? (
          <div className="empty-state-card">No players match your search or filter.</div>
        ) : (
          <div className="players-grid">
            {filteredPlayers.map((player) => (
              <article key={player._id} className="player-card surface-card">
                <div className="player-card-top">
                  <label className="player-compare-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedForCompare.includes(player._id)}
                      onChange={() => toggleCompareSelection(player._id)}
                      aria-label={`Select ${player.name} for comparison`}
                    />
                  </label>
                  <div className="player-card-name">
                    <strong>{player.name}</strong>
                    <p>{player.team?.name || 'No team assigned'}</p>
                  </div>
                  <div className="player-card-badges">
                    {player.position && <span className="pill pill--neutral">{player.position}</span>}
                    {player.jerseyNumber != null && <span className="pill pill--success">#{player.jerseyNumber}</span>}
                  </div>
                </div>

                <p className="player-card-summary">
                  {player.position || 'Position not set'}
                  {player.jerseyNumber != null
                    ? ` · jersey #${player.jerseyNumber}`
                    : ' · no jersey number set'}
                </p>

                <div className="player-card-actions">
                  <Link to={`/players/${player._id}`} className="button button-secondary">
                    View profile
                  </Link>
                  <button type="button" className="button button-danger" onClick={() => handleDelete(player._id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

    </div>
  );
};

export default PlayersPage;
