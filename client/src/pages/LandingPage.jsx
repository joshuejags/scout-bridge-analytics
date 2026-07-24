import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const FEATURES = [
  {
    id: 'tracking',
    icon: '🎯',
    title: 'Player Tracking',
    summary: 'YOLOv8 + TrackTrack detection',
    body: 'Every player on the pitch is detected frame-by-frame and followed across the match using motion-aware multi-object tracking, so you get a continuous movement trail per player instead of disconnected snapshots.',
  },
  {
    id: 'jersey',
    icon: '🔢',
    title: 'Jersey Recognition',
    summary: 'OCR + manual verification',
    body: "Jersey numbers are read automatically wherever the camera angle allows it. For the tracks OCR can't confidently read, a reviewer can confirm identities by eye in the Verify Players screen — real footage rarely gives you a perfect automatic result, so we built the fallback in rather than hide the gap.",
  },
  {
    id: 'heatmap',
    icon: '🔥',
    title: 'Heatmaps',
    summary: 'Positional density over time',
    body: 'Every tracked position is aggregated into a pitch grid, showing you at a glance where a player — or the whole team — spent the match.',
  },
  {
    id: 'stats',
    icon: '📊',
    title: 'Performance Stats',
    summary: 'Distance, speed, sprints',
    body: 'Distance covered, average speed, and sprint counts are computed per player directly from tracked movement, with jitter-smoothing so a shaky camera or a missed frame does not fake a sprint.',
  },
];

const STEPS = [
  {
    title: 'Upload a highlight',
    body: 'Drop in a match video — MP4, AVI, MOV, MKV, or FLV — and tag the teams and players involved.',
  },
  {
    title: 'Let it analyze',
    body: 'The video is queued and analyzed in the background: player detection, tracking, ball tracking, and jersey OCR all run automatically.',
  },
  {
    title: 'Review & verify',
    body: 'Check the report, fix any player identities the OCR could not read confidently, and merge tracks that split the same player in two.',
  },
  {
    title: 'Explore the data',
    body: 'Dig into heatmaps, per-player stats, and detected actions — all tied back to your team roster.',
  },
];

const SAMPLE_PLAYERS = [
  { name: '#21 · Orange kit', distance: '9.4 km', speed: '5.2 m/s', sprints: 14 },
  { name: '#7 · White kit', distance: '8.1 km', speed: '4.8 m/s', sprints: 9 },
  { name: 'Unidentified track', distance: '6.6 km', speed: '4.1 m/s', sprints: 6 },
];

const LandingPage = () => {
  const [activeFeature, setActiveFeature] = useState(FEATURES[0].id);
  const [openStep, setOpenStep] = useState(0);

  const feature = FEATURES.find((f) => f.id === activeFeature);

  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <h1>Turn match footage into scouting data</h1>
          <p>
            Upload highlights, get automatic player tracking, jersey identification, heatmaps, and
            performance stats — with a human-in-the-loop review step for the parts computer vision
            can't guess perfectly.
          </p>
          <div className="landing-hero-actions">
            <Link to="/register" className="landing-cta-primary">
              Get started free
            </Link>
            <Link to="/login" className="landing-cta-secondary">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <h2>What you get</h2>
        <p className="landing-section-sub">Click a feature to see what it does.</p>
        <div className="landing-features">
          <div className="landing-feature-tabs">
            {FEATURES.map((f) => (
              <button
                key={f.id}
                className={`landing-feature-tab ${activeFeature === f.id ? 'active' : ''}`}
                onClick={() => setActiveFeature(f.id)}
              >
                <span className="landing-feature-icon">{f.icon}</span>
                <span>
                  <strong>{f.title}</strong>
                  <span className="landing-feature-summary">{f.summary}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="landing-feature-detail">
            <span className="landing-feature-detail-icon">{feature.icon}</span>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <h2>How it works</h2>
        <div className="landing-steps">
          {STEPS.map((step, index) => (
            <div key={step.title} className="landing-step">
              <button
                className="landing-step-header"
                onClick={() => setOpenStep(openStep === index ? -1 : index)}
                aria-expanded={openStep === index}
              >
                <span className="landing-step-number">{index + 1}</span>
                <span className="landing-step-title">{step.title}</span>
                <span className="landing-step-chevron">{openStep === index ? '−' : '+'}</span>
              </button>
              {openStep === index && <p className="landing-step-body">{step.body}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>Sample report</h2>
        <p className="landing-section-sub">
          Illustrative example — sign in to analyze your own footage.
        </p>
        <div className="landing-sample-card">
          <div className="landing-sample-header">
            <span>Example: Match Highlight 03</span>
            <span className="landing-sample-badge">sample data</span>
          </div>
          <table className="landing-sample-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Distance</th>
                <th>Avg. speed</th>
                <th>Sprints</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_PLAYERS.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.distance}</td>
                  <td>{p.speed}</td>
                  <td>{p.sprints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="landing-cta-band">
        <h2>Ready to analyze your own match footage?</h2>
        <Link to="/register" className="landing-cta-primary">
          Create a free account
        </Link>
      </section>
    </div>
  );
};

export default LandingPage;
