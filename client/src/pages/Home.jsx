import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import VideoList from '../components/VideoList';
import LoadingSpinner from '../components/LoadingSpinner';
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
  const [stats, setStats] = useState({ total: 0, analyzed: 0, processing: 0, teams: 0, players: 0 });
  const [recentVideos, setRecentVideos] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const [videosRes, teamsRes, playersRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/videos`),
        axios.get(`${process.env.REACT_APP_API_URL}/teams`),
        axios.get(`${process.env.REACT_APP_API_URL}/players`),
      ]);
      const videos = videosRes.data;
      setStats({
        total: videos.length,
        analyzed: videos.filter((v) => v.status === 'analyzed').length,
        processing: videos.filter((v) => v.status === 'processing').length,
        teams: teamsRes.data.length,
        players: playersRes.data.length,
      });
      setRecentVideos([...videos].reverse().slice(0, 4));
    } catch (err) {
      console.error('Error loading home stats:', err);
      // Without this, a failed fetch silently leaves stats at their
      // all-zero initial state — indistinguishable from a genuinely new,
      // empty account.
      setStatsError(err.response?.data?.error || "Couldn't load your overview.");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshTrigger]);

  // The upload modal lives outside this page (see UploadContext) so it's
  // reachable from the NavBar too, not just here - this is how Home finds
  // out a video was added and refreshes its stats/video list.
  useEffect(() => {
    if (uploadVersion === 0) return;
    setRefreshTrigger((prev) => prev + 1);
  }, [uploadVersion]);

  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="home">
      <header className="home-hero">
        <div className="home-hero-text">
          <h1>
            {timeOfDayGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p>Here's what's happening with your match analysis today.</p>
        </div>
        <button className="home-hero-cta" onClick={openUpload}>
          + Upload Highlight
        </button>
      </header>

      <main className="home-main">
        {statsError && (
          <div className="home-stats-error" role="alert">
            <span>{statsError}</span>
            <button onClick={fetchStats}>Retry</button>
          </div>
        )}

        {loadingStats ? (
          <LoadingSpinner message="Loading your overview..." />
        ) : (
          <section className="home-stats-grid">
            <Link to="/dashboard" className="home-stat-card">
              <span className="home-stat-icon"><VideoIcon size={28} /></span>
              <span className="home-stat-value">{stats.total}</span>
              <span className="home-stat-label">Videos</span>
            </Link>
            <Link to="/dashboard" className="home-stat-card">
              <span className="home-stat-icon"><CheckIcon size={28} /></span>
              <span className="home-stat-value">{stats.analyzed}</span>
              <span className="home-stat-label">Analyzed</span>
            </Link>
            <Link to="/dashboard" className="home-stat-card">
              <span className="home-stat-icon"><ClockIcon size={28} /></span>
              <span className="home-stat-value">{stats.processing}</span>
              <span className="home-stat-label">Processing</span>
            </Link>
            <Link to="/teams" className="home-stat-card">
              <span className="home-stat-icon"><TagIcon size={28} /></span>
              <span className="home-stat-value">{stats.teams}</span>
              <span className="home-stat-label">Teams</span>
            </Link>
            <Link to="/players" className="home-stat-card">
              <span className="home-stat-icon"><UsersIcon size={28} /></span>
              <span className="home-stat-value">{stats.players}</span>
              <span className="home-stat-label">Players</span>
            </Link>
          </section>
        )}

        <div className="home-columns">
          <section className="home-column-main">
            <VideoList refreshTrigger={refreshTrigger} key={refreshTrigger} />
          </section>

          <aside className="home-column-side">
            <div className="home-quick-actions">
              <h3>Quick actions</h3>
              <Link to="/teams" className="home-action-card">
                <span><TagIcon size={22} /></span>
                <div>
                  <strong>Manage Teams</strong>
                  <p>Add or edit team rosters</p>
                </div>
              </Link>
              <Link to="/players" className="home-action-card">
                <span><UsersIcon size={22} /></span>
                <div>
                  <strong>Manage Players</strong>
                  <p>Add profiles &amp; jersey numbers</p>
                </div>
              </Link>
              <Link to="/dashboard" className="home-action-card">
                <span><ChartIcon size={22} /></span>
                <div>
                  <strong>Full Dashboard</strong>
                  <p>See all-time analytics</p>
                </div>
              </Link>
            </div>

            {recentVideos.length > 0 && (
              <div className="home-recent-activity">
                <h3>Recent activity</h3>
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
