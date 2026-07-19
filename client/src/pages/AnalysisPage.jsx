import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './AnalysisPage.css';

const AnalysisPage = () => {
  const { videoId } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/analysis/${videoId}`);
        setAnalysis(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [videoId]);

  if (loading) return <div className="analysis-page"><p>Loading analysis...</p></div>;
  if (error) return <div className="analysis-page"><p className="error">{error}</p></div>;

  return (
    <div className="analysis-page">
      <div className="analysis-header">
        <h2>Analysis Report</h2>
        <p>Video: {analysis.video?.originalName || 'Unknown video'}</p>
      </div>

      <div className="analysis-summary-card">
        <h3>Summary</h3>
        <p>Total Players: {analysis.summary.totalPlayers}</p>
        <p>Match Duration: {analysis.summary.matchDuration} seconds</p>
        <p>Actions detected: {analysis.actions.length}</p>
      </div>

      <div className="analysis-grid">
        <div className="analysis-panel">
          <h3>Key moments</h3>
          <ul>
            {analysis.summary.highlightedMoments.map((moment, index) => (
              <li key={index}>
                <strong>{moment.type}</strong> at frame {moment.frameNumber}: {moment.description}
              </li>
            ))}
          </ul>
        </div>

        <div className="analysis-panel">
          <h3>Player stats</h3>
          {analysis.playerData.map((player) => (
            <div key={player.playerId} className="player-card">
              <h4>{player.playerId}</h4>
              <p>Distance covered: {player.statistics.distanceCovered} m</p>
              <p>Average speed: {player.statistics.averageSpeed} m/s</p>
              <p>Sprints: {player.statistics.sprintCount}</p>
              <p>Activation area: {player.statistics.activationArea}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="heatmap-card">
        <h3>Heatmap</h3>
        <div className="heatmap-grid">
          {analysis.heatmapData.grid.map((row, rowIndex) => (
            <div key={rowIndex} className="heatmap-row">
              {row.map((value, colIndex) => (
                <div
                  key={colIndex}
                  className="heatmap-cell"
                  style={{ opacity: Math.min(1, value / 5) }}
                >
                  {value}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisPage;
