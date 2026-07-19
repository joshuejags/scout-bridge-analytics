import React from 'react';
import './UploadStatusCard.css';

const UploadStatusCard = ({ status, uploadedBy, fileSize }) => {
  const statusColor = {
    uploaded: '#007bff',
    processing: '#ffc107',
    analyzed: '#28a745',
    failed: '#dc3545',
  };

  return (
    <div className="upload-status-card" style={{ borderColor: statusColor[status] || '#6c757d' }}>
      <h4>Status</h4>
      <p>{status}</p>
      <p>Uploaded by: {uploadedBy || 'anonymous'}</p>
      <p>Size: {(fileSize / 1024 / 1024).toFixed(2)} MB</p>
    </div>
  );
};

export default UploadStatusCard;
