import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import VideoUpload from '../components/VideoUpload';
import VideoList from '../components/VideoList';
import LoadingSpinner from '../components/LoadingSpinner';
import './Home.css';

const timeOfDayGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const Home = () => {
  const { user } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [stats, setStats] = useState({ total: 0, analyzed: 0, processing: 0, teams: 0, players: 0 });
  const [recentVideos, setRecentVideos] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
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
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshTrigger]);

  const handleUploadSuccess = () => {
    setShowUpload(false);
    setRefreshTrigger((prev) => prev + 1);
  };

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
        <button className="home-hero-cta" onClick={() => setShowUpload((prev) => !prev)}>
          {showUpload ? 'Close' : '+ Upload Highlight'}
        </button>
      </header>

      <main className="home-main">
        {loadingStats ? (
          <LoadingSpinner message="Loading your overview..." />
        ) : (
          <section className="home-stats-grid">
            <Link to="/dashboard" className="home-stat-card">
              <span className="home-stat-icon">🎬</span>
              <span className="home-stat-value">{stats.total}</span>
              <span className="home-stat-label">Videos</span>
            </Link>
            <Link to="/dashboard" className="home-stat-card">
              <span className="home-stat-icon">✅</span>
              <span className="home-stat-value">{stats.analyzed}</span>
              <span className="home-stat-label">Analyzed</span>
            </Link>
            <Link to="/dashboard" className="home-stat-card">
              <span className="home-stat-icon">⏳</span>
              <span className="home-stat-value">{stats.processing}</span>
              <span className="home-stat-label">Processing</span>
            </Link>
            <Link to="/teams" className="home-stat-card">
              <span className="home-stat-icon">🏷️</span>
              <span className="home-stat-value">{stats.teams}</span>
              <span className="home-stat-label">Teams</span>
            </Link>
            <Link to="/players" className="home-stat-card">
              <span className="home-stat-icon">👥</span>
              <span className="home-stat-value">{stats.players}</span>
              <span className="home-stat-label">Players</span>
            </Link>
          </section>
        )}

        {showUpload && (
          <section className="home-upload-panel">
            <VideoUpload onUploadSuccess={handleUploadSuccess} />
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
                <span>🏷️</span>
                <div>
                  <strong>Manage Teams</strong>
                  <p>Add or edit team rosters</p>
                </div>
              </Link>
              <Link to="/players" className="home-action-card">
                <span>👥</span>
                <div>
                  <strong>Manage Players</strong>
                  <p>Add profiles &amp; jersey numbers</p>
                </div>
              </Link>
              <Link to="/dashboard" className="home-action-card">
                <span>📊</span>
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
