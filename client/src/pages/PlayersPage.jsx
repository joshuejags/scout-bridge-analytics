import React, { useEffect, useState } from 'react';
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
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [nationality, setNationality] = useState('');
  const [preferredFoot, setPreferredFoot] = useState('');
  const [contractStatus, setContractStatus] = useState('');
  const [profileSummary, setProfileSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false });
  const [editPlayer, setEditPlayer] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const [teamRes, playerRes] = await Promise.all([
          axios.get(apiUrl('/teams'), { params: { paginated: true, limit: 100 } }),
          axios.get(apiUrl('/players'), {
            params: {
              paginated: true,
              page,
              limit: 25,
              q: searchQuery || undefined,
              teamAssigned: activeFilter === 'assigned' ? 'true' : activeFilter === 'unassigned' ? 'false' : undefined,
              hasJersey: activeFilter === 'num' ? 'true' : undefined,
            },
          }),
        ]);
        const teamData = teamRes.data.items || teamRes.data;
        const playerData = playerRes.data;
        setTeams(teamData);
        setPlayers(playerData.items || []);
        setPagination(playerData.pagination || pagination);
      } catch (err) {
        setError('Unable to load players or teams.');
      } finally {
        setLoading(false);
      }
    }, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery, activeFilter]);

  const summary = {
    total: pagination.total,
    assigned: activeFilter === 'assigned' ? pagination.total : '—',
    numbered: activeFilter === 'num' ? pagination.total : '—',
    selected: selectedForCompare.length,
  };

  const filteredPlayers = players;

  const currentPlayerFilters = { searchQuery, activeFilter };

  const handleApplyPreset = (preset) => {
    setSearchQuery(preset.filters?.searchQuery || '');
    setActiveFilter(preset.filters?.activeFilter || 'all');
    setPage(1);
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
       age: age ? Number(age) : undefined,
       heightCm: heightCm ? Number(heightCm) : undefined,
       weightKg: weightKg ? Number(weightKg) : undefined,
       nationality: nationality || undefined,
       preferredFoot: preferredFoot || undefined,
       contractStatus: contractStatus || undefined,
       profileSummary: profileSummary || undefined,
      });
      setPlayers((prev) => [...prev, response.data]);
      setName('');
      setTeamId('');
      setPosition('');
      setJerseyNumber('');
      setAge('');
      setHeightCm('');
      setWeightKg('');
      setNationality('');
      setPreferredFoot('');
      setContractStatus('');
      setProfileSummary('');
      setMessage('Player added successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create player.');
    }
  };

  const startEdit = (player) => {
    setEditingPlayerId(player._id);
    setEditPlayer({
      name: player.name || '',
      team: player.team?._id || '',
      position: player.position || '',
      jerseyNumber: player.jerseyNumber ?? '',
      age: player.age ?? '',
      heightCm: player.heightCm ?? '',
      weightKg: player.weightKg ?? '',
      nationality: player.nationality || '',
      preferredFoot: player.preferredFoot || '',
      contractStatus: player.contractStatus || '',
      profileSummary: player.profileSummary || '',
    });
    setError(null);
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingPlayerId(null);
    setEditPlayer({});
  };

  const updateEditPlayer = (field, value) => {
    setEditPlayer((prev) => ({ ...prev, [field]: value }));
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingPlayerId) return;
    try {
      const payload = {
        ...editPlayer,
        team: editPlayer.team || null,
        jerseyNumber: editPlayer.jerseyNumber === '' ? null : Number(editPlayer.jerseyNumber),
        age: editPlayer.age === '' ? null : Number(editPlayer.age),
        heightCm: editPlayer.heightCm === '' ? null : Number(editPlayer.heightCm),
        weightKg: editPlayer.weightKg === '' ? null : Number(editPlayer.weightKg),
      };
      const response = await axios.put(apiUrl(`/players/${editingPlayerId}`), payload);
      const team = teams.find((item) => item._id === response.data.team);
      setPlayers((prev) =>
        prev.map((player) =>
          player._id === editingPlayerId
            ? { ...response.data, team: team || null }
            : player
        )
      );
      cancelEdit();
      setMessage('Player updated successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update player.');
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
            <div className="form-row">
              <label htmlFor="playerAge">Age</label>
              <input id="playerAge" type="number" min="0" max="60" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="playerHeight">Height (cm)</label>
              <input id="playerHeight" type="number" min="130" max="220" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="playerWeight">Weight (kg)</label>
              <input id="playerWeight" type="number" min="40" max="180" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="playerNationality">Nationality</label>
              <input id="playerNationality" value={nationality} onChange={(e) => setNationality(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="playerPreferredFoot">Preferred foot</label>
              <input id="playerPreferredFoot" value={preferredFoot} onChange={(e) => setPreferredFoot(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="playerContractStatus">Contract status</label>
              <input id="playerContractStatus" value={contractStatus} onChange={(e) => setContractStatus(e.target.value)} />
            </div>
            <div className="form-row">
              <label htmlFor="playerProfileSummary">Profile summary</label>
              <input id="playerProfileSummary" value={profileSummary} onChange={(e) => setProfileSummary(e.target.value)} />
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
        onChange={(value) => { setSearchQuery(value); setPage(1); }}
        filters={filterOptions.map((filter) => ({ ...filter, active: activeFilter === filter.id }))}
        onFilterChange={(value) => { setActiveFilter(value); setPage(1); }}
        onClear={() => {
          setSearchQuery('');
          setActiveFilter('all');
          setPage(1);
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
{editingPlayerId === player._id ? (
                  <form className="player-form" onSubmit={handleUpdate}>
                    <div className="players-form-grid">
                      {[
                        ['name', 'Name', 'text'],
                        ['position', 'Position', 'text'],
                        ['jerseyNumber', 'Jersey number', 'number'],
                        ['age', 'Age', 'number'],
                        ['heightCm', 'Height (cm)', 'number'],
                        ['weightKg', 'Weight (kg)', 'number'],
                        ['nationality', 'Nationality', 'text'],
                        ['preferredFoot', 'Preferred foot', 'text'],
                        ['contractStatus', 'Contract status', 'text'],
                        ['profileSummary', 'Profile summary', 'text'],
                      ].map(([field, label, type]) => (
                        <div className="form-row" key={field}>
                          <label htmlFor={`editPlayer-${field}-${player._id}`}>{label}</label>
                          <input
                            id={`editPlayer-${field}-${player._id}`}
                            type={type}
                            value={editPlayer[field] ?? ''}
                            onChange={(event) => updateEditPlayer(field, event.target.value)}
                          />
                        </div>
                      ))}
                      <div className="form-row">
                        <label htmlFor={`editPlayer-team-${player._id}`}>Team</label>
                        <select
                          id={`editPlayer-team-${player._id}`}
                          value={editPlayer.team || ''}
                          onChange={(event) => updateEditPlayer('team', event.target.value)}
                        >
                          <option value="">No team</option>
                          {teams.map((team) => (
                            <option key={team._id} value={team._id}>{team.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="player-card-actions">
                      <button type="submit" className="button button-primary">Save</button>
                      <button type="button" className="button button-secondary" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
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
                  {player.jerseyNumber != null ? ` · jersey #${player.jerseyNumber}` : ' · no jersey number set'}
                  {player.age ? ` · ${player.age}y` : ''}
                  {player.heightCm ? ` · ${player.heightCm}cm` : ''}
                  {player.weightKg ? ` · ${player.weightKg}kg` : ''}
                  {player.nationality ? ` · ${player.nationality}` : ''}
                </p>

                <div className="player-card-actions">
                  <Link to={`/players/${player._id}`} className="button button-secondary">
                    View profile
                  </Link>
                  <button type="button" className="button button-secondary" onClick={() => startEdit(player)}>
                    Edit
                  </button>
                  <button type="button" className="button button-danger" onClick={() => handleDelete(player._id)}>
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
          <div className="player-card-actions">
            <button type="button" className="button button-secondary" disabled={!pagination.hasPreviousPage || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
            <button type="button" className="button button-secondary" disabled={!pagination.hasNextPage || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default PlayersPage;
