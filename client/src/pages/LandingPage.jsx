import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Heatmap from '../components/Heatmap';
import sampleAnalysis from '../data/sampleAnalysis.json';
import {
  TargetIcon,
  HashIcon,
  FlameIcon,
  ChartIcon,
  VideoIcon,
  UsersIcon,
  CheckIcon,
  ClockIcon,
} from '../components/icons';
import './LandingPage.css';

const FEATURES = [
  {
    id: 'tracking',
    icon: TargetIcon,
    title: 'Player tracking',
    summary: 'Frame-by-frame object tracking',
    body: 'Every player is detected, tracked, and stitched into a continuous movement trail so scouts can review real movement patterns instead of isolated frames.',
  },
  {
    id: 'jersey',
    icon: HashIcon,
    title: 'Jersey recognition',
    summary: 'OCR with human verification',
    body: 'Jersey numbers are read automatically when the footage allows it, then corrected through a built-in review flow when the model is unsure.',
  },
  {
    id: 'heatmap',
    icon: FlameIcon,
    title: 'Heatmaps',
    summary: 'Density and occupation maps',
    body: 'Tracked positions are aggregated into pitch zones to reveal where a player or team actually spent time during a match.',
  },
  {
    id: 'stats',
    icon: ChartIcon,
    title: 'Performance stats',
    summary: 'Distance, speed, sprints, actions',
    body: 'The platform calculates match output directly from tracked movement and event data, giving scouts an evidence-based snapshot of each player.',
  },
];

const STEPS = [
  {
    title: 'Upload footage or import a link',
    body: 'Send in MP4, AVI, MOV, MKV, or FLV files, or paste supported video links from YouTube and social platforms.',
  },
  {
    title: 'Analyze in the background',
    body: 'Computer vision jobs run automatically for detection, tracking, ball movement, and jersey OCR while you keep working elsewhere.',
  },
  {
    title: 'Verify identities',
    body: 'Review uncertain tracks, correct jersey numbers, and merge duplicate player paths before you publish a report.',
  },
  {
    title: 'Share scouting insights',
    body: 'Use heatmaps, comparison views, and match summaries to support recruitment decisions and post-match review.',
  },
];

const sampleActionCounts = sampleAnalysis.actions.reduce((counts, action) => {
  counts[action.type] = (counts[action.type] || 0) + 1;
  return counts;
}, {});

const sampleTopPlayers = [...sampleAnalysis.playerData]
  .sort((a, b) => b.statistics.distanceCovered - a.statistics.distanceCovered)
  .slice(0, 5);

const landingStats = [
  { icon: VideoIcon, value: Math.round(sampleAnalysis.summary.matchDuration / 60), label: 'Match minutes', suffix: 'min' },
  { icon: UsersIcon, value: sampleAnalysis.summary.totalPlayers, label: 'Tracked players' },
  { icon: CheckIcon, value: sampleAnalysis.actions.length, label: 'Detected actions' },
  { icon: ClockIcon, value: sampleTopPlayers.length, label: 'Highlight leaders' },
];

const LandingPage = () => {
  const [activeFeature, setActiveFeature] = useState(FEATURES[0].id);
  const [openStep, setOpenStep] = useState(0);
  const feature = FEATURES.find((item) => item.id === activeFeature) || FEATURES[0];

  return (
    <div className="landing">
      <section className="landing-hero subtle-grid">
        <div className="landing-hero-inner">
          <div className="page-kicker">Football scouting platform</div>
          <h1>Turn match footage into usable recruiting intelligence.</h1>
          <p>
            ScoutBridge combines video analysis, player tracking, heatmaps, and verification
            workflows in a single sports-tech workspace built for scouts, analysts, and recruitment teams.
          </p>
          <div className="landing-hero-actions">
            <Link to="/register" className="button button-primary">
              Get started free
            </Link>
            <Link to="/login" className="button button-secondary">
              Sign in
            </Link>
          </div>
          <div className="landing-hero-proof">
            {landingStats.map((stat) => (
              <div key={stat.label} className="landing-proof-card surface-card">
                <span className="landing-proof-icon">
                  <stat.icon size={20} />
                </span>
                <strong>
                  {stat.value}
                  {stat.suffix || ''}
                </strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="landing-hero-aside surface-card">
          <div className="landing-aside-header">
            <span className="pill pill--neutral">Sample scouting report</span>
            <span className="landing-aside-meta">{sampleAnalysis.video.originalName}</span>
          </div>
          <div className="landing-aside-metrics">
            <div>
              <strong>{sampleAnalysis.summary.totalPlayers}</strong>
              <span>tracked players</span>
            </div>
            <div>
              <strong>{Math.round(sampleAnalysis.summary.matchDuration / 60)}m</strong>
              <span>match duration</span>
            </div>
            <div>
              <strong>{sampleAnalysis.actions.length}</strong>
              <span>actions detected</span>
            </div>
          </div>
          <div className="landing-aside-actions">
            {Object.entries(sampleActionCounts).map(([type, count]) => (
              <span key={type} className={`pill pill--neutral landing-action-pill landing-action-pill-${type}`}>
                {count} {type}
                {count === 1 ? '' : 's'}
              </span>
            ))}
          </div>
          <div className="landing-aside-note">
            Built for post-match review, recruitment shortlists, and analyst handoffs.
          </div>
        </aside>
      </section>

      <section className="page-shell">
        <div className="page-heading landing-section-heading">
          <div className="page-kicker">Product surfaces</div>
          <h2 className="page-title">A consistent workflow from upload to scouting decision.</h2>
          <p className="page-lead">
            The platform keeps the same visual language across landing, dashboards, player pages, and video review so users never have to relearn the UI.
          </p>
        </div>

        <div className="landing-feature-layout">
          <div className="landing-feature-tabs surface-card">
            {FEATURES.map((featureItem) => (
              <button
                key={featureItem.id}
                className={`landing-feature-tab ${activeFeature === featureItem.id ? 'active' : ''}`}
                type="button"
                onClick={() => setActiveFeature(featureItem.id)}
              >
                <span className="landing-feature-icon">
                  <featureItem.icon size={22} />
                </span>
                <span>
                  <strong>{featureItem.title}</strong>
                  <span className="landing-feature-summary">{featureItem.summary}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="landing-feature-detail surface-card">
            <span className="landing-feature-detail-icon">
              <feature.icon size={30} />
            </span>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </div>
        </div>
      </section>

      <section className="page-shell page-shell--wide landing-sample-section">
        <div className="page-heading">
          <div className="page-kicker">Sample report</div>
          <h2 className="page-title">A real analysis view, not a marketing mock.</h2>
          <p className="page-lead">
            The sample below uses the same seeded match data and visualization components as the production report pages.
          </p>
        </div>

        <div className="landing-sample-card surface-card">
          <div className="landing-sample-header">
            <div>
              <strong>{sampleAnalysis.video.originalName}</strong>
              <p>
                {sampleAnalysis.summary.totalPlayers} players tracked ·{' '}
                {Math.round(sampleAnalysis.summary.matchDuration / 60)} min play ·{' '}
                {sampleAnalysis.actions.length} events
              </p>
            </div>
            <span className="pill pill--success">Verified sample data</span>
          </div>

          <div className="landing-sample-grid">
            <div className="landing-sample-heatmap">
              <h4>Heatmap</h4>
              <Heatmap grid={sampleAnalysis.heatmapData.grid} sport={sampleAnalysis.video.sport} />
            </div>

            <div className="landing-sample-table-wrap">
              <h4>Top players by distance covered</h4>
              <table className="data-table landing-sample-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Kit</th>
                    <th>Distance</th>
                    <th>Avg. speed</th>
                    <th>Sprints</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleTopPlayers.map((player) => (
                    <tr key={player.trackId}>
                      <td>{player.playerName}</td>
                      <td>{player.teamColor}</td>
                      <td>{player.statistics.distanceCovered} m</td>
                      <td>{player.statistics.averageSpeed} m/s</td>
                      <td>{player.statistics.sprintCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="landing-sample-attribution">
            Source: seeded anonymized data from{' '}
            <a href="https://github.com/metrica-sports/sample-data" target="_blank" rel="noreferrer">
              Metrica Sports&apos; sample-data repository
            </a>
            .
          </p>
        </div>
      </section>

      <section className="page-shell">
        <div className="page-heading">
          <div className="page-kicker">Workflow</div>
          <h2 className="page-title">How the scouting workflow fits together.</h2>
        </div>

        <div className="landing-steps">
          {STEPS.map((step, index) => (
            <article key={step.title} className="landing-step surface-card">
              <button
                type="button"
                className="landing-step-header"
                onClick={() => setOpenStep(openStep === index ? -1 : index)}
                aria-expanded={openStep === index}
              >
                <span className="landing-step-number">{index + 1}</span>
                <span className="landing-step-title">{step.title}</span>
                <span className="landing-step-chevron">{openStep === index ? '−' : '+'}</span>
              </button>
              {openStep === index && <p className="landing-step-body">{step.body}</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta-band">
        <div className="page-shell landing-cta-inner">
          <h2>Ready to evaluate your next player batch?</h2>
          <p>Build scouting reports, compare players, and review match intelligence in one place.</p>
          <Link to="/register" className="button button-primary">
            Create a free account
          </Link>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
