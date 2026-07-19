import React from 'react';
import { Link } from 'react-router-dom';

const VideoRow = ({ video, onDelete, onProcess, processingId }) => {
  return (
    <tr>
      <td>{video.originalName}</td>
      <td>{(video.fileSize / 1024 / 1024).toFixed(2)} MB</td>
      <td>{video.status}</td>
      <td>{new Date(video.createdAt).toLocaleDateString()}</td>
      <td>
        <button onClick={() => onDelete(video._id)} disabled={processingId === video._1}>
          Delete
        </button>
        {video.status !== 'analyzed' ? (
          <button
            onClick={() => onProcess(video._id)}
            disabled={processingId === video._id || video.status === 'processing'}
          >
            {processingId === video._id || video.status === 'processing' ? 'Processing...' : 'Process'}
          </button>
        ) : (
          <Link to={`/analysis/${video._id}`}>View Report</Link>
        )}
      </td>
    </tr>
  );
};

export default VideoRow;
