import React, { useState } from 'react';
import axios from 'axios';
import './AnalysisControls.css';

const AnalysisControls = ({ videoId, onAnalysisComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const handleProcess = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/analysis/${videoId}/process`);
      setAnalysis(response.data);
      if (onAnalysisComplete) onAnalysisComplete(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Analysis failed');
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
