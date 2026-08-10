import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import VideoStatusChart from '../components/VideoStatusChart';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { roleLabels } from '../config/workspace';
import { VideoIcon, CheckIcon, ClockIcon, UsersIcon, TagIcon } from '../components/icons';
import { apiUrl } from '../utils/api';
import OperationalPulse from '../components/OperationalPulse';
import './DashboardPage.css';

const StatCard = ({ icon, label, value, meta }) => (
  <div className="kpi-card dashboard-kpi-card">
    <p className="kpi-card__label">{label}</p>
    <div className="dashboard-kpi-row">
      <span className="dashboard-kpi-icon">{icon}</span>
      <p className="kpi-card__value">{value}</p>
    </div>
    {meta && <p className="kpi-card__meta">{meta}</p>}
  </div>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const { openUpload, version: uploadVersion } = useUpload();
  const [stats, setStats] = useState({
    totalVideos: 0,
    totalTeams: 0,
    totalPlayers: 0,
    analyzedVideos: 0,
    processingVideos: 0,
    failedVideos: 0,
  });
  const [videos, setVideos] = useState([]);
  const [recentVideos, setRecentVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [videosRes, teamsRes, playersRes] = await Promise.all([
          axios.get(apiUrl('/videos')),
          axios.get(apiUrl('/teams')),
          axios.get(apiUrl('/players')),
        ]);

        const fetchedVideos = videosRes.data;
        setVideos(fetchedVideos);
        setStats({
          totalVideos: fetchedVideos.length,
          totalTeams: teamsRes.data.length,
          totalPlayers: playersRes.data.length,
          analyzedVideos: fetchedVideos.filter((v) => v.status === 'analyzed').length,
          processingVideos: fetchedVideos.filter((v) => v.status === 'processing' || v.status === 'uploaded').length,
          failedVideos: fetchedVideos.filter((v) => v.status === 'failed').length,
        });
        setRecentVideos(fetchedVideos.slice(-6).reverse());
      } catch (err) {
        setError('Failed to load dashboard statistics.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [uploadVersion]);

  const successRate = useMemo(() => {
    if (!stats.totalVideos) return 0;
    return Math.round((stats.analyzedVideos / stats.totalVideos) * 100);
  }, [stats.analyzedVideos, stats.totalVideos]);

  const queuePressure = useMemo(() => {
    if (!stats.totalVideos) return 0;
    return Math.round((stats.processingVideos / stats.totalVideos) * 100);
  }, [stats.processingVideos, stats.totalVideos]);

  const reliability = useMemo(() => {
    if (!stats.totalVideos) return 0;
    const completed = stats.analyzedVideos + stats.failedVideos;
    if (!completed) return 0;
    return Math.round((stats.analyzedVideos / completed) * 100);
  }, [stats.analyzedVideos, stats.failedVideos, stats.totalVideos]);

  const operationalMetrics = useMemo(
    () => [
      {
        label: 'Coverage',
        value: successRate,
        description: 'Videos that have reached an analyzed state.',
      },
      {
        label: 'Queue pressure',
        value: queuePressure,
        description: 'Items still waiting in the upload and processing pipeline.',
      },
      {
        label: 'Reliability',
        value: reliability,
        description: 'Successful outcomes versus failed reviews in the current workspace.',
      },
    ],
    [queuePressure, reliability, successRate]
  );

  const role = user?.role || 'scout';
  const roleLead = {
    admin: 'Monitor platform throughput, operational load, and the latest reports across every workspace.',
    scout: 'Track uploads, player coverage, analysis throughput, and the latest reports from one workspace.',
    team: 'Review squad video output, roster activity, and the state of match analysis from one hub.',
    player: 'Follow performance output, recent analysis, and the latest reports in one streamlined dashboard.',
  }[role];
  const secondaryActionLink =
    role === 'admin'
      ? '/admin'
      : role === 'scout'
      ? '/scouting'
      : role === 'team'
      ? '/team-portal'
      : role === 'player'
      ? '/player-portal'
      : '/players';
  const secondaryActionLabel =
    role === 'admin'
      ? 'Open admin portal'
      : role === 'scout'
      ? 'Open scout portal'
      : role === 'team'
      ? 'Open team portal'
      : role === 'player'
      ? 'Open player portal'
      : 'Compare players';

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading dashboard..." />;
  }

  return (
    <div className="page-shell page-shell--wide dashboard-page">
      <div className="page-header">
        <div className="page-heading">
          <div className="page-kicker">{roleLabels[role]} analytics</div>
          <h1 className="page-title">Your scouting operation at a glance.</h1>
          <p className="page-lead">{roleLead}</p>
        </div>
        <div className="page-toolbar">
          {role !== 'player' && (
            <button type="button" className="button button-primary" onClick={openUpload}>
              + Upload video
            </button>
          )}
          <Link to={secondaryActionLink} className="button button-secondary">
            {secondaryActionLabel}
          </Link>
        </div>
      </div>

      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      <div className="kpi-grid dashboard-kpi-grid">
        <StatCard
          icon={<VideoIcon size={22} />}
          label="Total videos"
          value={stats.totalVideos}
          meta="All uploaded and imported clips"
        />
        <StatCard
          icon={<CheckIcon size={22} />}
          label="Analyzed"
          value={stats.analyzedVideos}
          meta={`${successRate}% analysis completion rate`}
        />
        <StatCard
          icon={<ClockIcon size={22} />}
          label="Processing"
          value={stats.processingVideos}
          meta="Queued in the worker pipeline"
        />
        <StatCard
          icon={<TagIcon size={22} />}
          label="Teams"
          value={stats.totalTeams}
          meta="Recruitment and opposition contexts"
        />
        <StatCard
          icon={<UsersIcon size={22} />}
          label="Players"
          value={stats.totalPlayers}
          meta="Rostered profiles ready for review"
        />
      </div>

      <div className="dashboard-pulse-row">
        <OperationalPulse metrics={operationalMetrics} />
      </div>

      <div className="dashboard-layout">
        <section className="surface-card dashboard-chart-card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Video status distribution</h2>
              <p className="card-subtitle">Monitor throughput from upload to final report.</p>
            </div>
            <span className="pill pill--neutral">Live workspace</span>
          </div>
          <div className="dashboard-chart-wrap">
            <VideoStatusChart videos={videos} />
          </div>
        </section>

        <aside className="dashboard-sidebar">
          <section className="surface-card dashboard-summary-card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Scout actions</h2>
                <p className="card-subtitle">Shortcuts for the most common workflows.</p>
              </div>
            </div>
            <div className="dashboard-action-list">
              <button type="button" className="dashboard-action" onClick={openUpload}>
                <span className="dashboard-action-icon"><VideoIcon size={18} /></span>
                <span>
                  <strong>{role === 'admin' ? 'Upload for moderation' : 'Upload a clip'}</strong>
                  <small>{role === 'admin' ? 'Monitor ingestion across workspaces' : 'Queue a new match or highlight'}</small>
                </span>
              </button>
              <Link
                to={role === 'admin' ? '/admin' : role === 'scout' ? '/scouting' : role === 'team' ? '/team-portal' : role === 'player' ? '/player-portal' : '/players'}
                className="dashboard-action"
              >
                <span className="dashboard-action-icon"><UsersIcon size={18} /></span>
                <span>
                  <strong>{role === 'admin' ? 'Manage users and roles' : role === 'scout' ? 'Run the recruitment board' : role === 'team' ? 'Review squad portal' : role === 'player' ? 'Open performance portal' : 'Open player profiles'}</strong>
                  <small>{role === 'admin' ? 'Control access across portals' : role === 'scout' ? 'Update watchlists, live views, and next actions' : role === 'team' ? 'Track roster depth and match context' : role === 'player' ? 'Follow highlighted profiles and reports' : 'Compare form, output, and scouting notes'}</small>
                </span>
              </Link>
              <Link to="/teams" className="dashboard-action">
                <span className="dashboard-action-icon"><TagIcon size={18} /></span>
                <span>
                  <strong>Review team rosters</strong>
                  <small>Check squad depth and organization</small>
                </span>
              </Link>
            </div>
          </section>

          <section className="surface-card dashboard-summary-card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Recruitment snapshot</h2>
                <p className="card-subtitle">A lightweight feed of what changed most recently.</p>
              </div>
            </div>
            {recentVideos.length === 0 ? (
              <div className="empty-state-card">No videos yet. Start by uploading one.</div>
            ) : (
              <div className="dashboard-feed">
                {recentVideos.map((video) => (
                  <Link key={video._id} to={`/analysis/${video._id}`} className="dashboard-feed-item">
                    <span className={`dashboard-feed-dot status-${video.status}`} />
                    <div>
                      <strong>{video.originalName}</strong>
                      <span>
                        {video.status} · {new Date(video.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="surface-card dashboard-recent-card">
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Recent reports</h2>
            <p className="card-subtitle">Jump back into the latest analyzed footage.</p>
          </div>
          <Link to="/" className="button button-ghost">
            Open workspace
          </Link>
        </div>

        {recentVideos.length === 0 ? (
          <div className="empty-state-card">No reports yet. Upload and process a match to populate this view.</div>
        ) : (
          <div className="dashboard-report-grid">
            {recentVideos.map((video) => (
              <article key={video._id} className="dashboard-report-card">
                <div className="dashboard-report-top">
                  <span className={`pill pill--${video.status === 'analyzed' ? 'success' : video.status === 'failed' ? 'danger' : 'warning'}`}>
                    {video.status}
                  </span>
                  <span className="dashboard-report-date">{new Date(video.createdAt).toLocaleDateString()}</span>
                </div>
                <h3>{video.originalName}</h3>
                <p>{video.sport || 'soccer'} scouting report</p>
                <Link to={`/analysis/${video._id}`} className="button button-secondary dashboard-report-link">
                  View report
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
