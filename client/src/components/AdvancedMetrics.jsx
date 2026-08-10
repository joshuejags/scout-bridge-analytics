import React, { useMemo } from 'react';
import './AdvancedMetrics.css';

/**
 * Calculate Expected Goals (xG) based on shot quality
 * Uses simple heuristics based on position and action type
 */
const calculateXG = (actions = []) => {
  let xg = 0;
  actions.forEach((action) => {
    if (action.type === 'shot') {
      const posX = action.position?.x || 0.5;
      const posY = action.position?.y || 0.5;
      const confidence = action.confidence || 0.5;

      // Shots closer to goal (higher x value) have higher xG
      // Shots more central (y closer to 0.5) have higher xG
      const distanceFromGoal = 1 - posX;
      const centrality = 1 - Math.abs(posY - 0.5) * 2;
      const baseXG = 0.05 + distanceFromGoal * 0.15 + centrality * 0.05;
      xg += Math.min(baseXG * confidence, 0.25);
    }
  });
  return Math.round(xg * 100) / 100;
};

/**
 * Calculate Expected Assists (xA) based on pass quality
 * Uses position and receiver proximity heuristics
 */
const calculateXA = (actions = []) => {
  let xa = 0;
  actions.forEach((action, idx) => {
    if (action.type === 'pass') {
      const confidence = action.confidence || 0.5;
      const posX = action.position?.x || 0.5;

      // Passes closer to opponent goal have higher xA potential
      const progressiveValue = posX > 0.5 ? (posX - 0.5) * 0.1 : 0;
      const baseXA = 0.02 + progressiveValue;
      xa += Math.min(baseXA * confidence, 0.1);
    }
  });
  return Math.round(xa * 100) / 100;
};

/**
 * Calculate possession % based on ball possession data
 */
const calculatePossession = (ballPossession = [], playerData = []) => {
  if (!ballPossession || ballPossession.length === 0) return 0;

  const teamColor = playerData?.[0]?.teamColor;
  if (!teamColor) return 0;

  let teamPossession = 0;
  let totalPossession = 0;

  ballPossession.forEach((bp) => {
    const duration = bp.duration || 1;
    totalPossession += duration;
    
    // If player belongs to this team, add to team possession
    if (bp.teamColor === teamColor) {
      teamPossession += duration;
    }
  });

  if (totalPossession === 0) return 0;
  return Math.round((teamPossession / totalPossession) * 100);
};

/**
 * Calculate pass completion % based on pass actions
 */
const calculatePassCompletion = (actions = []) => {
  const passes = actions.filter((a) => a.type === 'pass');
  if (passes.length === 0) return 0;

  const completedPasses = passes.filter((p) => (p.confidence || 0.5) > 0.6);
  return Math.round((completedPasses.length / passes.length) * 100);
};

/**
 * Calculate pressing intensity based on tackles and interceptions
 */
const calculatePressingIntensity = (actions = []) => {
  const pressActions = actions.filter((a) => a.type === 'tackle' || a.type === 'interception');
  if (pressActions.length === 0) return 0;

  // Normalize to 0-100 scale (10 actions = 100% intensity)
  return Math.min(Math.round((pressActions.length / 10) * 100), 100);
};

/**
 * Calculate distance progression rate (consistency of movement)
 */
const calculateProgressionRate = (playerStats = {}) => {
  const distance = playerStats.distanceCovered || 0;
  const sprints = playerStats.sprintCount || 0;

  if (distance === 0) return 0;
  
  // High sprint-to-distance ratio indicates aggressive play
  const sprintIntensity = sprints > 0 ? (sprints / (distance / 100)) * 100 : 0;
  return Math.round(Math.min(sprintIntensity, 100));
};

const AdvancedMetrics = ({ 
  actions = [], 
  playerData = [], 
  ballPossession = [],
  playerStats = {},
  showDetailed = false 
}) => {
  const metrics = useMemo(() => {
    const xg = calculateXG(actions);
    const xa = calculateXA(actions);
    const possession = calculatePossession(ballPossession, playerData);
    const passCompletion = calculatePassCompletion(actions);
    const pressingIntensity = calculatePressingIntensity(actions);
    const progressionRate = calculateProgressionRate(playerStats);

    return {
      xg,
      xa,
      possession,
      passCompletion,
      pressingIntensity,
      progressionRate,
    };
  }, [actions, playerData, ballPossession, playerStats]);

  const getMetricColor = (value, maxValue = 100) => {
    const percentage = (value / maxValue) * 100;
    if (percentage >= 70) return 'high';
    if (percentage >= 40) return 'medium';
    return 'low';
  };

  return (
    <div className="advanced-metrics">
      {!showDetailed ? (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">⚽</div>
            <div className="metric-content">
              <p className="metric-label">Expected Goals</p>
              <p className="metric-value">{metrics.xg}</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">🎯</div>
            <div className="metric-content">
              <p className="metric-label">Expected Assists</p>
              <p className="metric-value">{metrics.xa}</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">🔄</div>
            <div className="metric-content">
              <p className="metric-label">Possession %</p>
              <p className="metric-value">{metrics.possession}%</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">✅</div>
            <div className="metric-content">
              <p className="metric-label">Pass Completion</p>
              <p className="metric-value">{metrics.passCompletion}%</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">⚔️</div>
            <div className="metric-content">
              <p className="metric-label">Pressing Intensity</p>
              <p className="metric-value">{metrics.pressingIntensity}%</p>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">📈</div>
            <div className="metric-content">
              <p className="metric-label">Progression Rate</p>
              <p className="metric-value">{metrics.progressionRate}%</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="metrics-detailed">
          <div className="metrics-section">
            <h3>Offensive Metrics</h3>
            <div className="metric-bar-row">
              <div className="metric-bar-group">
                <label>Expected Goals (xG)</label>
                <div className="metric-bar-wrapper">
                  <div className="metric-bar" style={{ width: `${Math.min((metrics.xg / 3) * 100, 100)}%` }}>
                    {metrics.xg.toFixed(2)}
                  </div>
                </div>
                <span className="metric-note">Shot quality and positioning</span>
              </div>

              <div className="metric-bar-group">
                <label>Expected Assists (xA)</label>
                <div className="metric-bar-wrapper">
                  <div className="metric-bar" style={{ width: `${Math.min((metrics.xa / 1.5) * 100, 100)}%` }}>
                    {metrics.xa.toFixed(2)}
                  </div>
                </div>
                <span className="metric-note">Progressive passing</span>
              </div>
            </div>
          </div>

          <div className="metrics-section">
            <h3>Possession & Control</h3>
            <div className="metric-bar-row">
              <div className="metric-bar-group">
                <label>Possession %</label>
                <div className="metric-bar-wrapper">
                  <div className={`metric-bar ${getMetricColor(metrics.possession)}`} style={{ width: `${metrics.possession}%` }}>
                    {metrics.possession}%
                  </div>
                </div>
                <span className="metric-note">Ball control during match</span>
              </div>

              <div className="metric-bar-group">
                <label>Pass Completion %</label>
                <div className="metric-bar-wrapper">
                  <div className={`metric-bar ${getMetricColor(metrics.passCompletion)}`} style={{ width: `${metrics.passCompletion}%` }}>
                    {metrics.passCompletion}%
                  </div>
                </div>
                <span className="metric-note">Passing accuracy</span>
              </div>
            </div>
          </div>

          <div className="metrics-section">
            <h3>Defensive & Physical</h3>
            <div className="metric-bar-row">
              <div className="metric-bar-group">
                <label>Pressing Intensity</label>
                <div className="metric-bar-wrapper">
                  <div className={`metric-bar ${getMetricColor(metrics.pressingIntensity)}`} style={{ width: `${metrics.pressingIntensity}%` }}>
                    {metrics.pressingIntensity}%
                  </div>
                </div>
                <span className="metric-note">Tackles & interceptions rate</span>
              </div>

              <div className="metric-bar-group">
                <label>Progression Rate</label>
                <div className="metric-bar-wrapper">
                  <div className={`metric-bar ${getMetricColor(metrics.progressionRate)}`} style={{ width: `${metrics.progressionRate}%` }}>
                    {metrics.progressionRate}%
                  </div>
                </div>
                <span className="metric-note">Sprint intensity</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedMetrics;
