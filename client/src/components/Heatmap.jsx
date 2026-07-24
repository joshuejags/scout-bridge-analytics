import React, { useEffect, useRef } from 'react';
import './Heatmap.css';

// Loose playing-surface tint per sport — not a real pitch/court diagram,
// just enough context for the density overlay to read as "positions on a
// field" rather than an abstract color grid.
const SURFACE_COLOR = {
  soccer: '#2e7d32',
  hockey: '#2e7d32',
  rugby: '#2e7d32',
  basketball: '#b5651d',
};

// Blue (cold/low density) through to red (hot/high density), interpolated
// in HSL hue space so intermediate values pass through a natural-looking
// green/yellow instead of a muddy RGB blend.
const heatColor = (t) => `hsl(${220 - 220 * t}, 85%, 50%)`;

/**
 * Renders analysis.heatmapData.grid (a 2D array of per-cell position
 * counts) as an actual density visualization: a sport-tinted background
 * with each cell shaded by how it compares to the busiest cell in this
 * grid, not a fixed/arbitrary scale — a grid with a single hotspot and one
 * with several evenly-warm areas should look different.
 */
const Heatmap = ({ grid, sport = 'soccer' }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rows = grid?.length || 0;
      const cols = rows > 0 ? grid[0].length : 0;
      if (rows === 0 || cols === 0) return;

      const width = container.clientWidth || 600;
      const height = Math.max(120, Math.round((width * rows) / cols));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      // jsdom (unit tests) has no real canvas backend without the extra
      // `canvas` native package, so getContext returns null there — bail
      // out quietly rather than throwing on ctx.scale below.
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = SURFACE_COLOR[sport] || SURFACE_COLOR.soccer;
      ctx.fillRect(0, 0, width, height);

      let max = 0;
      for (const row of grid) {
        for (const value of row) {
          if (value > max) max = value;
        }
      }

      const cellW = width / cols;
      const cellH = height / rows;

      if (max > 0) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const value = grid[r][c];
            if (!value) continue;
            const t = value / max;
            ctx.fillStyle = heatColor(t);
            // Low density barely tints the surface; high density stands out.
            ctx.globalAlpha = 0.25 + 0.55 * t;
            ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
          }
        }
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      for (let c = 1; c < cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cellW, 0);
        ctx.lineTo(c * cellW, height);
        ctx.stroke();
      }
      for (let r = 1; r < rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cellH);
        ctx.lineTo(width, r * cellH);
        ctx.stroke();
      }
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [grid, sport]);

  const rows = grid?.length || 0;
  const cols = rows > 0 ? grid[0].length : 0;
  const hasGrid = rows > 0 && cols > 0;
  const hasDensity = hasGrid && grid.some((row) => row.some((v) => v > 0));

  return (
    <div className="heatmap-container" ref={containerRef}>
      {!hasGrid ? (
        <p className="heatmap-empty">No heatmap data available for this analysis.</p>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            className="heatmap-canvas"
            role="img"
            aria-label="Player position density heatmap"
          />
          {!hasDensity && (
            <p className="heatmap-empty">No player positions were recorded for this analysis.</p>
          )}
          <div className="heatmap-legend">
            <span>Low</span>
            <div className="heatmap-legend-gradient" />
            <span>High</span>
          </div>
        </>
      )}
    </div>
  );
};

export default Heatmap;
