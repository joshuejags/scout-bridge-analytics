import React, { useEffect, useState } from 'react';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import './DashboardPage.css';

const DashboardPage = () => {
  const [stats, setStats] = useState({
    totalVideos: 0,
    totalTeams: 0,
    totalPlayers: 0,
    analyzedVideos: 0,
  });
  const [recentVideos, setRecentVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [videosRes, teamsRes, playersRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_URL}/videos`),
          axios.get(`${process.env.REACT_APP_API_URL}/teams`),
          axios.get(`${process.env.REACT_APP_API_URL}/players`),
        ]);

        const videos = videosRes.data;
        const analyzed = videos.filter((v) => v.status === 'completed').length;

        setStats({
          totalVideos: videos.length,
          totalTeams: teamsRes.data.length,
          totalPlayers: playersRes.data.length,
          analyzedVideos: analyzed,
        });

        setRecentVideos(videos.slice(-5).reverse());
      } catch (err) {
        setError('Failed to load dashboard statistics.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading dashboard..." />;
  }

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      <div className="stats-grid">
        <StatCard icon="🎬" label="Total Videos" value={stats.totalVideos} />
        <StatCard icon="✅" label="Analyzed" value={stats.analyzedVideos} />
        <StatCard icon="👥" label="Teams" value={stats.totalTeams} />
        <StatCard icon="⚽" label="Players" value={stats.totalPlayers} />
      </div>

      <div className="recent-section">
        <h2>Recent Videos</h2>
        {recentVideos.length === 0 ? (
          <p className="no-data">No videos yet. Start by uploading one!</p>
        ) : (
          <div className="recent-videos-list">
            {recentVideos.map((video) => (
              <div key={video._id} className="video-item">
                <div className="video-info">
                  <h4>{video.filename}</h4>
                  <p className="video-meta">
                    Status: <span className={`status-${video.status}`}>{video.status}</span>
                  </p>
                  <p className="video-meta">
                    Uploaded: {new Date(video.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <a href={`/analysis/${video._id}`} className="view-button">
                  View Analysis →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }) => (
  <div className="stat-card">
    <div className="stat-icon">{icon}</div>
    <div className="stat-content">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </div>
  </div>
);

export default DashboardPage;
