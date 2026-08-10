import React, { useEffect, useRef, useState } from 'react';
import './EventMap.css';

const SURFACE_COLOR = {
  soccer: '#2e7d32',
  hockey: '#2e7d32',
  rugby: '#2e7d32',
  basketball: '#b5651d',
};

const EVENT_COLORS = {
  shot: '#ef4444',
  pass: '#3b82f6',
  tackle: '#f59e0b',
  interception: '#8b5cf6',
};

const EventMap = ({ actions = [], eventType = 'all', sport = 'soccer' }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const filteredActions = actions.filter((action) => eventType === 'all' || action.type === eventType);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || filteredActions.length === 0) return;

      const width = container.clientWidth || 600;
      const height = Math.max(200, Math.round((width * 2) / 3));
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

      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 30, 0, Math.PI * 2);
      ctx.stroke();

      const radius = 8;
      filteredActions.forEach((action) => {
        const x = (action.position?.x || 0.5) * width;
        const y = (action.position?.y || 0.5) * height;

        const color = EVENT_COLORS[action.type] || '#6b7280';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      ctx.globalAlpha = 1;
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [filteredActions, sport]);

  const eventTypeBreakdown = React.useMemo(() => {
    const breakdown = {};
    filteredActions.forEach((action) => {
      breakdown[action.type] = (breakdown[action.type] || 0) + 1;
    });
    return breakdown;
  }, [filteredActions]);

  const handleCanvasClick = (event) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const scale = canvas.width / container.clientWidth;

    const radius = 8 * scale;
    for (let i = 0; i < filteredActions.length; i++) {
      const action = filteredActions[i];
      const posX = (action.position?.x || 0.5) * canvas.width;
      const posY = (action.position?.y || 0.5) * canvas.height;

      const dx = x * scale - posX;
      const dy = y * scale - posY;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        setSelectedEvent(action);
        return;
      }
    }
    setSelectedEvent(null);
  };

  return (
    <div className="event-map-container">
      <div className="event-map-header">
        <div className="event-map-stats">
          <span className="event-stat">
            <span className="event-stat-dot" style={{ backgroundColor: '#ef4444' }} />
            {eventTypeBreakdown.shot || 0} shots
          </span>
          <span className="event-stat">
            <span className="event-stat-dot" style={{ backgroundColor: '#3b82f6' }} />
            {eventTypeBreakdown.pass || 0} passes
          </span>
          <span className="event-stat">
            <span className="event-stat-dot" style={{ backgroundColor: '#f59e0b' }} />
            {eventTypeBreakdown.tackle || 0} tackles
          </span>
          <span className="event-stat">
            <span className="event-stat-dot" style={{ backgroundColor: '#8b5cf6' }} />
            {eventTypeBreakdown.interception || 0} interceptions
          </span>
        </div>
      </div>

      {filteredActions.length === 0 ? (
        <div className="event-map-empty">
          <p>No events to display on the pitch map.</p>
        </div>
      ) : (
        <>
          <div className="event-map-canvas-wrapper" ref={containerRef}>
            <canvas
              ref={canvasRef}
              className="event-map-canvas"
              role="img"
              aria-label="Event location map"
              onClick={handleCanvasClick}
            />
          </div>

          {selectedEvent && (
            <div className="event-map-detail">
              <button
                className="event-map-detail-close"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close event detail"
              >
                ×
              </button>
              <div className="event-map-detail-header">
                <span
                  className="event-map-detail-type"
                  style={{ backgroundColor: EVENT_COLORS[selectedEvent.type] || '#6b7280' }}
                >
                  {selectedEvent.type}
                </span>
                <p className="event-map-detail-frame">Frame {selectedEvent.frameNumber}</p>
              </div>
              <div className="event-map-detail-content">
                {selectedEvent.position && (
                  <p>Position: ({Math.round(selectedEvent.position.x * 100)}%, {Math.round(selectedEvent.position.y * 100)}%)</p>
                )}
                {selectedEvent.confidence && (
                  <p>Confidence: {Math.round(selectedEvent.confidence * 100)}%</p>
                )}
                {selectedEvent.playerId && (
                  <p>Player: {selectedEvent.playerId}</p>
                )}
              </div>
            </div>
          )}

          <div className="event-map-legend">
            <span className="event-legend-item">
              <span className="event-legend-color" style={{ backgroundColor: '#ef4444' }} />
              Shot attempt
            </span>
            <span className="event-legend-item">
              <span className="event-legend-color" style={{ backgroundColor: '#3b82f6' }} />
              Pass
            </span>
            <span className="event-legend-item">
              <span className="event-legend-color" style={{ backgroundColor: '#f59e0b' }} />
              Tackle
            </span>
            <span className="event-legend-item">
              <span className="event-legend-color" style={{ backgroundColor: '#8b5cf6' }} />
              Interception
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default EventMap;
