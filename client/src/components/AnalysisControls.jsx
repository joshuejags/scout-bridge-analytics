import React, { useState } from 'react';
import axios from 'axios';
import { apiUrl } from '../utils/api';
import './AnalysisControls.css';

const AnalysisControls = ({ videoId, onAnalysisComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [capacity, setCapacity] = useState(null);

  const handleProcess = async () => {
    setLoading(true);
    setError(null);
    setCapacity(null);

    try {
      const response = await axios.post(apiUrl(`/analysis/${videoId}/process`));
      setAnalysis(response.data);
      if (onAnalysisComplete) onAnalysisComplete(response.data);
    } catch (err) {
      const responseData = err.response?.data;
      if (err.response?.status === 429 && responseData?.code === 'ANALYSIS_USER_CAPACITY') {
        setCapacity({
          active: responseData.active,
          limit: responseData.limit,
          retryAfterSeconds: responseData.retryAfterSeconds,
        });
        setError('Your analysis queue is currently full. Wait for an active analysis to finish, then try again.');
      } else if (err.response?.status === 429 && responseData?.code === 'ANALYSIS_GLOBAL_CAPACITY') {
        setCapacity({
          queued: responseData.queued,
          limit: responseData.limit,
          retryAfterSeconds: responseData.retryAfterSeconds,
        });
        setError('The shared analysis queue is currently at capacity. Please try again shortly.');
      } else {
        setError(responseData?.error || 'Analysis failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analysis-controls">
      <button onClick={handleProcess} disabled={loading}>
        {loading ? 'Processing...' : 'Process Video'}
      </button>
      {error && <p className="error">{error}</p>}
      {capacity && (
        <p className="capacity-hint">
          {capacity.active != null
            ? `${capacity.active}/${capacity.limit} analyses are active for your account.`
            : `${capacity.queued}/${capacity.limit} analyses are currently queued.`}
          {capacity.retryAfterSeconds ? ` Try again in about ${capacity.retryAfterSeconds} seconds.` : ''}
        </p>
      )}
      {analysis && (
        <div className="analysis-summary">
          <h3>Analysis complete</h3>
          <p>Players analyzed: {analysis.summary.totalPlayers}</p>
          <p>Duration: {analysis.summary.matchDuration} seconds</p>
        </div>
      )}
    </div>
  );
};

export default AnalysisControls;
