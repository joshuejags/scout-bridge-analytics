import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import VideoStatusChart from '../components/VideoStatusChart';
import { useUpload } from '../context/UploadContext';
import { VideoIcon, CheckIcon, ClockIcon, UsersIcon, TagIcon } from '../components/icons';
import './DashboardPage.css';

const DashboardPage = () => {
  const { openUpload, version: uploadVersion } = useUpload();
  const [stats, setStats] = useState({
    totalVideos: 0,
    totalTeams: 0,
    totalPlayers: 0,
    analyzedVideos: 0,
    processingVideos: 0,
  });
  const [videos, setVideos] = useState([]);
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

        const fetchedVideos = videosRes.data;
        setVideos(fetchedVideos);
        setStats({
          totalVideos: fetchedVideos.length,
          totalTeams: teamsRes.data.length,
          totalPlayers: playersRes.data.length,
          analyzedVideos: fetchedVideos.filter((v) => v.status === 'analyzed').length,
          processingVideos: fetchedVideos.filter((v) => v.status === 'processing').length,
        });

        setRecentVideos(fetchedVideos.slice(-5).reverse());
      } catch (err) {
        setError('Failed to load dashboard statistics.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // uploadVersion bumps whenever a video is added anywhere in the app
    // (see UploadContext) - this page has its own fetch instead of sharing
    // Home's, so it needs the same signal to stay in sync.
  }, [uploadVersion]);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading dashboard..." />;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <button type="button" className="dashboard-upload-btn" onClick={openUpload}>
          + Upload Video
        </button>
      </div>
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      <div className="stats-grid">
        <StatCard icon={<VideoIcon size={32} />} label="Total Videos" value={stats.totalVideos} />
        <StatCard icon={<CheckIcon size={32} />} label="Analyzed" value={stats.analyzedVideos} />
        <StatCard icon={<ClockIcon size={32} />} label="Processing" value={stats.processingVideos} />
        <StatCard icon={<TagIcon size={32} />} label="Teams" value={stats.totalTeams} />
        <StatCard icon={<UsersIcon size={32} />} label="Players" value={stats.totalPlayers} />
      </div>

      <div className="dashboard-chart-section">
        <h2>Video status breakdown</h2>
        <div className="dashboard-chart-wrap">
          <VideoStatusChart videos={videos} />
        </div>
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
                  <h4>{video.originalName}</h4>
                  <p className="video-meta">
                    Status: <span className={`status-${video.status}`}>{video.status}</span>
                  </p>
                  <p className="video-meta">
                    Uploaded: {new Date(video.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Link to={`/analysis/${video._id}`} className="view-button">
                  View Analysis →
                </Link>
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
