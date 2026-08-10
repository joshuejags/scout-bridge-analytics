import React, { useEffect, useRef, useMemo } from 'react';
import './PerformanceTrends.css';

const PerformanceTrends = ({ 
  data = [], 
  title = 'Performance trends',
  metric = 'performance',
  unit = 'rating'
}) => {
  const canvasRef = useRef(null);

  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return { min: 0, max: 100, avg: 0, trend: 0 };
    }

    const values = data.map(d => d.value).filter(v => typeof v === 'number');
    if (values.length === 0) return { min: 0, max: 100, avg: 0, trend: 0 };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const trend = values.length > 1 ? values[values.length - 1] - values[0] : 0;

    return { min, max, avg, trend };
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container || data.length === 0) return;

    const width = container.clientWidth || 600;
    const height = 280;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = padding + (graphHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      const value = Math.round(stats.max - ((stats.max - stats.min) / 4) * i);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI"';
      ctx.textAlign = 'right';
      ctx.fillText(value.toString(), padding - 10, y + 4);
    }

    const values = data.map(d => d.value).filter(v => typeof v === 'number');
    if (values.length > 0) {
      const range = stats.max - stats.min || 1;
      const points = values.map((value, i) => {
        const x = padding + (graphWidth / (values.length - 1 || 1)) * i;
        const y = padding + graphHeight - ((value - stats.min) / range) * graphHeight;
        return { x, y };
      });

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();

      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(points[points.length - 1].x, height - padding);
      ctx.lineTo(points[0].x, height - padding);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#3b82f6';
      for (const point of points) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI"';
    ctx.textAlign = 'center';
    for (let i = 0; i < data.length; i++) {
      const x = padding + (graphWidth / (data.length - 1 || 1)) * i;
      const label = data[i].label || `Match ${i + 1}`;
      ctx.fillText(label.substring(0, 8), x, height - 10);
    }

    window.addEventListener('resize', () => {});
    return () => window.removeEventListener('resize', () => {});
  }, [data, stats]);

  const trendDirection = stats.trend > 0 ? 'up' : stats.trend < 0 ? 'down' : 'stable';
  const trendColor = trendDirection === 'up' ? '#10b981' : trendDirection === 'down' ? '#ef4444' : '#64748b';
  const trendArrow = trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→';

  return (
    <div className="performance-trends">
      <div className="trends-header">
        <h3 className="trends-title">{title}</h3>
        <div className="trends-summary">
          <div className="trend-stat">
            <span className="trend-stat-label">Average</span>
            <span className="trend-stat-value">{stats.avg} {unit}</span>
          </div>
          <div className="trend-stat">
            <span className="trend-stat-label">Trend</span>
            <span className="trend-stat-value" style={{ color: trendColor }}>
              {trendArrow} {Math.abs(stats.trend).toFixed(1)}
            </span>
          </div>
          <div className="trend-stat">
            <span className="trend-stat-label">Range</span>
            <span className="trend-stat-value">{stats.min}–{stats.max}</span>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="trends-empty">
          <p>No performance data available yet.</p>
        </div>
      ) : (
        <div className="trends-canvas-wrapper">
          <canvas ref={canvasRef} role="img" aria-label="Performance trend chart" />
        </div>
      )}
    </div>
  );
};

export default PerformanceTrends;
