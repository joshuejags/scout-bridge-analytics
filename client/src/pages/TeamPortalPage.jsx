import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { CheckIcon, TagIcon, UsersIcon, VideoIcon } from '../components/icons';
import { apiUrl } from '../utils/api';
import './RolePortalPages.css';

const TeamPortalPage = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const response = await axios.get(apiUrl('/teams/overview'));
        setOverview(response.data);
      } catch (err) {
        console.error('Error loading team portal:', err);
        setError(err.response?.data?.error || 'Unable to load the team portal.');
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, []);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading team portal..." />;
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
          <div className="page-kicker">Team portal</div>
          <h1 className="page-title">Squad intelligence, match context, and roster depth in one hub.</h1>
          <p className="page-lead">
            Monitor the clubs in your workspace, see where analysis coverage is strongest, and jump straight into the next
            report or squad review.
          </p>
        </div>
        <div className="page-toolbar">
          <Link to="/teams" className="button button-secondary">Open squads</Link>
          <Link to="/dashboard" className="button button-primary">Open analytics</Link>
        </div>
      </div>

      <section className="kpi-grid role-portal-kpis">
        <article className="kpi-card">
          <span className="role-portal-kpi-icon"><TagIcon size={20} /></span>
          <span className="kpi-card__value">{overview.summary.totalTeams}</span>
          <span className="kpi-card__label">Teams tracked</span>
        </article>
        <article className="kpi-card">
          <span className="role-portal-kpi-icon"><UsersIcon size={20} /></span>
          <span className="kpi-card__value">{overview.summary.totalPlayers}</span>
          <span className="kpi-card__label">Players across squads</span>
        </article>
        <article className="kpi-card">
          <span className="role-portal-kpi-icon"><VideoIcon size={20} /></span>
          <span className="kpi-card__value">{overview.summary.totalVideos}</span>
          <span className="kpi-card__label">Recent match videos</span>
        </article>
        <article className="kpi-card">
          <span className="role-portal-kpi-icon"><CheckIcon size={20} /></span>
          <span className="kpi-card__value">{overview.summary.analyzedVideos}</span>
          <span className="kpi-card__label">Analyzed reports</span>
        </article>
      </section>

      <div className="role-portal-layout">
        <section className="surface-card role-portal-card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Priority squads</h2>
              <p className="card-subtitle">Teams with the best combination of roster depth and match context.</p>
            </div>
          </div>

          <div className="role-portal-grid">
            {overview.topTeams.map((team) => (
              <article key={team._id} className="role-portal-entity-card">
                <div className="role-portal-entity-top">
                  <strong>{team.name}</strong>
                  <span className="pill pill--neutral">{team.rosterCount} players</span>
                </div>
                <p>{team.description || 'Add a team description for staff handoffs and opposition notes.'}</p>
                <div className="role-portal-metrics">
                  <span>{team.ownedVideoCount} owned videos</span>
                  <span>{team.opponentVideoCount} opponent clips</span>
                </div>
                {team.lastVideo && (
                  <div className="role-portal-footnote">
                    Latest: {team.lastVideo.originalName} · {team.lastVideo.status}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <aside className="role-portal-side">
          <section className="surface-card role-portal-card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Recent match context</h2>
                <p className="card-subtitle">The latest videos tied to known teams and opposition.</p>
              </div>
            </div>

            <div className="role-portal-feed">
              {overview.recentMatches.map((match) => (
                <Link key={match._id} to={`/analysis/${match._id}`} className="role-portal-feed-item">
                  <div>
                    <strong>{match.originalName}</strong>
                    <span>{match.team?.name || 'Unknown team'} vs {match.opponentTeam?.name || 'Unknown opponent'}</span>
                  </div>
                  <span className={`pill pill--${match.status === 'analyzed' ? 'success' : match.status === 'failed' ? 'danger' : 'warning'}`}>{match.status}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="surface-card role-portal-card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Next actions</h2>
                <p className="card-subtitle">High-value workflow shortcuts for team staff.</p>
              </div>
            </div>
            <div className="role-portal-actions">
              <Link to="/teams" className="home-action-card">
                <span><TagIcon size={18} /></span>
                <div>
                  <strong>Review squads</strong>
                  <p>Maintain squad and opposition records.</p>
                </div>
              </Link>
              <Link to="/players" className="home-action-card">
                <span><UsersIcon size={18} /></span>
                <div>
                  <strong>Open player profiles</strong>
                  <p>Review contributors and development focus areas.</p>
                </div>
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default TeamPortalPage;
