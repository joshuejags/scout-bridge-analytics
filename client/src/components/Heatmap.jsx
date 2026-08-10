import React, { useEffect, useMemo, useRef } from 'react';
import './Heatmap.css';

const SURFACE_COLOR = {
  soccer: '#2e7d32',
  hockey: '#2e7d32',
  rugby: '#2e7d32',
  basketball: '#b5651d',
};

const heatColor = (t) => `hsl(${220 - 220 * t}, 85%, 50%)`;

const Heatmap = ({ grid, sport = 'soccer' }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const metrics = useMemo(() => {
    const rows = Array.isArray(grid) ? grid.length : 0;
    const cols = rows > 0 && Array.isArray(grid[0]) ? grid[0].length : 0;
    const hasGrid = rows > 0 && cols > 0;
    if (!hasGrid) {
      return { rows, cols, hasGrid, hasDensity: false, peakValue: 0, activeCells: 0, totalDensity: 0, peakLocation: null };
    }

    let peakValue = 0;
    let peakLocation = null;
    let totalDensity = 0;
    let activeCells = 0;

    grid.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value > 0) {
          activeCells += 1;
          totalDensity += value;
        }
        if (value > peakValue) {
          peakValue = value;
          peakLocation = { row: rowIndex, col: colIndex };
        }
      });
    });

    return {
      rows,
      cols,
      hasGrid,
      hasDensity: activeCells > 0,
      peakValue,
      activeCells,
      totalDensity,
      peakLocation,
    };
  }, [grid]);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const { rows, cols, hasGrid, hasDensity } = metrics;
      if (!hasGrid || !hasDensity) return;

      const width = container.clientWidth || 600;
      const height = Math.max(140, Math.round((width * rows) / cols));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      let ctx;
      try {
        ctx = canvas.getContext('2d');
      } catch (error) {
        return;
      }
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = SURFACE_COLOR[sport] || SURFACE_COLOR.soccer;
      ctx.fillRect(0, 0, width, height);

      const max = Math.max(...grid.flat(), 1);
      const cellW = width / cols;
      const cellH = height / rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const value = grid[r][c];
          if (!value) continue;
          const t = value / max;
          ctx.fillStyle = heatColor(t);
          ctx.globalAlpha = 0.25 + 0.55 * t;
          ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
        }
      }
      ctx.globalAlpha = 1;

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
  }, [grid, metrics, sport]);

  const { hasGrid, hasDensity, peakValue, activeCells, totalDensity, peakLocation } = metrics;

  return (
    <div className="heatmap-container" ref={containerRef}>
      {!hasGrid ? (
        <p className="heatmap-empty">No heatmap data available for this analysis.</p>
      ) : (
        <>
          <div className="heatmap-summary" aria-label="Heatmap summary">
            <div>
              <span className="heatmap-summary__label">Peak density</span>
              <strong>{peakValue}</strong>
            </div>
            <div>
              <span className="heatmap-summary__label">Active cells</span>
              <strong>{activeCells}</strong>
            </div>
            <div>
              <span className="heatmap-summary__label">Total load</span>
              <strong>{totalDensity}</strong>
            </div>
            <div>
              <span className="heatmap-summary__label">Primary zone</span>
              <strong>{peakLocation ? `R${peakLocation.row + 1}, C${peakLocation.col + 1}` : '—'}</strong>
            </div>
          </div>
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
