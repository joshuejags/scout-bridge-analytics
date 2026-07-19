import React, { useState } from 'react';
import axios from 'axios';
import './VideoUpload.css';

const VideoUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('uploadedBy', 'user@example.com');

    setUploading(true);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/videos/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percent);
        },
      });

      setFile(null);
      setProgress(0);
      setMessage('Upload succeeded!');
      if (onUploadSuccess) onUploadSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="video-upload">
      <h2>Upload Match Highlight</h2>
      <form onSubmit={handleUpload}>
        <input
          type="file"
          onChange={handleFileChange}
          accept="video/*"
          disabled={uploading}
        />
        <button type="submit" disabled={uploading || !file}>
          {uploading ? `Uploading... ${progress}%` : 'Upload Video'}
        </button>
      </form>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
};

export default VideoUpload;
