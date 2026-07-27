import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { poll } from '../utils/polling';
import { useAuthedMedia } from '../utils/useAuthedMedia';
import { useAuth } from '../context/AuthContext';
import Toast from './Toast';
import SearchFilter from './SearchFilter';
import LoadingSpinner from './LoadingSpinner';
import './VideoList.css';

const VideoList = ({ refreshTrigger = 0 }) => {
  const { socket } = useAuth();
  const [videos, setVideos] = useState([]);
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState(null);
  const [selectedVideoName, setSelectedVideoName] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [liveProgress, setLiveProgress] = useState({});

  useEffect(() => {
    fetchVideos();
  }, [refreshTrigger]);

  // Analysis is pushed live over the socket set up in AuthContext (progress
  // percentage as the Python analyzer works through frames, then a
  // complete/failed event) rather than waiting for the poll loop below,
  // which stays in place as a fallback for a dropped/reconnecting socket.
  useEffect(() => {
    if (!socket) return;

    const handleQueued = ({ videoId }) => {
      setVideos((prev) =>
        prev.map((v) => (v._id === videoId ? { ...v, status: 'queued' } : v))
      );
    };
    const handleStarted = ({ videoId }) => {
      setVideos((prev) =>
        prev.map((v) => (v._id === videoId ? { ...v, status: 'processing' } : v))
      );
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
      const updated = data.find((v) => v._id === videoId);
      setStatusMessage(
        updated ? 'Video analysis complete. You can view the report.' : null
      );
      setProcessingId((current) => (current === videoId ? null : current));
    };
    const handleFailed = ({ videoId, error: analysisError }) => {
      clearLiveProgress(videoId);
      setVideos((prev) =>
        prev.map((v) => (v._id === videoId ? { ...v, status: 'failed' } : v))
      );
      setError(analysisError || 'Video processing failed.');
      setProcessingId((current) => (current === videoId ? null : current));
    };

    // Same idea as the analysis:* events above, but for a video imported
    // from a URL (see VideoUpload's "From URL" mode): the file itself is
    // still downloading server-side when the row first appears, so
    // 'importing' stays live until it either lands (import:complete, ready
    // to Process like any other upload) or fails.
    const handleImportComplete = async ({ videoId }) => {
      const data = await refreshVideos();
      const updated = data.find((v) => v._id === videoId);
      setStatusMessage(updated ? 'Video import complete. You can now process it.' : null);
    };
    const handleImportFailed = ({ videoId, error: importError }) => {
      setVideos((prev) =>
        prev.map((v) => (v._id === videoId ? { ...v, status: 'failed' } : v))
      );
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

  useEffect(() => {
    filterVideos();
  }, [videos, searchQuery, statusFilter]);

  const fetchVideos = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/videos`);
      setVideos(response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching videos:', error);
      setError('Unable to fetch videos.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const filterVideos = () => {
    let filtered = videos;

    if (searchQuery) {
      filtered = filtered.filter((v) =>
        v.originalName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((v) => v.status === statusFilter);
    }

    setFilteredVideos(filtered);
  };

  const refreshVideos = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/videos`);
      setVideos(response.data);
      return response.data;
    } catch (error) {
      console.error('Error refreshing videos:', error);
      return [];
    }
  };

  const handleDelete = async (videoId) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      try {
        await axios.delete(`${process.env.REACT_APP_API_URL}/videos/${videoId}`);
        setVideos((prevVideos) => prevVideos.filter((v) => v._id !== videoId));
        setStatusMessage('Video deleted successfully.');
      } catch (error) {
        console.error('Error deleting video:', error);
        setError('Unable to delete video.');
      }
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
    // The server queues the job and only flips it to 'processing' once an
    // analysis worker actually picks it up (analysis:started); 'queued' is
    // the accurate optimistic state in the meantime.
    setVideos((prevVideos) =>
      prevVideos.map((video) =>
        video._id === videoId ? { ...video, status: 'queued' } : video
      )
    );

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/analysis/${videoId}/process`);
      if (response.status === 201 || response.status === 200) {
        const analysis = response.data?.video ? response.data : null;
        const alreadyDone = analysis && analysis.video;
        if (alreadyDone || response.status === 201) {
          setVideos((prevVideos) =>
            prevVideos.map((video) =>
              video._id === videoId
                ? { ...video, status: 'analyzed', analysis: response.data }
                : video
            )
          );
          setStatusMessage('Video analysis complete. You can view the report.');
          setError(null);
          setProcessingId(null);
          return;
        }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Video processing failed.';
      setError(errorMessage);
      setStatusMessage(null);
      setProcessingId(null);
      revertOptimistic(videoId);
      return;
    }

    // 202 Accepted: analysis is running in the background. With a live
    // socket connected, the analysis:progress/complete/failed handlers
    // above resolve processingId and status in real time — no need to
    // poll (and polling on a short fixed timeout was actively wrong here,
    // since real analysis routinely takes longer than the old 20s window).
    // Polling stays only as a fallback for a dropped/unavailable socket.
    if (socket && socket.connected) {
      return;
    }

    try {
      const updatedVideo = await poll(async () => {
        const data = await refreshVideos();
        const currentVideo = data.find((video) => video._id === videoId);
        const ready =
          currentVideo && currentVideo.status !== 'processing' && currentVideo.status !== 'queued';
        return { ready, data: currentVideo };
      }, 5000, 60);


      if (updatedVideo) {
        setVideos((prevVideos) =>
          prevVideos.map((video) =>
            video._id === videoId
              ? { ...video, status: updatedVideo.status, analysis: updatedVideo.analysis }
              : video
          )
        );
        setStatusMessage(
          updatedVideo.status === 'analyzed'
            ? 'Video analysis complete. You can view the report.'
            : `Video status: ${updatedVideo.status}`
        );
        setError(null);
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
      <h2>Uploaded Videos</h2>
      {statusMessage && <Toast type="info" message={statusMessage} onClose={() => setStatusMessage(null)} />}
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}
      
      <SearchFilter
        placeholder="Search videos by name..."
        value={searchQuery}
        onChange={setSearchQuery}
        filters={statusFilters}
        onFilterChange={(filterId) => setStatusFilter(filterId)}
      />

      {selectedVideoUrl && (
        <div className="video-preview-panel">
          <h3>Preview: {selectedVideoName}</h3>
          {previewError ? (
            <p className="preview-error">
              Couldn't load this preview.{' '}
              <button type="button" onClick={retryPreview} className="preview-retry-btn">
                Retry
              </button>
            </p>
          ) : previewBlobUrl ? (
            <video controls width="100%" src={previewBlobUrl} />
          ) : (
            <p>Loading preview...</p>
          )}
        </div>
      )}
      
      {filteredVideos.length === 0 ? (
        <p className="no-videos">
          {videos.length === 0 ? 'No videos uploaded yet' : 'No videos match your search'}
        </p>
      ) : (
        <div className="video-list-table-wrap">
          <table>
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
                      className={`status-badge status-${video.status}`}
                      title={video.status === 'failed' ? video.lastError : undefined}
                    >
                      {video.status === 'processing' && liveProgress[video._id] != null
                        ? `processing (${liveProgress[video._id]}%)`
                        : video.status}
                    </span>
                  </td>
                  <td>{new Date(video.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => handleDelete(video._id)}
                      className="delete-btn"
                      disabled={processingId === video._id}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handlePreview(video)}
                      className="preview-btn"
                      disabled={processingId === video._id || video.status === 'importing'}
                    >
                      Preview
                    </button>
                    {video.status !== 'analyzed' ? (
                      <button
                        onClick={() => handleProcess(video._id)}
                        className="process-btn"
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
                      <Link to={`/analysis/${video._id}`} className="view-report-btn">
                        View Report
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default VideoList;
