import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { CheckIcon, TargetIcon, UsersIcon, VideoIcon } from '../components/icons';
import { apiUrl } from '../utils/api';
import './RolePortalPages.css';

const PlayerPortalPage = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const response = await axios.get(apiUrl('/players/overview'));
        setOverview(response.data);
      } catch (err) {
        console.error('Error loading player portal:', err);
        setError(err.response?.data?.error || 'Unable to load the player portal.');
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, []);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading player portal..." />;
  }

  if (!overview) {
    return (
      <div className="page-shell page-shell--wide role-portal-page">
        {error && <Toast type="error" message={error} onClose={() => setError(null)} />}
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide role-portal-page">
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      <div className="page-header">
        <div className="page-heading">
          <div className="page-kicker">Player portal</div>
          <h1 className="page-title">Performance profiles and recent reports tailored for player-facing review.</h1>
          <p className="page-lead">
            Surface the most active profiles, keep performance context visible, and jump back into the most recent analyzed
            clips without digging through the full database.
          </p>
        </div>
        <div className="page-toolbar">
          <Link to="/players" className="button button-secondary">Browse profiles</Link>
          <Link to="/dashboard" className="button button-primary">Open performance dashboard</Link>
        </div>
      </div>

      <section className="kpi-grid role-portal-kpis">
        <article className="kpi-card">
          <span className="role-portal-kpi-icon"><UsersIcon size={20} /></span>
          <span className="kpi-card__value">{overview.summary.totalPlayers}</span>
          <span className="kpi-card__label">Profiles tracked</span>
        </article>
        <article className="kpi-card">
          <span className="role-portal-kpi-icon"><TargetIcon size={20} /></span>
          <span className="kpi-card__value">{overview.summary.trackedProfiles}</span>
          <span className="kpi-card__label">Profiles with analysis</span>
        </article>
        <article className="kpi-card">
          <span className="role-portal-kpi-icon"><VideoIcon size={20} /></span>
          <span className="kpi-card__value">{overview.summary.analyzedMatches}</span>
          <span className="kpi-card__label">Analyzed matches</span>
        </article>
        <article className="kpi-card">
          <span className="role-portal-kpi-icon"><CheckIcon size={20} /></span>
          <span className="kpi-card__value">{overview.summary.verifiedTracks}</span>
          <span className="kpi-card__label">Verified track links</span>
        </article>
      </section>

      <div className="role-portal-layout">
        <section className="surface-card role-portal-card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Highlighted profiles</h2>
              <p className="card-subtitle">The players with the strongest current analysis footprint.</p>
            </div>
          </div>

          <div className="role-portal-grid">
            {overview.featuredPlayers.map((item) => (
              <article key={item.player._id} className="role-portal-entity-card">
                <div className="role-portal-entity-top">
                  <strong>{item.player.name}</strong>
                  <span className="pill pill--neutral">{item.player.team?.name || 'Independent'}</span>
                </div>
                <p>{item.player.position || 'Position unset'} {item.player.jerseyNumber != null ? `· #${item.player.jerseyNumber}` : ''}</p>
                <div className="role-portal-metrics">
                  <span>{item.summary.matchesPlayed} matches</span>
                  <span>{item.summary.totalActions} actions</span>
                </div>
                <div className="role-portal-footnote">{item.summary.totalDistanceCovered} m total distance</div>
                <Link to={`/players/${item.player._id}`} className="button button-secondary role-portal-inline-action">
                  Open profile
                </Link>
              </article>
            ))}
          </div>
        </section>

        <aside className="role-portal-side">
          <section className="surface-card role-portal-card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Recent reports</h2>
                <p className="card-subtitle">The latest analyzed matches with tracked player activity.</p>
              </div>
            </div>

            <div className="role-portal-feed">
              {overview.recentMatches.map((match) => (
                <Link key={match.analysisId} to={`/analysis/${match.video._id}`} className="role-portal-feed-item">
                  <div>
                    <strong>{match.video.originalName}</strong>
                    <span>{match.trackedPlayers} tracked players · {match.actionCount} actions</span>
                  </div>
                  <span className={`pill pill--${match.video.status === 'analyzed' ? 'success' : match.video.status === 'failed' ? 'danger' : 'warning'}`}>{match.video.status}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="surface-card role-portal-card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Next actions</h2>
                <p className="card-subtitle">Fast routes back into performance and profile review.</p>
              </div>
            </div>
            <div className="role-portal-actions">
              <Link to="/players" className="home-action-card">
                <span><UsersIcon size={18} /></span>
                <div>
                  <strong>Browse all players</strong>
                  <p>Open the player database and comparison flows.</p>
                </div>
              </Link>
              <Link to="/dashboard" className="home-action-card">
                <span><VideoIcon size={18} /></span>
                <div>
                  <strong>Review latest analytics</strong>
                  <p>See performance output and current report activity.</p>
                </div>
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default PlayerPortalPage;
