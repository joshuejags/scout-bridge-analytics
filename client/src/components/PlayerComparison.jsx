import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import LoadingSpinner from './LoadingSpinner';
import Toast from './Toast';
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

/**
 * Highlights the best value in a stat row across the compared players —
 * "best" flips direction per stat (more distance/sprints/actions is
 * better; there's no inherently-better averageSpeed, so it's left neutral).
 */
const isBest = (rows, key, value) => {
  if (value == null || value === 0) return false;
  const values = rows.map((r) => r[key]).filter((v) => v != null);
  if (!values.length) return false;
  return value === Math.max(...values);
};

const PlayerComparison = ({ playerIds, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);
  const closeBtnRef = useRef(null);

  // Escape-to-close and a basic focus trap: without these, keyboard focus
  // can wander behind the overlay onto the page underneath, and there's
  // no keyboard-only way to dismiss the modal at all.
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
      .get(`${process.env.REACT_APP_API_URL}/players/compare`, {
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

  return (
    <div className="comparison-overlay" role="dialog" aria-modal="true" aria-label="Player comparison">
      <div className="comparison-panel" ref={panelRef}>
        <div className="comparison-header">
          <h2>Player Comparison</h2>
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
                      <td
                        key={d.player._id}
                        className={isBest(data, key, d[key]) ? 'comparison-best' : ''}
                      >
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
    </div>
  );
};

export default PlayerComparison;
