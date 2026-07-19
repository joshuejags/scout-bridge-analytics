import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './DashboardSummary.css';

const DashboardSummary = ({ refreshTrigger = 0 }) => {
  const [summary, setSummary] = useState({ total: 0, processed: 0, pending: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/videos`);
        const videos = response.data;
        const total = videos.length;
        const processed = videos.filter((video) => video.status === 'analyzed').length;
        const pending = videos.filter((video) => video.status === 'uploaded' || video.status === 'processing').length;
        const failed = videos.filter((video) => video.status === 'failed').length;

        setSummary({ total, processed, pending, failed });
      } catch (err) {
        setError('Unable to load dashboard summary');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [refreshTrigger]);

  if (loading) return <div className="dashboard-summary">Loading summary...</div>;
  if (error) return <div className="dashboard-summary error">{error}</div>;

  return (
    <div className="dashboard-summary">
      <div className="summary-card">
        <h3>Total Videos</h3>
        <p>{summary.total}</p>
      </div>
      <div className="summary-card">
        <h3>Processed</h3>
        <p>{summary.processed}</p>
      </div>
      <div className="summary-card">
        <h3>Pending</h3>
        <p>{summary.pending}</p>
      </div>
      <div className="summary-card">
        <h3>Failed</h3>
        <p>{summary.failed}</p>
      </div>
    </div>
  );
};

export default DashboardSummary;
