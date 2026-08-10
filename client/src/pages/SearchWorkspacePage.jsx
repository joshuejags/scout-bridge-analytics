import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import SearchFilter from '../components/SearchFilter';
import SavedFilterPresets from '../components/SavedFilterPresets';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { apiUrl } from '../utils/api';
import './SearchWorkspacePage.css';

const ENTITY_OPTIONS = [
  { id: 'all', label: 'All results' },
  { id: 'player', label: 'Players' },
  { id: 'team', label: 'Teams' },
  { id: 'video', label: 'Videos' },
  { id: 'report', label: 'Reports' },
];

const SearchWorkspacePage = () => {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [videos, setVideos] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clubFilter, setClubFilter] = useState('all');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [heightFilter, setHeightFilter] = useState('all');
  const [weightFilter, setWeightFilter] = useState('all');

  useEffect(() => {
    const loadWorkspaceSearchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [playersResponse, teamsResponse, videosResponse, reportsResponse] = await Promise.allSettled([
          axios.get(apiUrl('/players')),
          axios.get(apiUrl('/teams')),
          axios.get(apiUrl('/videos')),
          axios.get(apiUrl('/reports/saved')),
        ]);

        if (playersResponse.status === 'fulfilled') {
          setPlayers(normalizeCollection(playersResponse.value.data));
        }
        if (teamsResponse.status === 'fulfilled') {
          setTeams(normalizeCollection(teamsResponse.value.data));
        }
        if (videosResponse.status === 'fulfilled') {
          setVideos(normalizeCollection(videosResponse.value.data));
        }
        if (reportsResponse.status === 'fulfilled') {
          setReports(normalizeCollection(reportsResponse.value.data));
        }

        const failures = [playersResponse, teamsResponse, videosResponse, reportsResponse].filter(
          (result) => result.status === 'rejected'
        );
        if (failures.length) {
          setError('Some workspace data could not be loaded. Search results may be partial.');
        }
      } catch (err) {
        console.error('Error loading workspace search data:', err);
        setError(err.response?.data?.error || 'Unable to load the global search workspace.');
      } finally {
        setLoading(false);
      }
    };

    loadWorkspaceSearchData();
  }, []);

  const positionOptions = useMemo(() => {
    const values = players
      .map((player) => player.position)
      .filter(Boolean)
      .sort();
    return ['all', ...Array.from(new Set(values))];
  }, [players]);

  const statusOptions = useMemo(() => {
    const values = videos
      .map((video) => video.status)
      .filter(Boolean)
      .sort();
    return ['all', ...Array.from(new Set(values))];
  }, [videos]);

  const clubOptions = useMemo(() => {
    const values = teams.map((team) => team.name).filter(Boolean).sort();
    return ['all', ...Array.from(new Set(values))];
  }, [teams]);

  const leagueOptions = useMemo(() => {
    const values = teams
      .map((team) => team.league)
      .filter(Boolean)
      .sort();
    return ['all', ...Array.from(new Set(values))];
  }, [teams]);

  const countryOptions = useMemo(() => {
    const values = [
      ...players.map((player) => player.nationality).filter(Boolean),
      ...teams.map((team) => team.country).filter(Boolean),
    ].sort();
    return ['all', ...Array.from(new Set(values))];
  }, [players, teams]);

  const results = useMemo(() => {
    const queryText = query.trim().toLowerCase();

    const playerResults = players
      .filter((player) => {
        const matchesQuery = !queryText || buildSearchText(player).includes(queryText);
        const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
        const matchesClub = clubFilter === 'all' || player.team?.name === clubFilter;
        const matchesLeague = leagueFilter === 'all' || player.team?.league === leagueFilter;
        const matchesCountry = countryFilter === 'all' || player.nationality === countryFilter;
        const matchesAge = evaluateAge(player.age, ageFilter);
        const matchesHeight = evaluateHeight(player.heightCm, heightFilter);
        const matchesWeight = evaluateWeight(player.weightKg, weightFilter);
        return matchesQuery && matchesPosition && matchesClub && matchesLeague && matchesCountry && matchesAge && matchesHeight && matchesWeight;
      })
      .map((player) => ({
        id: player._id,
        type: 'player',
        title: player.name,
        subtitle: player.team?.name || 'Unassigned club',
        meta: [
          player.position,
          player.jerseyNumber ? `#${player.jerseyNumber}` : null,
          player.age ? `${player.age}y` : null,
          player.heightCm ? `${player.heightCm}cm` : null,
          player.weightKg ? `${player.weightKg}kg` : null,
        ].filter(Boolean).join(' • '),
        to: `/players/${player._id}`,
      }));

    const teamResults = teams
      .filter((team) => {
        const matchesQuery = !queryText || buildSearchText(team).includes(queryText);
        const matchesClub = clubFilter === 'all' || team.name === clubFilter;
        const matchesLeague = leagueFilter === 'all' || team.league === leagueFilter;
        const matchesCountry = countryFilter === 'all' || team.country === countryFilter;
        return matchesQuery && matchesClub && matchesLeague && matchesCountry;
      })
      .map((team) => ({
        id: team._id,
        type: 'team',
        title: team.name,
        subtitle: team.league || 'Football club',
        meta: [team.country, team.tier].filter(Boolean).join(' • '),
        to: '/teams',
      }));

    const videoResults = videos
      .filter((video) => {
        const matchesQuery = !queryText || buildSearchText(video).includes(queryText);
        const matchesStatus = statusFilter === 'all' || video.status === statusFilter;
        return matchesQuery && matchesStatus;
      })
      .map((video) => ({
        id: video._id,
        type: 'video',
        title: video.originalName || 'Uploaded video',
        subtitle: video.sport || 'soccer',
        meta: [video.status, video.createdAt ? new Date(video.createdAt).toLocaleDateString() : null].filter(Boolean).join(' • '),
        to: `/analysis/${video._id}`,
      }));

    const reportResults = reports
      .filter((report) => {
        const matchesQuery = !queryText || buildSearchText(report).includes(queryText);
        return matchesQuery;
      })
      .map((report) => ({
        id: report._id,
        type: 'report',
        title: report.title || 'Saved scouting report',
        subtitle: report.video?.originalName || 'Scouting report',
        meta: [report.template, (report.tags || []).slice(0, 2).join(', ')].filter(Boolean).join(' • '),
        to: '/reports',
      }));

    const groupedResults = [...playerResults, ...teamResults, ...videoResults, ...reportResults];
    if (entityType === 'all') {
      return groupedResults;
    }
    return groupedResults.filter((result) => result.type === entityType);
  }, [ageFilter, clubFilter, countryFilter, entityType, heightFilter, leagueFilter, players, positionFilter, query, reports, statusFilter, teams, videos, weightFilter]);

  const currentFilters = useMemo(
    () => ({
      query,
      entityType,
      positionFilter,
      statusFilter,
      clubFilter,
      leagueFilter,
      countryFilter,
      ageFilter,
      heightFilter,
      weightFilter,
    }),
    [ageFilter, clubFilter, countryFilter, entityType, heightFilter, leagueFilter, positionFilter, query, statusFilter, weightFilter]
  );

  const handleApplyPreset = (preset) => {
    setQuery(preset.filters?.query || '');
    setEntityType(preset.filters?.entityType || 'all');
    setPositionFilter(preset.filters?.positionFilter || 'all');
    setStatusFilter(preset.filters?.statusFilter || 'all');
    setClubFilter(preset.filters?.clubFilter || 'all');
    setLeagueFilter(preset.filters?.leagueFilter || 'all');
    setCountryFilter(preset.filters?.countryFilter || 'all');
    setAgeFilter(preset.filters?.ageFilter || 'all');
    setHeightFilter(preset.filters?.heightFilter || 'all');
    setWeightFilter(preset.filters?.weightFilter || 'all');
  };

  const resetFilters = () => {
    setQuery('');
    setEntityType('all');
    setPositionFilter('all');
    setStatusFilter('all');
    setClubFilter('all');
    setLeagueFilter('all');
    setCountryFilter('all');
    setAgeFilter('all');
    setHeightFilter('all');
    setWeightFilter('all');
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading workspace search..." />;
  }

  return (
    <div className="page-shell page-shell--wide search-workspace-page">
      <div className="page-header">
        <div className="page-heading">
          <div className="page-kicker">Global search</div>
          <h1 className="page-title">Find the right player, report, or video faster.</h1>
          <p className="page-lead">
            Use a premium search workspace to move from broad discovery to a precise shortlist without leaving the platform.
          </p>
        </div>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      <SavedFilterPresets scope="search" currentFilters={currentFilters} onApplyPreset={handleApplyPreset} />

      <SearchFilter
        title="Workspace search"
        placeholder="Search players, teams, videos, and reports..."
        value={query}
        onChange={setQuery}
        summary={`${results.length} matches`}
        onClear={resetFilters}
        filters={ENTITY_OPTIONS.map((option) => ({ id: option.id, label: option.label, active: entityType === option.id }))}
        onFilterChange={setEntityType}
      />

      <section className="search-workspace-page__filters surface-card">
        <div className="search-workspace-page__filter-group">
          <label>
            <span>Position</span>
            <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
              {positionOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All positions' : option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Club</span>
            <select value={clubFilter} onChange={(event) => setClubFilter(event.target.value)}>
              {clubOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All clubs' : option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>League</span>
            <select value={leagueFilter} onChange={(event) => setLeagueFilter(event.target.value)}>
              {leagueOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All leagues' : option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Country</span>
            <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}>
              {countryOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All countries' : option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Age</span>
            <select value={ageFilter} onChange={(event) => setAgeFilter(event.target.value)}>
              <option value="all">All ages</option>
              <option value="under-20">Under 20</option>
              <option value="20-24">20-24</option>
              <option value="25-29">25-29</option>
              <option value="30+">30+</option>
            </select>
          </label>

          <label>
            <span>Height</span>
            <select value={heightFilter} onChange={(event) => setHeightFilter(event.target.value)}>
              <option value="all">Any height</option>
              <option value="under-180">Under 180cm</option>
              <option value="180-188">180-188cm</option>
              <option value="188+">188cm+</option>
            </select>
          </label>

          <label>
            <span>Weight</span>
            <select value={weightFilter} onChange={(event) => setWeightFilter(event.target.value)}>
              <option value="all">Any weight</option>
              <option value="under-70">Under 70kg</option>
              <option value="70-80">70-80kg</option>
              <option value="80+">80kg+</option>
            </select>
          </label>

          <label>
            <span>Video status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All statuses' : option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="button" className="button button-ghost" onClick={resetFilters}>
          Reset filters
        </button>
      </section>

      <section className="search-workspace-page__grid">
        <article className="surface-card search-workspace-page__summary">
          <h2 className="card-title">Search highlights</h2>
          <div className="search-workspace-page__stats">
            <div>
              <strong>{players.length}</strong>
              <span>Players</span>
            </div>
            <div>
              <strong>{teams.length}</strong>
              <span>Teams</span>
            </div>
            <div>
              <strong>{videos.length}</strong>
              <span>Videos</span>
            </div>
            <div>
              <strong>{reports.length}</strong>
              <span>Reports</span>
            </div>
          </div>
          <p className="search-workspace-page__hint">
            Search moves across intelligence-backed surfaces so scouts can move from discovery to review in a single click.
          </p>
        </article>

        <article className="surface-card search-workspace-page__results">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Matching workspace assets</h2>
              <p className="card-subtitle">Grouped results keep your shortlist visible and easy to act on.</p>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="empty-state-card">No matches yet. Relax the filters or change the search query to widen the scope.</div>
          ) : (
            <div className="search-workspace-page__result-list">
              {results.map((result) => (
                <Link key={`${result.type}-${result.id}`} to={result.to} className="search-workspace-page__result-item">
                  <div className="search-workspace-page__result-copy">
                    <div className="search-workspace-page__result-title-row">
                      <strong>{result.title}</strong>
                      <span className="pill pill--neutral">{result.type}</span>
                    </div>
                    <p>{result.subtitle}</p>
                    <small>{result.meta}</small>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
};

function normalizeCollection(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function buildSearchText(item) {
  const values = [
    item.name,
    item.originalName,
    item.title,
    item.summary,
    item.sport,
    item.status,
    item.position,
    item.team?.name,
    item.league,
    item.country,
    item.template,
    ...(Array.isArray(item.tags) ? item.tags : []),
  ];
  return values.filter(Boolean).join(' ').toLowerCase();
}

function evaluateAge(age, ageFilter) {
  if (ageFilter === 'all' || age == null) return true;
  if (ageFilter === 'under-20') return age < 20;
  if (ageFilter === '20-24') return age >= 20 && age <= 24;
  if (ageFilter === '25-29') return age >= 25 && age <= 29;
  if (ageFilter === '30+') return age >= 30;
  return true;
}

function evaluateHeight(height, heightFilter) {
  if (heightFilter === 'all' || height == null) return true;
  if (heightFilter === 'under-180') return height < 180;
  if (heightFilter === '180-188') return height >= 180 && height <= 188;
  if (heightFilter === '188+') return height >= 188;
  return true;
}

function evaluateWeight(weight, weightFilter) {
  if (weightFilter === 'all' || weight == null) return true;
  if (weightFilter === 'under-70') return weight < 70;
  if (weightFilter === '70-80') return weight >= 70 && weight <= 80;
  if (weightFilter === '80+') return weight >= 80;
  return true;
}

export default SearchWorkspacePage;
