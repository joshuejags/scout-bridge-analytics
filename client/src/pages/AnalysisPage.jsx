import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import PlayerVerification from '../components/PlayerVerification';
import Heatmap from '../components/Heatmap';
import './AnalysisPage.css';

const AnalysisPage = () => {
  const { videoId } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const [analysisRes, playersRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_URL}/analysis/${videoId}`),
          axios.get(`${process.env.REACT_APP_API_URL}/players`),
        ]);
        setAnalysis(analysisRes.data);
        setPlayers(playersRes.data);
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
        <p className="analysis-sport-tag">Sport: {analysis.video?.sport || 'soccer'}</p>
        <button
          className="pv-toggle-btn"
          onClick={() => setShowVerification((prev) => !prev)}
        >
          {showVerification ? 'Hide player verification' : 'Verify Players'}
        </button>
      </div>

      {showVerification && (
        <PlayerVerification
          analysis={analysis}
          players={players}
          onAnalysisUpdate={setAnalysis}
        />
      )}

      <div className="analysis-summary-card">
        <h3>Summary</h3>
        <p>Total Players: {analysis.summary.totalPlayers}</p>
        <p>Match Duration: {analysis.summary.matchDuration} seconds</p>
        <p>Actions detected: {analysis.actions.length}</p>
        {analysis.actions.length > 0 && (
          <div className="action-breakdown">
            {Object.entries(
              analysis.actions.reduce((counts, action) => {
                counts[action.type] = (counts[action.type] || 0) + 1;
                return counts;
              }, {})
            ).map(([type, count]) => (
              <span key={type} className={`action-badge action-badge-${type}`}>
                {count} {type}
                {count === 1 ? '' : 's'}
              </span>
            ))}
          </div>
        )}
      </div>

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
        {analysis.playerData.length === 0 ? (
          <p>No player data in this analysis.</p>
        ) : (
          <div className="player-stats-table-wrap">
            <table className="player-stats-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Kit color</th>
                  <th>Distance (m)</th>
                  <th>Avg speed (m/s)</th>
                  <th>Sprints</th>
                  <th>Activation area</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {analysis.playerData.map((player, index) => {
                  const label = player.playerId?.name
                    ? player.playerId.name
                    : player.jerseyNumber != null
                    ? `#${player.jerseyNumber}`
                    : `Unidentified (track ${index + 1})`;
                  return (
                    <tr key={player.playerId?._id || player.trackId || index}>
                      <td>{label}</td>
                      <td>{player.teamColor || '—'}</td>
                      <td>{player.statistics.distanceCovered}</td>
                      <td>{player.statistics.averageSpeed}</td>
                      <td>{player.statistics.sprintCount}</td>
                      <td>{player.statistics.activationArea}</td>
                      <td>{player.verified ? 'Yes' : 'No'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="heatmap-card">
        <h3>Heatmap</h3>
        <Heatmap grid={analysis.heatmapData.grid} sport={analysis.video?.sport} />
      </div>
    </div>
  );
};

export default AnalysisPage;
