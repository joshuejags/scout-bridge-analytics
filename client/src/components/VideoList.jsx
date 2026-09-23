import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { poll } from '../utils/polling';
import { useAuthedMedia } from '../utils/useAuthedMedia';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../utils/api';
import Toast from './Toast';
import SearchFilter from './SearchFilter';
import LoadingSpinner from './LoadingSpinner';
import './VideoList.css';

const VideoList = ({ refreshTrigger = 0 }) => {
  const { socket } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState(null);
  const [selectedVideoName, setSelectedVideoName] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [liveProgress, setLiveProgress] = useState({});
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVideos(page);
    }, searchQuery ? 300 : 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger, page, searchQuery, statusFilter]);

  useEffect(() => {
    if (!socket) return;

    const handleQueued = ({ videoId }) => {
      setVideos((prev) => prev.map((video) => (video._id === videoId ? { ...video, status: 'queued' } : video)));
    };
    const handleStarted = ({ videoId }) => {
      setVideos((prev) => prev.map((video) => (video._id === videoId ? { ...video, status: 'processing' } : video)));
    };
    const handleProgress = ({ videoId, progress }) => {
      if (progress == null) return;
      setLiveProgress((prev) => ({ ...prev, [videoId]: progress }));
    };
    const clearLiveProgress = (videoId) => {
      setLiveProgress((prev) => {
        if (!(videoId in prev)) return prev;
        const next = { ...prev };
        delete next[videoId];
        return next;
      });
    };
    const handleComplete = async ({ videoId }) => {
      clearLiveProgress(videoId);
      const data = await refreshVideos();
      const updated = data.find((video) => video._id === videoId);
      setStatusMessage(updated ? 'Video analysis complete. You can view the report.' : null);
      setProcessingId((current) => (current === videoId ? null : current));
    };
    const handleFailed = ({ videoId, error: analysisError }) => {
      clearLiveProgress(videoId);
      setVideos((prev) => prev.map((video) => (video._id === videoId ? { ...video, status: 'failed' } : video)));
      setError(analysisError || 'Video processing failed.');
      setProcessingId((current) => (current === videoId ? null : current));
    };
    const handleImportComplete = async ({ videoId }) => {
      const data = await refreshVideos();
      const updated = data.find((video) => video._id === videoId);
      setStatusMessage(updated ? 'Video import complete. You can now process it.' : null);
    };
    const handleImportFailed = ({ videoId, error: importError }) => {
      setVideos((prev) => prev.map((video) => (video._id === videoId ? { ...video, status: 'failed' } : video)));
      setError(importError || 'Video import failed.');
    };

    socket.on('analysis:queued', handleQueued);
    socket.on('analysis:started', handleStarted);
    socket.on('analysis:progress', handleProgress);
    socket.on('analysis:complete', handleComplete);
    socket.on('analysis:failed', handleFailed);
    socket.on('video:import:complete', handleImportComplete);
    socket.on('video:import:failed', handleImportFailed);
    return () => {
      socket.off('analysis:queued', handleQueued);
      socket.off('analysis:started', handleStarted);
      socket.off('analysis:progress', handleProgress);
      socket.off('analysis:complete', handleComplete);
      socket.off('analysis:failed', handleFailed);
      socket.off('video:import:complete', handleImportComplete);
      socket.off('video:import:failed', handleImportFailed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const filteredVideos = videos;

  const fetchVideos = async (requestedPage = page) => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const response = await axios.get(apiUrl('/videos'), {
        params: {
          paginated: true,
          page: requestedPage,
          limit: 25,
          q: searchQuery || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
        },
      });
      const data = response.data;
      setVideos(data.items || []);
      setPagination(data.pagination || {
        page: requestedPage,
        limit: 25,
        total: data.items?.length || 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: requestedPage > 1,
      });
      return data.items || [];
    } catch (fetchError) {
      console.error('Error fetching videos:', fetchError);
      setError('Unable to fetch videos.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const refreshVideos = async () => {
    try {
      const response = await axios.get(apiUrl('/videos'), {
        params: {
          paginated: true,
          page,
          limit: 25,
          q: searchQuery || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
        },
      });
      const data = response.data;
      setVideos(data.items || []);
      setPagination(data.pagination || pagination);
      return data.items || [];
    } catch (refreshError) {
      console.error('Error refreshing videos:', refreshError);
      return [];
    }
  };

  const handleDelete = async (videoId) => {
    if (!window.confirm('Are you sure you want to delete this video?')) return;
    try {
      await axios.delete(apiUrl(`/videos/${videoId}`));
      setVideos((prevVideos) => prevVideos.filter((video) => video._id !== videoId));
      setStatusMessage('Video deleted successfully.');
    } catch (deleteError) {
      console.error('Error deleting video:', deleteError);
      setError('Unable to delete video.');
    }
  };

  const revertOptimistic = (videoId) => {
    setVideos((prevVideos) =>
      prevVideos.map((video) =>
        video._id === videoId && (video.status === 'processing' || video.status === 'queued')
          ? { ...video, status: 'uploaded' }
          : video
      )
    );
  };

  const handleProcess = async (videoId) => {
    setProcessingId(videoId);
    setError(null);
    setStatusMessage('Processing video...');
    setVideos((prevVideos) =>
      prevVideos.map((video) => (video._id === videoId ? { ...video, status: 'queued' } : video))
    );

    try {
      const response = await axios.post(apiUrl(`/analysis/${videoId}/process`));
      if (response.status === 201 || response.status === 200) {
        const analysis = response.data?.video ? response.data : null;
        const alreadyDone = analysis && analysis.video;
        if (alreadyDone || response.status === 201) {
          setVideos((prevVideos) =>
            prevVideos.map((video) =>
              video._id === videoId ? { ...video, status: 'analyzed', analysis: response.data } : video
            )
          );
          setStatusMessage('Video analysis complete. You can view the report.');
          setError(null);
          setProcessingId(null);
          return;
        }
      }
    } catch (processingError) {
      const data = processingError.response?.data;
      let errorMessage = data?.error || 'Video processing failed.';
      if (processingError.response?.status === 429 && data?.code === 'ANALYSIS_USER_CAPACITY') {
        errorMessage = `Your analysis capacity is full (${data.active}/${data.limit} active). Try again after one finishes.`;
      } else if (processingError.response?.status === 429 && data?.code === 'ANALYSIS_GLOBAL_CAPACITY') {
        errorMessage = `The shared analysis queue is full (${data.queued}/${data.limit} queued). Please try again shortly.`;
      }
      setError(errorMessage);
      setStatusMessage(null);
      setProcessingId(null);
      revertOptimistic(videoId);
      return;
    }

    // Socket.IO provides fast UI updates, but keep a durable polling fallback.
    // A socket can disconnect immediately after the 202 response, so relying on
    // socket events alone could leave the button stuck in "Processing...".
    try {
      const updatedVideo = await poll(async () => {
        const response = await axios.get(apiUrl(`/analysis/${videoId}/status`));
        const status = response.data?.status;
        const ready = status === 'analyzed' || status === 'failed';
        return { ready, data: response.data };
      }, 5000, 60);

      if (updatedVideo) {
        setVideos((prevVideos) =>
          prevVideos.map((video) =>
            video._id === videoId
              ? {
                  ...video,
                  status: updatedVideo.status,
                  analysis: updatedVideo.analysis,
                  lastError: updatedVideo.lastError,
                }
              : video
          )
        );
        setStatusMessage(
          updatedVideo.status === 'analyzed'
            ? 'Video analysis complete. You can view the report.'
            : `Video status: ${updatedVideo.status}`
        );
        if (updatedVideo.status === 'failed') {
          setError(updatedVideo.lastError || 'Video processing failed.');
        } else {
          setError(null);
        }
      } else {
        revertOptimistic(videoId);
      }
    } catch (pollError) {
      console.error('Polling error:', pollError);
      setError('Processing timed out. Refresh the page or retry.');
      setStatusMessage(null);
      revertOptimistic(videoId);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePreview = (video) => {
    setSelectedVideoUrl(video.url);
    setSelectedVideoName(video.originalName);
  };

  const { blobUrl: previewBlobUrl, error: previewError, retry: retryPreview } = useAuthedMedia(selectedVideoUrl);

  const statusFilters = [
    { id: 'all', label: 'All', active: statusFilter === 'all' },
    { id: 'importing', label: 'Importing', active: statusFilter === 'importing' },
    { id: 'uploaded', label: 'Uploaded', active: statusFilter === 'uploaded' },
    { id: 'queued', label: 'Queued', active: statusFilter === 'queued' },
    { id: 'processing', label: 'Processing', active: statusFilter === 'processing' },
    { id: 'analyzed', label: 'Analyzed', active: statusFilter === 'analyzed' },
    { id: 'failed', label: 'Failed', active: statusFilter === 'failed' },
  ];

  if (loading) return <LoadingSpinner message="Loading videos..." />;

  return (
    <div className="video-list">
      <div className="card-title-row video-list-header">
        <div>
          <h2 className="card-title">Uploaded videos</h2>
          <p className="card-subtitle">Search, filter, process, and open scouting reports.</p>
        </div>
        <span className="pill pill--neutral">
          {pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1}–{Math.min(
            pagination.page * pagination.limit,
            pagination.total
          )} of {pagination.total}
        </span>
      </div>

      {statusMessage && <Toast type="info" message={statusMessage} onClose={() => setStatusMessage(null)} />}
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      <SearchFilter
        title="Library filters"
        placeholder="Search videos by name..."
        value={searchQuery}
        onChange={(value) => {
          setSearchQuery(value);
          setPage(1);
        }}
        filters={statusFilters}
        onFilterChange={(filterId) => {
          setStatusFilter(filterId);
          setPage(1);
        }}
        onClear={() => {
          setSearchQuery('');
          setStatusFilter('all');
          setPage(1);
        }}
        summary={
          statusFilter === 'all'
            ? 'All statuses'
            : `${statusFilter.charAt(0).toUpperCase()}${statusFilter.slice(1)} only`
        }
      />

      {selectedVideoUrl && (
        <section className="video-preview-panel surface-card">
          <div className="card-title-row">
            <div>
              <h3 className="card-title">Preview: {selectedVideoName}</h3>
              <p className="card-subtitle">Protected playback with authorization headers.</p>
            </div>
          </div>
          {previewError ? (
            <p className="preview-error">
              Couldn&apos;t load this preview.{' '}
              <button type="button" onClick={retryPreview} className="button button-secondary">
                Retry
              </button>
            </p>
          ) : previewBlobUrl ? (
            <video controls width="100%" src={previewBlobUrl} className="video-preview-player" />
          ) : (
            <LoadingSpinner message="Loading preview..." />
          )}
        </section>
      )}

      {filteredVideos.length === 0 ? (
        <div className="empty-state-card surface-card">
          <p>{pagination.total === 0 ? 'No videos match your search or filter.' : 'No videos uploaded yet.'}</p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table video-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Sport</th>
                <th>Size</th>
                <th>Status</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVideos.map((video) => (
                <tr key={video._id}>
                  <td>{video.originalName || 'Importing from URL'}</td>
                  <td className="video-sport-cell">{video.sport || 'soccer'}</td>
                  <td>{video.fileSize ? `${(video.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Pending'}</td>
                  <td>
                    <span
                      className={`pill ${
                        video.status === 'analyzed'
                          ? 'pill--success'
                          : video.status === 'failed'
                          ? 'pill--danger'
                          : video.status === 'processing' || video.status === 'queued'
                          ? 'pill--warning'
                          : 'pill--neutral'
                      }`}
                      title={video.status === 'failed' ? video.lastError : undefined}
                    >
                      {video.status === 'processing' && liveProgress[video._id] != null
                        ? `processing (${liveProgress[video._id]}%)`
                        : video.status}
                    </span>
                  </td>
                  <td>{new Date(video.createdAt).toLocaleDateString()}</td>
                  <td className="video-actions">
                    <button
                      type="button"
                      onClick={() => handleDelete(video._id)}
                      className="button button-danger video-action-btn"
                      disabled={processingId === video._id}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreview(video)}
                      className="button button-secondary video-action-btn"
                      disabled={processingId === video._id || video.status === 'importing'}
                    >
                      Preview
                    </button>
                    {video.status !== 'analyzed' ? (
                      <button
                        type="button"
                        onClick={() => handleProcess(video._id)}
                        className="button button-primary video-action-btn"
                        disabled={
                          processingId === video._id ||
                          video.status === 'processing' ||
                          video.status === 'queued' ||
                          video.status === 'importing'
                        }
                      >
                        {video.status === 'importing'
                          ? 'Importing...'
                          : video.status === 'queued'
                          ? 'Queued...'
                          : processingId === video._id || video.status === 'processing'
                          ? 'Processing...'
                          : video.status === 'failed'
                          ? 'Retry'
                          : 'Process'}
                      </button>
                    ) : (
                      <Link to={`/analysis/${video._id}`} className="button button-primary video-action-btn">
                        View report
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="card-title-row" style={{ marginTop: '1rem' }}>
          <span className="card-subtitle">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="video-actions">
            <button
              type="button"
              className="button button-secondary"
              disabled={!pagination.hasPreviousPage || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={!pagination.hasNextPage || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoList;
