import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { apiUrl } from '../utils/api';
import './PlayerProfilePage.css';

const PlayerProfilePage = () => {
  const { playerId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(apiUrl(`/players/${playerId}/profile`));
        setProfile(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Unable to load player profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [playerId]);

  const recommendation = useMemo(() => {
    if (!profile) return null;
    if (profile.summary.matchesPlayed === 0) return 'Profile has no match analysis yet.';
    if (profile.summary.totalDistanceCovered > 6000) return 'High movement output profile; useful for high-intensity roles.';
    if (profile.summary.totalActions > 6) return 'Action-heavy profile; worth deeper clip review.';
    return 'Emerging profile; keep tracking across additional matches.';
  }, [profile]);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading player profile..." />;
  }

  if (error) {
    return (
      <div className="page-shell player-profile-page">
        {error && <Toast type="error" message={error} onClose={() => setError(null)} />}
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide player-profile-page">
      <div className="page-header">
        <div className="page-heading">
          <div className="page-kicker">Player profile</div>
          <h1 className="page-title">{profile.player.name}</h1>
          <p className="page-lead">
            {profile.player.team?.name || 'No team'} · {profile.player.position || 'No position'}{' '}
            {profile.player.jerseyNumber != null ? `· #${profile.player.jerseyNumber}` : ''}
          </p>
        </div>
        <div className="page-toolbar">
          <Link to="/players" className="button button-secondary">
            Back to players
          </Link>
          <Link to="/dashboard" className="button button-primary">
            Open dashboard
          </Link>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-card__label">Matches analyzed</p>
          <p className="kpi-card__value">{profile.summary.matchesPlayed}</p>
          <p className="kpi-card__meta">Appearances found in analysis reports</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Total distance</p>
          <p className="kpi-card__value">{profile.summary.totalDistanceCovered}</p>
          <p className="kpi-card__meta">Meters covered across analyzed matches</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Average speed</p>
          <p className="kpi-card__value">{profile.summary.averageSpeed}</p>
          <p className="kpi-card__meta">Mean speed across tracked matches</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Verified tracks</p>
          <p className="kpi-card__value">{profile.summary.verifiedTracks}</p>
          <p className="kpi-card__meta">Human-verified identity confirmations</p>
        </div>
      </div>

      <div className="player-profile-layout">
        <section className="surface-card player-profile-summary">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Scouting summary</h2>
              <p className="card-subtitle">{recommendation}</p>
            </div>
          </div>
          <div className="player-profile-tags">
            <span className="pill pill--neutral">{profile.player.team?.name || 'No team'}</span>
            <span className="pill pill--neutral">{profile.player.position || 'Position unset'}</span>
            {profile.player.jerseyNumber != null && (
              <span className="pill pill--neutral">#{profile.player.jerseyNumber}</span>
            )}
          </div>
        </section>

        <section className="surface-card player-profile-summary">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Event mix</h2>
              <p className="card-subtitle">Actions attributed to this player across analyzed matches.</p>
            </div>
          </div>
          <div className="analysis-actions">
            {Object.entries(profile.summary.actions).map(([type, count]) => (
              <span key={type} className={`pill pill--neutral action-badge action-badge-${type}`}>
                {count} {type}
                {count === 1 ? '' : 's'}
              </span>
            ))}
          </div>
        </section>
      </div>

      <section className="surface-card player-profile-summary">
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Recent matches</h2>
            <p className="card-subtitle">Open the associated analysis reports or compare match output.</p>
          </div>
        </div>
        {profile.recentMatches.length === 0 ? (
          <div className="empty-state-card">This player has not been linked to a match analysis yet.</div>
        ) : (
          <div className="player-profile-matches">
            {profile.recentMatches.map((match) => (
              <article key={match.analysisId} className="player-profile-match">
                <div>
                  <strong>{match.video?.originalName || 'Analysis report'}</strong>
                  <p>
                    {match.video?.sport || 'soccer'} · {match.distanceCovered} m · {match.actionCount} actions
                  </p>
                </div>
                <div className="player-profile-match-actions">
                  {match.video?._id && (
                    <Link to={`/analysis/${match.video._id}`} className="button button-secondary">
                      View report
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PlayerProfilePage;
