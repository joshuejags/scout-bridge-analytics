import React, { useMemo } from 'react';
import { generateAIReport, formatReportForExport } from '../utils/reportGenerator';
import './AIReportInsights.css';

const AIReportInsights = ({ analysis, compact = false, showExport = true }) => {
  const report = useMemo(() => generateAIReport(analysis), [analysis]);

  if (!report) {
    return (
      <div className="ai-report-empty">
        <p>No analysis data available for report generation.</p>
      </div>
    );
  }

  const handleExport = (format) => {
    const content = formatReportForExport(report, format);
    const filename = `scouting-report-${Date.now()}.${format === 'markdown' ? 'md' : 'json'}`;
    
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (compact) {
    return (
      <div className="ai-report-compact">
        <div className="report-summary">
          <div className="summary-text">{report.executiveSummary}</div>
          <div className="recommendation-badge" data-score={Math.round(report.recommendation.score / 20)}>
            {report.recommendation.label}
            <span className="score-label">{report.recommendation.score}/100</span>
          </div>
        </div>
        
        {showExport && (
          <div className="report-actions">
            <button 
              className="action-btn"
              onClick={() => handleExport('markdown')}
              title="Export as Markdown"
            >
              📄 Export
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ai-report-insights">
      {/* Executive Summary */}
      <div className="report-section summary-section">
        <h3 className="section-title">Summary</h3>
        <p className="executive-summary">{report.executiveSummary}</p>
        <div className="recommendation-card" data-score={Math.round(report.recommendation.score / 20)}>
          <div className="recommendation-text">{report.recommendation.label}</div>
          <div className="recommendation-score">{report.recommendation.score}/100</div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="report-section metrics-section">
        <h3 className="section-title">Key Metrics</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Expected Goals (xG)</div>
            <div className="metric-value">{report.playerMetrics.xg.toFixed(2)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Expected Assists (xA)</div>
            <div className="metric-value">{report.playerMetrics.xa.toFixed(2)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Pass Completion</div>
            <div className="metric-value">{report.playerMetrics.passCompletion}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Pressing Intensity</div>
            <div className="metric-value">{report.playerMetrics.pressingIntensity}%</div>
          </div>
        </div>
      </div>

      {/* Strengths */}
      <div className="report-section strengths-section">
        <h3 className="section-title">Strengths</h3>
        <div className="insights-list">
          {report.strengths.map((strength, idx) => (
            <div key={idx} className="insight-item strength-item">
              <div className="insight-header">
                <span className="insight-area">{strength.area}</span>
                <span className="confidence-badge">{Math.round(strength.confidence * 100)}% confident</span>
              </div>
              <p className="insight-text">{strength.insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weaknesses */}
      {report.weaknesses.length > 0 && (
        <div className="report-section weaknesses-section">
          <h3 className="section-title">Areas for Development</h3>
          <div className="insights-list">
            {report.weaknesses.map((weakness, idx) => (
              <div key={idx} className="insight-item weakness-item">
                <div className="insight-header">
                  <span className="insight-area">{weakness.area}</span>
                  <span className="confidence-badge">{Math.round(weakness.confidence * 100)}% confident</span>
                </div>
                <p className="insight-text">{weakness.insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Development Plan */}
      {report.developmentAreas.length > 0 && (
        <div className="report-section development-section">
          <h3 className="section-title">Development Plan</h3>
          <div className="development-list">
            {report.developmentAreas.map((area, idx) => (
              <div key={idx} className="development-item" data-priority={area.priority}>
                <div className="development-header">
                  <span className="development-area">{area.area}</span>
                  <span className="priority-tag">{area.priority}</span>
                </div>
                <p className="development-recommendation">{area.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Options */}
      {showExport && (
        <div className="report-actions">
          <button 
            className="action-btn export-btn"
            onClick={() => handleExport('markdown')}
            title="Export as Markdown"
          >
            📄 Export as Markdown
          </button>
          <button 
            className="action-btn export-btn"
            onClick={() => handleExport('json')}
            title="Export as JSON"
          >
            📊 Export as JSON
          </button>
        </div>
      )}
    </div>
  );
};

export default AIReportInsights;
