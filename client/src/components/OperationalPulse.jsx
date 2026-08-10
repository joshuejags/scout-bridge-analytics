import React from 'react';
import './OperationalPulse.css';

const OperationalPulse = ({ metrics }) => {
  const safeMetrics = Array.isArray(metrics) ? metrics : [];

  return (
    <section className="surface-card operational-pulse-card">
      <div className="card-title-row">
        <div>
          <h2 className="card-title">Operational pulse</h2>
          <p className="card-subtitle">A premium view of how the pipeline is performing right now.</p>
        </div>
        <span className="pill pill--neutral">Live</span>
      </div>
      <div className="operational-pulse-list">
        {safeMetrics.map((metric) => {
          const value = Math.min(100, Math.max(0, metric.value));
          return (
            <div key={metric.label} className="operational-pulse-row">
              <div className="operational-pulse-row__head">
                <span>{metric.label}</span>
                <strong>{metric.value}%</strong>
              </div>
              <div className="operational-pulse-bar" aria-hidden="true">
                <div className="operational-pulse-bar__fill" style={{ width: `${value}%` }} />
              </div>
              <p>{metric.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default OperationalPulse;
