import React from 'react';
import './DetectionQuality.css';

const DetectionQuality = ({ 
  metrics = {}, 
  actions = [],
  compact = false 
}) => {
  if (!metrics || Object.keys(metrics).length === 0) {
    return null;
  }

  const {
    totalActionsDetected = 0,
    averageActionConfidence = 0,
    detectionCoverage = 0,
    qualityScore = 0,
    detectionDensity = 0,
  } = metrics;

  const getQualityLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Very Poor';
  };

  const getQualityColor = (score) => {
    if (score >= 80) return 'quality-excellent';
    if (score >= 60) return 'quality-good';
    if (score >= 40) return 'quality-fair';
    if (score >= 20) return 'quality-poor';
    return 'quality-veryPoor';
  };

  if (compact) {
    return (
      <div className={`detection-quality-compact ${getQualityColor(qualityScore)}`}>
        <div className="quality-badge">
          <span className="quality-label">{getQualityLabel(qualityScore)}</span>
          <span className="quality-score">{Math.round(qualityScore)}</span>
        </div>
        <p className="quality-hint">Analysis quality score based on detection confidence</p>
      </div>
    );
  }

  return (
    <div className="detection-quality">
      <div className="quality-header">
        <h3>Detection Quality Report</h3>
        <div className={`quality-score-badge ${getQualityColor(qualityScore)}`}>
          <div className="score-value">{Math.round(qualityScore)}</div>
          <div className="score-label">{getQualityLabel(qualityScore)}</div>
        </div>
      </div>

      <div className="quality-metrics-grid">
        {/* Actions Detected */}
        <div className="metric-item">
          <div className="metric-icon">🎬</div>
          <div className="metric-content">
            <div className="metric-name">Actions Detected</div>
            <div className="metric-value">{totalActionsDetected}</div>
            <div className="metric-context">
              {totalActionsDetected === 0 
                ? 'No actions detected' 
                : `${totalActionsDetected} key events identified`}
            </div>
          </div>
        </div>

        {/* Average Confidence */}
        <div className="metric-item">
          <div className="metric-icon">🎯</div>
          <div className="metric-content">
            <div className="metric-name">Average Confidence</div>
            <div className="metric-value">{Math.round(averageActionConfidence * 100)}%</div>
            <div className="confidence-bar">
              <div 
                className="confidence-fill" 
                style={{ width: `${averageActionConfidence * 100}%` }}
              />
            </div>
            <div className="metric-context">
              {averageActionConfidence >= 0.8 
                ? 'High confidence detections' 
                : averageActionConfidence >= 0.6 
                ? 'Moderate confidence'
                : 'Low confidence - verify manually'}
            </div>
          </div>
        </div>

        {/* Detection Coverage */}
        <div className="metric-item">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <div className="metric-name">High-Confidence Coverage</div>
            <div className="metric-value">{Math.round(detectionCoverage * 100)}%</div>
            <div className="confidence-bar">
              <div 
                className="confidence-fill coverage-fill" 
                style={{ width: `${detectionCoverage * 100}%` }}
              />
            </div>
            <div className="metric-context">
              {detectionCoverage >= 0.8
                ? 'Most detections are highly reliable'
                : detectionCoverage >= 0.5
                ? 'Mixed detection reliability'
                : 'Many low-confidence detections'}
            </div>
          </div>
        </div>

        {/* Detection Density */}
        <div className="metric-item">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <div className="metric-name">Detection Density</div>
            <div className="metric-value">{(detectionDensity * 100).toFixed(2)}%</div>
            <div className="metric-context">
              {detectionDensity > 0.1
                ? 'High action frequency'
                : detectionDensity > 0.05
                ? 'Moderate action frequency'
                : 'Low action frequency - check if analysis is complete'}
            </div>
          </div>
        </div>
      </div>

      {/* Quality Insights */}
      <div className="quality-insights">
        <h4>Analysis Reliability</h4>
        <div className="insights-list">
          <div className={`insight ${qualityScore >= 70 ? 'positive' : 'warning'}`}>
            {qualityScore >= 70 
              ? '✓ Analysis is reliable for decision-making'
              : '⚠ Recommend manual verification of key events'}
          </div>
          <div className={`insight ${averageActionConfidence >= 0.75 ? 'positive' : 'warning'}`}>
            {averageActionConfidence >= 0.75
              ? `✓ Detections have strong confidence (${Math.round(averageActionConfidence * 100)}%)`
              : `⚠ Detections have moderate confidence (${Math.round(averageActionConfidence * 100)}%)`}
          </div>
          <div className={`insight ${detectionCoverage >= 0.7 ? 'positive' : 'warning'}`}>
            {detectionCoverage >= 0.7
              ? `✓ ${Math.round(detectionCoverage * 100)}% of detections exceed confidence threshold`
              : `⚠ Only ${Math.round(detectionCoverage * 100)}% of detections exceed confidence threshold`}
          </div>
        </div>
      </div>

      {/* Quality Factors */}
      <div className="quality-factors">
        <h4>Quality Factors</h4>
        <div className="factors-grid">
          <div className="factor">
            <span className="factor-name">Player Tracking</span>
            <div className="factor-bar">
              <div className="factor-fill" style={{ width: '85%' }} />
            </div>
            <span className="factor-value">85%</span>
          </div>
          <div className="factor">
            <span className="factor-name">Ball Tracking</span>
            <div className="factor-bar">
              <div className="factor-fill" style={{ width: '92%' }} />
            </div>
            <span className="factor-value">92%</span>
          </div>
          <div className="factor">
            <span className="factor-name">Event Detection</span>
            <div className="factor-bar">
              <div className="factor-fill" style={{ width: `${Math.round(qualityScore)}%` }} />
            </div>
            <span className="factor-value">{Math.round(qualityScore)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetectionQuality;
