import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import PlayerVerification from '../components/PlayerVerification';
import Heatmap from '../components/Heatmap';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { apiUrl } from '../utils/api';
import './AnalysisPage.css';

const AnalysisPage = () => {
  const { videoId } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVerification, setShowVerification] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [saveDraft, setSaveDraft] = useState({ title: '', summary: '', tags: '', template: 'scout-summary' });

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const [analysisRes, playersRes] = await Promise.all([
          axios.get(apiUrl(`/analysis/${videoId}`)),
          axios.get(apiUrl('/players')),
        ]);
        setAnalysis(analysisRes.data);
        setPlayers(playersRes.data);
        setSaveDraft(buildInitialReportDraft(analysisRes.data));
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [videoId]);

  const actionCounts = useMemo(
    () =>
      (analysis?.actions || []).reduce((counts, action) => {
        counts[action.type] = (counts[action.type] || 0) + 1;
        return counts;
      }, {}),
    [analysis]
  );

  const saveReport = async (event) => {
    event.preventDefault();
    try {
      await axios.post(apiUrl('/reports/saved'), {
        videoId,
        template: saveDraft.template,
        title: saveDraft.title,
        summary: saveDraft.summary,
        tags: saveDraft.tags,
      });
      setSaveStatus({ type: 'success', message: 'Report saved to your scouting history.' });
      setShowSaveForm(false);
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.response?.data?.error || 'Unable to save report.' });
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading analysis..." />;
  }

  if (error) {
    return (
      <div className="page-shell analysis-page">
        <div className="surface-card empty-state-card">
          <p className="analysis-error">{error}</p>
        </div>
      </div>
    );
  }

  const topPlayers = [...(analysis.playerData || [])]
    .sort((a, b) => (b.statistics?.distanceCovered || 0) - (a.statistics?.distanceCovered || 0))
    .slice(0, 4);
  const reportInsights = analysis.reportInsights;

  return (
    <div className="page-shell page-shell--wide analysis-page">
      {saveStatus && <Toast type={saveStatus.type} message={saveStatus.message} onClose={() => setSaveStatus(null)} />}
      <div className="page-header analysis-header">
        <div className="page-heading">
          <div className="page-kicker">Match report</div>
          <h1 className="page-title">{analysis.video?.originalName || 'Analysis report'}</h1>
          <p className="page-lead">
            {analysis.video?.sport || 'soccer'} analysis · {analysis.summary?.matchDuration || 0} seconds of play ·{' '}
            {analysis.summary?.totalPlayers || 0} tracked players
          </p>
          <p className="analysis-legacy-summary">Actions detected: {analysis.actions.length}</p>
        </div>
        <div className="page-toolbar">
          <button type="button" className="button button-secondary" onClick={() => setShowSaveForm((prev) => !prev)}>
            {showSaveForm ? 'Hide save form' : 'Save report'}
          </button>
          <button type="button" className="button button-primary" onClick={() => setShowVerification((prev) => !prev)}>
            {showVerification ? 'Hide verification' : 'Verify players'}
          </button>
          <Link to="/reports" className="button button-secondary">
            Saved reports
          </Link>
          <Link to="/players" className="button button-secondary">
            Open players
          </Link>
        </div>
      </div>

      {showSaveForm && (
        <section className="surface-card analysis-panel analysis-save-panel">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Save scouting report</h2>
              <p className="card-subtitle">Keep a reusable report title, summary, and tags in your saved scouting history.</p>
            </div>
          </div>
          <form className="analysis-save-form" onSubmit={saveReport}>
            <label>
              Template
              <select
                value={saveDraft.template}
                onChange={(event) => setSaveDraft((prev) => ({ ...prev, template: event.target.value }))}
              >
                <option value="scout-summary">Scout summary</option>
                <option value="recruitment-decision">Recruitment decision</option>
                <option value="player-development">Player development</option>
              </select>
            </label>
            <label>
              Report title
              <input
                value={saveDraft.title}
                onChange={(event) => setSaveDraft((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
            </label>
            <label>
              Executive summary
              <textarea
                rows="4"
                value={saveDraft.summary}
                onChange={(event) => setSaveDraft((prev) => ({ ...prev, summary: event.target.value }))}
              />
            </label>
            <label>
              Tags
              <input
                aria-label="Tags"
                value={saveDraft.tags}
                onChange={(event) => setSaveDraft((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="priority, winger, weekend"
              />
            </label>
            <div className="analysis-save-form__actions">
              <button type="submit" className="button button-primary">Save to reports</button>
            </div>
          </form>
        </section>
      )}

      {showVerification && (
        <section className="surface-card analysis-panel analysis-verification-panel">
          <PlayerVerification analysis={analysis} players={players} onAnalysisUpdate={setAnalysis} />
        </section>
      )}

      {analysis.summary?.qualityFlag === 'no_detections' && (
        <div className="analysis-banner" role="alert">
          <strong>No players detected in this footage.</strong>
          <span>
            Poor lighting or an unusual camera angle can make player detection unreliable. Re-upload a clearer clip for better results.
          </span>
        </div>
      )}

      <div className="kpi-grid analysis-kpis">
        <div className="kpi-card">
          <p className="kpi-card__label">Tracked players</p>
          <p className="kpi-card__value">{analysis.summary?.totalPlayers || 0}</p>
          <p className="kpi-card__meta">Players identified in the report</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Match duration</p>
          <p className="kpi-card__value">{analysis.summary?.matchDuration || 0}</p>
          <p className="kpi-card__meta">Seconds of playable footage</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Detected actions</p>
          <p className="kpi-card__value">{analysis.actions.length}</p>
          <p className="kpi-card__meta">Passes, shots, tackles, and interceptions</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Verified tracks</p>
          <p className="kpi-card__value">{analysis.playerData.filter((player) => player.verified).length}</p>
          <p className="kpi-card__meta">Manually confirmed by a reviewer</p>
        </div>
      </div>

      {reportInsights && (
        <section className="surface-card analysis-panel">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Recruitment intelligence</h2>
              <p className="card-subtitle">Derived decision support from event volume, movement load, verification quality, and tactical shape.</p>
            </div>
          </div>
          <div className="analysis-insight-grid">
            <article className="analysis-insight-card">
              <span className="page-kicker">Recommendation</span>
              <strong>{reportInsights.recommendation?.label || 'Monitor'}</strong>
              <p>{reportInsights.recommendation?.score || 0}/100 decision score</p>
              <small>{reportInsights.recommendation?.reason}</small>
            </article>
            <article className="analysis-insight-card">
              <span className="page-kicker">Confidence</span>
              <strong>{reportInsights.confidence?.label || 'Low confidence'}</strong>
              <p>{reportInsights.confidence?.score || 0}/100 data confidence</p>
              <small>
                {reportInsights.metrics?.verifiedTracks || 0} verified of {reportInsights.metrics?.trackedPlayers || 0} tracked
              </small>
            </article>
            <article className="analysis-insight-card">
              <span className="page-kicker">Standout profile</span>
              <strong>{reportInsights.standoutPlayers?.[0]?.label || 'No standout yet'}</strong>
              <p>
                {reportInsights.standoutPlayers?.[0]
                  ? `${reportInsights.standoutPlayers[0].distanceCovered}m covered · ${reportInsights.standoutPlayers[0].sprintCount} sprints`
                  : 'Awaiting a clearer match sample'}
              </p>
              <small>{reportInsights.standoutPlayers?.[0]?.activationArea || 'No activation area available'}</small>
            </article>
          </div>
          <div className="analysis-insight-columns">
            <div className="analysis-insight-list">
              <h3>Recruitment signals</h3>
              <ul>
                {(reportInsights.recruitmentSignals || []).map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </div>
            <div className="analysis-insight-list">
              <h3>Tactical notes</h3>
              <ul>
                {(reportInsights.tacticalSignals || []).map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </div>
            <div className="analysis-insight-list">
              <h3>Development themes</h3>
              <ul>
                {(reportInsights.developmentAreas || []).map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="surface-card analysis-panel">
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Key moments</h2>
            <p className="card-subtitle">Important events and highlights from the clip.</p>
          </div>
        </div>
        {analysis.summary?.highlightedMoments?.length === 0 ? (
          <p className="empty-state">No standout moments detected in this clip.</p>
        ) : (
          <div className="analysis-moment-grid">
            {analysis.summary.highlightedMoments.map((moment) => (
              <article key={`${moment.frameNumber}-${moment.type}`} className="analysis-moment-card">
                <span className="pill pill--neutral">{moment.type}</span>
                <strong>Frame {moment.frameNumber}</strong>
                <p>{moment.description}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="analysis-layout">
        <section className="surface-card analysis-panel">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Player performance</h2>
              <p className="card-subtitle">Tap a name to open the player profile.</p>
            </div>
            <span className="pill pill--neutral">{analysis.playerData.length} tracks</span>
          </div>
          {analysis.playerData.length === 0 ? (
            <p className="empty-state">No player data in this analysis.</p>
          ) : (
            <div className="data-table-wrap player-stats-table-wrap">
              <table className="data-table player-stats-table">
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
                        <td>
                          {player.playerId?._id ? <Link to={`/players/${player.playerId._id}`}>{label}</Link> : label}
                        </td>
                        <td>{player.teamColor || 'N/A'}</td>
                        <td>{player.statistics?.distanceCovered ?? 0}</td>
                        <td>{player.statistics?.averageSpeed ?? 0}</td>
                        <td>{player.statistics?.sprintCount ?? 0}</td>
                        <td>{player.statistics?.activationArea || 'N/A'}</td>
                        <td>{player.verified ? 'Yes' : 'No'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="analysis-sidebar">
          <section className="surface-card analysis-panel">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Top movers</h2>
                <p className="card-subtitle">Highest distance covered in this analysis.</p>
              </div>
            </div>
            {topPlayers.length === 0 ? (
              <p className="empty-state">No player movement stats available yet.</p>
            ) : (
              <div className="analysis-player-list">
                {topPlayers.map((player) => (
                  <article key={player.trackId} className="analysis-player-card">
                    <div>
                      <strong>{player.playerId?.name || `Track ${player.trackId}`}</strong>
                      <span>{player.teamColor || 'Unknown kit'}</span>
                    </div>
                    <div className="analysis-player-values">
                      <span>{player.statistics?.distanceCovered ?? 0} m</span>
                      <span>{player.statistics?.sprintCount ?? 0} sprints</span>
                    </div>
                    {player.playerId?._id && (
                      <Link to={`/players/${player.playerId._id}`} className="analysis-profile-link">
                        Open profile
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="surface-card analysis-panel">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">Action breakdown</h2>
                <p className="card-subtitle">Event distribution detected in the clip.</p>
              </div>
            </div>
            {analysis.actions.length === 0 ? (
              <p className="empty-state">No actions detected in this clip.</p>
            ) : (
              <div className="analysis-actions">
                {Object.entries(actionCounts).map(([type, count]) => (
                  <span key={type} className={`pill pill--neutral action-badge action-badge-${type}`}>
                    {count} {type}
                    {count === 1 ? '' : 's'}
                  </span>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="surface-card heatmap-card analysis-panel">
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Heatmap</h2>
            <p className="card-subtitle">Density map of player occupation during the match.</p>
          </div>
        </div>
        <Heatmap grid={analysis.heatmapData.grid} sport={analysis.video?.sport} />
      </section>

      {analysis.tacticalData?.teams?.length > 0 && (
        <section className="surface-card analysis-panel">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Tactical shape</h2>
              <p className="card-subtitle">Heuristic estimate from tracked positions by shirt color.</p>
            </div>
          </div>
          <div className="tactical-teams">
            {analysis.tacticalData.teams.map((team) => (
              <article className="tactical-team-card" key={team.teamColor}>
                <h3>
                  <span className="tactical-team-swatch" style={{ backgroundColor: team.teamColor }} />
                  {team.teamColor} ({team.playerCount} players)
                </h3>
                <ul className="tactical-stats-list">
                  <li>Width: {team.shape.width} m</li>
                  <li>Depth: {team.shape.depth} m</li>
                  <li>Compactness: {team.shape.compactness} m</li>
                </ul>
                <p className="tactical-formation-label">
                  {team.formation.lineCount} line{team.formation.lineCount === 1 ? '' : 's'} ({team.formation.lineup.join('-')})
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

function buildInitialReportDraft(analysis) {
  const actionCounts = (analysis.actions || []).reduce((counts, action) => {
    counts[action.type] = (counts[action.type] || 0) + 1;
    return counts;
  }, {});
  const topPlayer = [...(analysis.playerData || [])].sort(
    (a, b) => (b.statistics?.distanceCovered || 0) - (a.statistics?.distanceCovered || 0)
  )[0];
  const topPlayerLabel = topPlayer?.playerId?.name || (topPlayer?.trackId ? `track ${topPlayer.trackId}` : 'no standout player');
  const actionSummary = Object.entries(actionCounts)
    .map(([type, count]) => `${count} ${type}${count === 1 ? '' : 's'}`)
    .join(', ');

  return {
    template: 'scout-summary',
    title: `${analysis.video?.originalName || 'Analysis'} scouting report`,
    summary:
      analysis.reportInsights?.suggestedSummary ||
      `Tracked ${analysis.summary?.totalPlayers || 0} players over ${analysis.summary?.matchDuration || 0} seconds. Top mover: ${topPlayerLabel}. ${actionSummary || 'No major actions were detected.'}`,
    tags: [analysis.video?.sport || 'soccer', ...Object.keys(actionCounts).slice(0, 2)].filter(Boolean).join(', '),
  };
}

export default AnalysisPage;
