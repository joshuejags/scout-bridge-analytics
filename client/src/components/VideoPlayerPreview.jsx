import React from 'react';
import './VideoPlayerPreview.css';

const VideoPlayerPreview = ({ src }) => {
  if (!src) {
    return null;
  }

  return (
    <div className="video-preview-card">
      <h3>Video Preview</h3>
      <video controls width="100%" src={src} />
    </div>
  );
};

export default VideoPlayerPreview;
