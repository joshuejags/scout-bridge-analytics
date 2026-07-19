import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './VideoList.css';

const VideoList = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState(null);
  const [selectedVideoName, setSelectedVideoName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/videos`);
      setVideos(response.data);
    } catch (error) {
      console.error('Error fetching videos:', error);
      setError('Unable to fetch videos.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (videoId) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      try {
        await axios.delete(`${process.env.REACT_APP_API_URL}/videos/${videoId}`);
        setVideos((prevVideos) => prevVideos.filter((v) => v._id !== videoId));
      } catch (error) {
        console.error('Error deleting video:', error);
        setError('Unable to delete video.');
      }
    }
  };

  const handleProcess = async (videoId) => {
    setProcessingId(videoId);
    setError(null);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/analysis/${videoId}/process`);
      setVideos((prevVideos) =>
        prevVideos.map((video) =>
          video._id === videoId
            ? { ...video, status: 'analyzed', analysis: response.data }
            : video
        )
      );
    } catch (error) {
      console.error('Error processing video:', error);
      setError(error.response?.data?.error || 'Video processing failed.');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePreview = (video) => {
    setSelectedVideoUrl(video.url);
    setSelectedVideoName(video.originalName);
  };

  if (loading) return <p>Loading videos...</p>;

  return (
    <div className="video-list">
      <h2>Uploaded Videos</h2>
      {error && <p className="error">{error}</p>}
      {selectedVideoUrl && (
        <div className="video-preview-panel">
          <h3>Preview: {selectedVideoName}</h3>
          <video controls width="100%" src={selectedVideoUrl} />
        </div>
      )}
      {videos.length === 0 ? (
        <p>No videos uploaded yet</p>
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
            {videos.map((video) => (
              <tr key={video._id}>
                <td>{video.originalName}</td>
                <td>{(video.fileSize / 1024 / 1024).toFixed(2)} MB</td>
                <td>{video.status}</td>
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
