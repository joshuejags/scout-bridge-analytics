import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import VideoList from '../components/VideoList';
import LoadingSpinner from '../components/LoadingSpinner';
import { apiUrl } from '../utils/api';
import { roleExperience, roleLabels } from '../config/workspace';
import { VideoIcon, CheckIcon, ClockIcon, TagIcon, UsersIcon, ChartIcon } from '../components/icons';
import './Home.css';

const timeOfDayGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const Home = () => {
  const { user } = useAuth();
  const { openUpload, version: uploadVersion } = useUpload();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState({ total: 0, analyzed: 0, processing: 0, teams: 0, players: 0, users: 0 });
  const [recentVideos, setRecentVideos] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const requests = [
        axios.get(apiUrl('/videos')),
        axios.get(apiUrl('/teams')),
        axios.get(apiUrl('/players')),
      ];
      if (user?.role === 'admin') {
        requests.push(axios.get(apiUrl('/auth/users')));
      }

      const [videosRes, teamsRes, playersRes, usersRes] = await Promise.all(requests);
      const videos = videosRes.data;
      setStats({
        total: videos.length,
        analyzed: videos.filter((v) => v.status === 'analyzed').length,
        processing: videos.filter((v) => v.status === 'processing').length,
        teams: teamsRes.data.length,
        players: playersRes.data.length,
        users: usersRes?.data?.length || 0,
      });
      setRecentVideos([...videos].reverse().slice(0, 4));
    } catch (err) {
      console.error('Error loading home stats:', err);
      setStatsError(err.response?.data?.error || "Couldn't load your overview.");
    } finally {
      setLoadingStats(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshTrigger]);

  useEffect(() => {
    if (uploadVersion === 0) return;
    setRefreshTrigger((prev) => prev + 1);
  }, [uploadVersion]);

  const firstName = user?.name?.split(' ')[0];
  const role = user?.role || 'scout';
  const experience = roleExperience[role] || roleExperience.scout;
  const primaryActionIsUpload = experience.primaryAction.action === 'upload';

  return (
    <div className="page-shell page-shell--wide home">
      <header className="home-hero surface-card">
        <div className="home-hero-text">
          <div className="page-kicker">{roleLabels[role]} workspace</div>
          <h1>
            {timeOfDayGreeting()}{firstName ? `, ${firstName}` : ''}.
          </h1>
          <p>{experience.title} {experience.lead}</p>
        </div>
        {primaryActionIsUpload ? (
          <button type="button" className="button button-primary home-hero-cta" onClick={openUpload}>
            {experience.primaryAction.label}
          </button>
        ) : (
          <Link to={experience.primaryAction.to} className="button button-primary home-hero-cta">
            {experience.primaryAction.label}
          </Link>
        )}
      </header>

      <main className="home-main">
        {statsError && (
          <div className="home-stats-error" role="alert">
            <span>{statsError}</span>
            <button type="button" onClick={fetchStats}>
              Retry
            </button>
          </div>
        )}

        {loadingStats ? (
          <LoadingSpinner message="Loading your overview..." />
        ) : (
          <section className="kpi-grid home-stats-grid">
            <Link to="/dashboard" className="kpi-card home-stat-card">
              <span className="home-stat-icon"><VideoIcon size={20} /></span>
              <span className="kpi-card__value">{stats.total}</span>
              <span className="kpi-card__label">Videos</span>
            </Link>
            <Link to="/dashboard" className="kpi-card home-stat-card">
              <span className="home-stat-icon"><CheckIcon size={20} /></span>
              <span className="kpi-card__value">{stats.analyzed}</span>
              <span className="kpi-card__label">Analyzed</span>
            </Link>
            <Link to="/dashboard" className="kpi-card home-stat-card">
              <span className="home-stat-icon"><ClockIcon size={20} /></span>
              <span className="kpi-card__value">{stats.processing}</span>
              <span className="kpi-card__label">Processing</span>
            </Link>
            <Link to="/teams" className="kpi-card home-stat-card">
              <span className="home-stat-icon"><TagIcon size={20} /></span>
              <span className="kpi-card__value">{stats.teams}</span>
              <span className="kpi-card__label">Teams</span>
            </Link>
            <Link to="/players" className="kpi-card home-stat-card">
              <span className="home-stat-icon"><UsersIcon size={20} /></span>
              <span className="kpi-card__value">{stats.players}</span>
              <span className="kpi-card__label">Players</span>
            </Link>
            {role === 'admin' && (
              <Link to="/admin" className="kpi-card home-stat-card">
                <span className="home-stat-icon"><ChartIcon size={20} /></span>
                <span className="kpi-card__value">{stats.users}</span>
                <span className="kpi-card__label">Users</span>
              </Link>
            )}
          </section>
        )}

        <div className="home-columns">
          <section className="home-column-main surface-card">
            <div className="card-title-row home-column-header">
              <div>
                <h2 className="card-title">Match library</h2>
                <p className="card-subtitle">Search, process, and open reports from one place.</p>
              </div>
              <Link to="/dashboard" className="button button-ghost">
                Open dashboard
              </Link>
            </div>
            <VideoList refreshTrigger={refreshTrigger} key={refreshTrigger} />
          </section>

          <aside className="home-column-side">
            <div className="home-quick-actions surface-card">
              <div className="card-title-row">
                <div>
                  <h3 className="card-title">Quick actions</h3>
                  <p className="card-subtitle">The highest-value workflows for your role.</p>
                </div>
              </div>
              {experience.quickActions.map((action) => (
                <Link key={action.label} to={action.to} className="home-action-card">
                  <span>{action.to.includes('/players') ? <UsersIcon size={18} /> : action.to.includes('/teams') ? <TagIcon size={18} /> : <ChartIcon size={18} />}</span>
                  <div>
                    <strong>{action.label}</strong>
                    <p>{action.description}</p>
                  </div>
                </Link>
              ))}
            </div>

            {recentVideos.length > 0 && (
              <div className="home-recent-activity surface-card">
                <div className="card-title-row">
                  <div>
                    <h3 className="card-title">Recent activity</h3>
                    <p className="card-subtitle">Latest uploads and analysis results.</p>
                  </div>
                </div>
                {recentVideos.map((video) => (
                  <Link
                    key={video._id}
                    to={video.status === 'analyzed' ? `/analysis/${video._id}` : '#'}
                    className="home-activity-item"
                    onClick={(e) => video.status !== 'analyzed' && e.preventDefault()}
                    title={
                      video.status === 'analyzed'
                        ? undefined
                        : video.status === 'failed'
                        ? video.lastError || 'Analysis failed. Go to the video list to retry.'
                        : `Still ${video.status}. Check back soon.`
                    }
                  >
                    <span className={`home-activity-dot status-${video.status}`} />
                    <div className="home-activity-text">
                      <span className="home-activity-name">{video.originalName}</span>
                      <span className="home-activity-status">{video.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Home;
