/**
 * Pure parsing/computation logic for turning Metrica Sports' public sample
 * tracking data (github.com/metrica-sports/sample-data) into this app's
 * Analysis schema shape. Split out from seedDemoData.js so it's testable
 * without a live network fetch or a MongoDB connection.
 */

// Mirrors server/cv/video_analyzer.py's soccer preset and tuning constants
// exactly, so a seeded player's "distance covered" means the same thing a
// real analysis's does.
const FIELD_LENGTH_M = 105.0;
const ASSUMED_FRAME_WIDTH = 1280;
const PX_PER_METER = ASSUMED_FRAME_WIDTH / FIELD_LENGTH_M;
const FRAME_HEIGHT = Math.round(ASSUMED_FRAME_WIDTH * (68 / 105));
const FPS = 25;
const SPRINT_SPEED_MS = 7.0;
const MIN_SPRINT_RUN = 5;
const SPEED_WINDOW = 5;
const CELL_SIZE = 50;

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Parses one of Metrica's raw tracking CSVs (3 header rows, then Period,
 * Frame, Time[s], then an x,y column pair per player in roster order,
 * then a final Ball x,y pair) into per-player position series plus the
 * ball's series, capped at maxFrame of period 1.
 */
function parseTrackingCsv(csvText, maxFrame) {
  const lines = csvText.split('\n').filter((l) => l.length > 0);
  const jerseyRow = lines[1].split(',');
  const headerRow = lines[2].split(',');

  const playerCols = [];
  let ballColIdx = null;
  for (let i = 3; i < headerRow.length; i++) {
    const label = headerRow[i].trim();
    if (label.startsWith('Player')) {
      playerCols.push({ jersey: Number(jerseyRow[i]), xIdx: i });
      i += 1; // the paired y column
    } else if (label === 'Ball') {
      ballColIdx = i;
      break;
    }
  }

  const tracks = new Map(); // jersey -> { positions: [{x,y}], frames: [] }
  const ballSeries = [];

  for (let r = 3; r < lines.length; r++) {
    const cols = lines[r].split(',');
    const period = Number(cols[0]);
    const frame = Number(cols[1]);
    if (period !== 1 || !Number.isFinite(frame) || frame > maxFrame) continue;

    for (const pc of playerCols) {
      const xNorm = parseFloat(cols[pc.xIdx]);
      const yNorm = parseFloat(cols[pc.xIdx + 1]);
      if (!Number.isFinite(xNorm) || !Number.isFinite(yNorm)) continue;
      if (!tracks.has(pc.jersey)) tracks.set(pc.jersey, { positions: [], frames: [] });
      const t = tracks.get(pc.jersey);
      t.positions.push({ x: xNorm * ASSUMED_FRAME_WIDTH, y: yNorm * FRAME_HEIGHT });
      t.frames.push(frame);
    }

    if (ballColIdx != null) {
      const bx = parseFloat(cols[ballColIdx]);
      const by = parseFloat(cols[ballColIdx + 1]);
      if (Number.isFinite(bx) && Number.isFinite(by)) {
        ballSeries.push({
          frameNumber: frame,
          position: { x: bx * ASSUMED_FRAME_WIDTH, y: by * FRAME_HEIGHT },
          confidence: 0.9,
        });
      }
    }
  }

  return { tracks, ballSeries };
}

// Same smoothed-speed / sprint-counting / activation-area logic as
// video_analyzer.py's analyze() loop, applied to a complete real
// trajectory instead of frame-by-frame during capture.
function computeStatistics(positions, frames) {
  const speeds = [];
  let sprintRun = 0;
  let sprintCount = 0;

  for (let i = 0; i < positions.length; i++) {
    let speed = 0;
    if (i >= 1) {
      const lookback = Math.min(SPEED_WINDOW, i);
      const prev = positions[i - lookback];
      const curr = positions[i];
      const frameGap = frames[i] - frames[i - lookback];
      const dt = frameGap > 0 ? frameGap / FPS : 1 / FPS;
      const dx = (curr.x - prev.x) / PX_PER_METER;
      const dy = (curr.y - prev.y) / PX_PER_METER;
      speed = Math.hypot(dx, dy) / dt;
    }
    speeds.push(speed);
    if (speed >= SPRINT_SPEED_MS) {
      sprintRun += 1;
      if (sprintRun === MIN_SPRINT_RUN) sprintCount += 1;
    } else {
      sprintRun = 0;
    }
  }

  let distPx = 0;
  for (let i = 1; i < positions.length; i++) {
    distPx += Math.hypot(positions[i].x - positions[i - 1].x, positions[i].y - positions[i - 1].y);
  }
  const distanceCovered = distPx / PX_PER_METER;
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / (speeds.length || 1);

  const cxAvg = positions.reduce((s, p) => s + p.x, 0) / positions.length;
  const cyAvg = positions.reduce((s, p) => s + p.y, 0) / positions.length;
  const hArea = cxAvg < ASSUMED_FRAME_WIDTH / 3 ? 'Left' : cxAvg < (2 * ASSUMED_FRAME_WIDTH) / 3 ? 'Center' : 'Right';
  const vArea = cyAvg < FRAME_HEIGHT / 3 ? 'Top' : cyAvg < (2 * FRAME_HEIGHT) / 3 ? 'Midfield' : 'Bottom';

  return {
    distanceCovered: round2(distanceCovered),
    averageSpeed: round2(avgSpeed),
    sprintCount,
    activationArea: `${vArea}-${hArea}`,
  };
}

function buildHeatmap(allTracks) {
  const cols = Math.max(1, Math.floor(ASSUMED_FRAME_WIDTH / CELL_SIZE));
  const rows = Math.max(1, Math.floor(FRAME_HEIGHT / CELL_SIZE));
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (const { positions } of allTracks) {
    for (const p of positions) {
      const gx = Math.min(Math.floor(p.x / CELL_SIZE), cols - 1);
      const gy = Math.min(Math.floor(p.y / CELL_SIZE), rows - 1);
      if (gx >= 0 && gy >= 0) grid[gy][gx] += 1;
    }
  }
  return { grid, cellSize: CELL_SIZE };
}

// Metrica's real event log -> this app's actions schema. CHALLENGE events
// are logged twice (once per side, "-WON"/"-LOST" subtype) for the same
// physical duel; only the winner is recorded as a "tackle" to avoid
// double-counting one real event as two.
function parseEvents(eventsCsv, maxFrame) {
  const lines = eventsCsv.split('\n').filter((l) => l.length > 0);
  const actions = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const [, type, subtype, periodStr, startFrameStr, , , , from] = cols;
    const period = Number(periodStr);
    const startFrame = Number(startFrameStr);
    if (period !== 1 || !Number.isFinite(startFrame) || startFrame > maxFrame || !from) continue;

    const jerseyMatch = from.match(/Player(\d+)/);
    if (!jerseyMatch) continue;
    const playerId = jerseyMatch[1];

    let actionType = null;
    const confidence = 0.95; // real annotated events, not a heuristic guess
    if (type === 'PASS') actionType = 'pass';
    else if (type === 'SHOT') actionType = 'shot';
    else if (type === 'CHALLENGE' && subtype && subtype.endsWith('WON')) actionType = 'tackle';
    else if (type === 'RECOVERY' && subtype === 'INTERCEPTION') actionType = 'interception';

    if (actionType) {
      actions.push({ type: actionType, playerId, frameNumber: startFrame, confidence });
    }
  }
  return actions.sort((a, b) => a.frameNumber - b.frameNumber);
}

function subsampleTracking(frames, positions, confidences) {
  const step = Math.max(1, Math.floor(frames.length / 50));
  const out = [];
  for (let i = 0; i < frames.length; i += step) {
    out.push({
      frameNumber: frames[i],
      position: { x: round2(positions[i].x), y: round2(positions[i].y) },
      confidence: confidences ? confidences[i] : 0.9,
      pose: {},
    });
  }
  return out;
}

module.exports = {
  ASSUMED_FRAME_WIDTH,
  FRAME_HEIGHT,
  CELL_SIZE,
  round2,
  parseTrackingCsv,
  computeStatistics,
  buildHeatmap,
  parseEvents,
  subsampleTracking,
};
