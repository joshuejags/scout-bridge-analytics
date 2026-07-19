import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { poll } from '../utils/polling';
import Toast from './Toast';
import SearchFilter from './SearchFilter';
import LoadingSpinner from './LoadingSpinner';
import './VideoList.css';

const VideoList = ({ refreshTrigger = 0 }) => {
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

  useEffect(() => {
    fetchVideos();
  }, [refreshTrigger]);

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

  const handleProcess = async (videoId) => {
    setProcessingId(videoId);
    setError(null);
    setStatusMessage('Processing video...');
    setVideos((prevVideos) =>
      prevVideos.map((video) =>
        video._id === videoId ? { ...video, status: 'processing' } : video
      )
    );

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/analysis/${videoId}/process`);
      if (response.status === 201 || response.status === 200) {
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
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Video processing failed.';
      setError(errorMessage);
      setStatusMessage(null);
      setProcessingId(null);
      return;
    }

    try {
      const updatedVideo = await poll(async () => {
        const data = await refreshVideos();
        const currentVideo = data.find((video) => video._id === videoId);
        const ready = currentVideo && currentVideo.status !== 'processing';
        return { ready, data: currentVideo };
      }, 2000, 10);


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
      }
    } catch (pollError) {
      console.error('Polling error:', pollError);
      setError('Processing timed out. Refresh the page or retry.');
      setStatusMessage(null);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePreview = (video) => {
    setSelectedVideoUrl(video.url);
    setSelectedVideoName(video.originalName);
  };

  const statusFilters = [
    { id: 'all', label: 'All', active: statusFilter === 'all' },
    { id: 'pending', label: 'Pending', active: statusFilter === 'pending' },
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
          <video controls width="100%" src={selectedVideoUrl} />
        </div>
      )}
      
      {filteredVideos.length === 0 ? (
        <p className="no-videos">
          {videos.length === 0 ? 'No videos uploaded yet' : 'No videos match your search'}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Size</th>
              <th>Status</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVideos.map((video) => (
              <tr key={video._id}>
                <td>{video.originalName}</td>
                <td>{(video.fileSize / 1024 / 1024).toFixed(2)} MB</td>
                <td><span className={`status-badge status-${video.status}`}>{video.status}</span></td>
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
                    disabled={processingId === video._id}
                  >
                    Preview
                  </button>
                  {video.status !== 'analyzed' ? (
                    <button
                      onClick={() => handleProcess(video._id)}
                      className="process-btn"
                      disabled={processingId === video._id || video.status === 'processing'}
                    >
                      {processingId === video._id || video.status === 'processing'
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
      )}
    </div>
  );
};

export default VideoList;
