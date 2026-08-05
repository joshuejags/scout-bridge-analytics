import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';
import { apiUrl } from '../utils/api';
import './PlayerComparison.css';

const STAT_ROWS = [
  { key: 'matchesPlayed', label: 'Matches analyzed' },
  { key: 'totalDistanceCovered', label: 'Total distance (m)' },
  { key: 'averageDistancePerMatch', label: 'Avg distance / match (m)' },
  { key: 'averageSpeed', label: 'Avg speed (m/s)' },
  { key: 'totalSprints', label: 'Total sprints' },
  { key: 'averageSprintsPerMatch', label: 'Avg sprints / match' },
  { key: 'totalActions', label: 'Total actions' },
  { key: 'verifiedTracks', label: 'Verified tracks' },
];

const ACTION_TYPES = ['shot', 'pass', 'tackle', 'interception'];
const TREND_METRICS = [
  { key: 'distance', label: 'Distance', unit: 'm' },
  { key: 'actions', label: 'Actions', unit: '' },
  { key: 'sprints', label: 'Sprints', unit: '' },
];

const isBest = (rows, key, value) => {
  if (value == null || value === 0) return false;
  const values = rows.map((r) => r[key]).filter((v) => v != null);
  if (!values.length) return false;
  return value === Math.max(...values);
};

const getTrendSeries = (player, metricKey) => {
  if (Array.isArray(player.trendSeries?.[metricKey]) && player.trendSeries[metricKey].length) {
    return player.trendSeries[metricKey];
  }

  return (player.matches || []).map((match, index) => ({
    label: match.video?.originalName || `Match ${index + 1}`,
    value:
      metricKey === 'distance'
        ? match.distanceCovered || 0
        : metricKey === 'actions'
        ? match.actionCount || 0
        : match.sprints || 0,
  }));
};

const buildComparisonInsights = (rows) => {
  const metrics = [
    { key: 'averageDistancePerMatch', label: 'Avg distance / match', unit: 'm' },
    { key: 'totalActions', label: 'Total actions', unit: '' },
    { key: 'verifiedTracks', label: 'Verified tracks', unit: '' },
  ];

  const leaders = metrics
    .map((metric) => {
      const rankedRows = rows
        .filter((row) => typeof row[metric.key] === 'number' && row[metric.key] > 0)
        .sort((a, b) => b[metric.key] - a[metric.key]);
      const leader = rankedRows[0];
      return leader
        ? {
            label: metric.label,
            value: leader[metric.key],
            unit: metric.unit,
            playerName: leader.player?.name || 'Player',
          }
        : null;
    })
    .filter(Boolean);

  const primaryLeader = leaders[0];
  const secondaryLeader = leaders[1];
  const headline = primaryLeader
    ? `${primaryLeader.playerName} leads the comparison on ${primaryLeader.label.toLowerCase()} with ${primaryLeader.value}${primaryLeader.unit}.`
    : 'Comparison insight will appear once at least one player has match data.';

  const keySignals = [
    primaryLeader && `${primaryLeader.playerName} is the strongest volume signal across the selected players.`,
    secondaryLeader && `${secondaryLeader.playerName} is the next strongest signal on ${secondaryLeader.label.toLowerCase()}.`,
    rows.some((row) => row.matchesPlayed > 0)
      ? 'More analyzed matches create better trend certainty, so added clips will sharpen the recommendation.'
      : 'Add at least one analyzed match to turn the view into a richer scouting brief.',
  ].filter(Boolean);

  return {
    headline,
    keySignals,
  };
};

const PlayerComparison = ({ playerIds, onClose, variant = 'modal' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    closeBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get(apiUrl('/players/compare'), {
        params: { ids: playerIds.join(',') },
      })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || 'Unable to load comparison.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerIds]);

  const insights = data ? buildComparisonInsights(data) : null;

  const panel = (
    <div className={`comparison-panel ${variant === 'page' ? 'comparison-panel--page' : ''}`} ref={panelRef}>
      <div className="comparison-header">
        <div>
          <div className="page-kicker">Player comparison</div>
          <h2>Multi-match scouting view</h2>
        </div>
        <button
          className="comparison-close"
          onClick={onClose}
          aria-label="Close comparison"
          ref={closeBtnRef}
        >
          &times;
        </button>
      </div>

      {loading && <LoadingSpinner message="Loading comparison..." />}
      {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

      {!loading && !error && data && (
        <div className="comparison-content">
          <section className="comparison-hero">
            <div className="comparison-hero__copy">
              <h3>Trend snapshot</h3>
              <p>See how each player’s workload and output trend across every analyzed match, not just a single snapshot.</p>
            </div>
            <div className="comparison-hero__grid">
              {data.map((item) => {
                const matches = item.matches || [];
                return (
                  <article key={item.player._id} className="comparison-summary-card">
                    <div className="comparison-summary-card__top">
                      <strong>{item.player.name}</strong>
                      <span>{item.matchesPlayed || matches.length} match{(item.matchesPlayed || matches.length) === 1 ? '' : 'es'}</span>
                    </div>
                    <div className="comparison-summary-card__metrics">
                      <div>
                        <span>Avg distance</span>
                        <strong>{item.averageDistancePerMatch}</strong>
                      </div>
                      <div>
                        <span>Total actions</span>
                        <strong>{item.totalActions}</strong>
                      </div>
                      <div>
                        <span>Verified tracks</span>
                        <strong>{item.verifiedTracks}</strong>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="comparison-insights">
            <div className="comparison-insights__copy">
              <h3>Decision-ready reading</h3>
              <p>{insights?.headline || 'Comparison insight will appear once the profile data is ready.'}</p>
            </div>
            <div className="comparison-insights__grid">
              <article className="comparison-insights__card">
                <h4>What stands out</h4>
                <ul>
                  {insights?.keySignals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              </article>
              <article className="comparison-insights__card">
                <h4>Recommended use</h4>
                <p>Use the narrative summary to narrow the shortlist before the next live review or report export.</p>
              </article>
            </div>
          </section>

          <section className="comparison-trend-grid">
            {data.map((item) => {
              const matches = item.matches || [];
              return (
                <article key={item.player._id} className="comparison-trend-card">
                  <div className="comparison-trend-card__header">
                    <div>
                      <h3>{item.player.name}</h3>
                      <p>{item.player.team?.name || 'Independent'}{item.player.jerseyNumber != null ? ` · #${item.player.jerseyNumber}` : ''}</p>
                    </div>
                    <span className="pill pill--neutral">{matches.length ? `${matches.length} match history` : 'No matches yet'}</span>
                  </div>

                  <div className="comparison-trend-card__rows">
                    {TREND_METRICS.map((metric) => {
                      const series = getTrendSeries(item, metric.key);
                      const maxValue = Math.max(...series.map((point) => point.value || 0), 1);
                      return (
                        <div key={`${item.player._id}-${metric.key}`} className="comparison-trend-row">
                          <div className="comparison-trend-row__label">
                            <span>{metric.label}</span>
                            <strong>
                              {series.length ? `${series[series.length - 1].value}${metric.unit}` : '—'}
                            </strong>
                          </div>
                          <div className="comparison-trend-row__bars" aria-label={`${item.player.name} ${metric.label} trend`}>
                            {series.map((point, index) => (
                              <div key={`${item.player._id}-${metric.key}-${index}`} className="comparison-trend-bar-wrapper">
                                <div
                                  className="comparison-trend-bar"
                                  style={{ height: `${Math.max(12, (point.value / maxValue) * 100)}%` }}
                                  title={`${point.label}: ${point.value}${metric.unit}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="comparison-match-list">
                    {matches.length ? (
                      matches.slice(0, 3).map((match, index) => (
                        <div key={`${item.player._id}-match-${index}`} className="comparison-match-item">
                          <span>{match.video?.originalName || `Match ${index + 1}`}</span>
                          <div>
                            <strong>{match.distanceCovered}m</strong>
                            <span>{match.actionCount} actions</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="comparison-match-empty">No match clips have been analyzed for this player yet.</div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          <section className="comparison-table-section">
            <div className="comparison-section-title">Side-by-side stat matrix</div>
            <div className="comparison-table-wrap">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Stat</th>
                    {data.map((d) => (
                      <th key={d.player._id}>
                        {d.player.name}
                        <span className="comparison-subtitle">
                          {d.player.team?.name || 'No team'}
                          {d.player.jerseyNumber != null ? ` · #${d.player.jerseyNumber}` : ''}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STAT_ROWS.map(({ key, label }) => (
                    <tr key={key}>
                      <td className="comparison-stat-label">{label}</td>
                      {data.map((d) => (
                        <td key={d.player._id} className={isBest(data, key, d[key]) ? 'comparison-best' : ''}>
                          {d[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="comparison-section-row">
                    <td colSpan={data.length + 1}>Actions by type</td>
                  </tr>
                  {ACTION_TYPES.map((type) => (
                    <tr key={type}>
                      <td className="comparison-stat-label">{type}</td>
                      {data.map((d) => (
                        <td key={d.player._id}>{d.actions[type] ?? 0}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {data.every((d) => d.matchesPlayed === 0) && (
            <p className="comparison-empty-note">
              None of these players appear in an analyzed video yet. Stats will populate once
              their tracks are identified (via jersey OCR or manual verification) in at least
              one analysis.
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (variant === 'page') {
    return panel;
  }

  return (
    <div className="comparison-overlay" role="dialog" aria-modal="true" aria-label="Player comparison">
      {panel}
    </div>
  );
};

export default PlayerComparison;
