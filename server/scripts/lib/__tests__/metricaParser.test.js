const {
  ASSUMED_FRAME_WIDTH,
  FRAME_HEIGHT,
  CELL_SIZE,
  parseTrackingCsv,
  computeStatistics,
  buildHeatmap,
  parseEvents,
  subsampleTracking,
} = require('../metricaParser');

// A minimal but structurally real Metrica-format tracking CSV: 3 header
// rows (team labels, jersey numbers, column names) then Period/Frame/
// Time/player-x,y-pairs/Ball-x,y — one player (jersey 5) moving in a
// straight line, plus a ball.
const SAMPLE_TRACKING_CSV = [
  ',,,Home,,',
  ',,,5,,',
  'Period,Frame,Time [s],Player5,,Ball,',
  '1,1,0.04,0.1,0.5,0.2,0.5',
  '1,2,0.08,0.2,0.5,0.25,0.5',
  '1,3,0.12,0.3,0.5,0.3,0.5',
  '2,1,0.04,0.9,0.9,0.9,0.9', // period 2 — must be excluded
].join('\n');

const SAMPLE_EVENTS_CSV = [
  'Team,Type,Subtype,Period,Start Frame,Start Time [s],End Frame,End Time [s],From,To,Start X,Start Y,End X,End Y',
  'Home,PASS,,1,1,0.04,3,0.12,Player5,Player6,0.1,0.5,0.2,0.5',
  'Away,CHALLENGE,AERIAL-LOST,1,2,0.08,2,0.08,Player9,,0.3,0.3,NaN,NaN',
  'Home,CHALLENGE,AERIAL-WON,1,2,0.08,2,0.08,Player5,,0.3,0.3,NaN,NaN',
  'Home,RECOVERY,INTERCEPTION,1,3,0.12,3,0.12,Player5,,0.3,0.5,NaN,NaN',
  'Home,SHOT,,1,4,0.16,4,0.16,Player5,,0.3,0.5,NaN,NaN',
  'Home,PASS,,1,50000,2000,50000,2000,Player5,,0.5,0.5,NaN,NaN', // beyond maxFrame — excluded
].join('\n');

describe('metricaParser.parseTrackingCsv', () => {
  it('reads player and ball positions, scaled from normalized 0-1 coords to pixel space', () => {
    const { tracks, ballSeries } = parseTrackingCsv(SAMPLE_TRACKING_CSV, 10000);

    expect(tracks.size).toBe(1);
    const track = tracks.get(5);
    expect(track.frames).toEqual([1, 2, 3]);
    expect(track.positions[0]).toEqual({ x: 0.1 * ASSUMED_FRAME_WIDTH, y: 0.5 * FRAME_HEIGHT });

    expect(ballSeries).toHaveLength(3);
    expect(ballSeries[0].position).toEqual({ x: 0.2 * ASSUMED_FRAME_WIDTH, y: 0.5 * FRAME_HEIGHT });
  });

  it('excludes rows from periods other than period 1', () => {
    const { tracks } = parseTrackingCsv(SAMPLE_TRACKING_CSV, 10000);
    // Only the 3 period-1 rows should be present — the period-2 row (also
    // "frame 1", x=0.9) must not sneak in as a 4th entry.
    expect(tracks.get(5).frames).toHaveLength(3);
    expect(tracks.get(5).positions.some((p) => p.x === 0.9 * ASSUMED_FRAME_WIDTH)).toBe(false);
  });

  it('respects the maxFrame cutoff', () => {
    const { tracks } = parseTrackingCsv(SAMPLE_TRACKING_CSV, 2);
    expect(tracks.get(5).frames).toEqual([1, 2]);
  });
});

describe('metricaParser.computeStatistics', () => {
  it('computes zero distance/speed for a stationary player', () => {
    const positions = Array.from({ length: 10 }, () => ({ x: 100, y: 100 }));
    const frames = Array.from({ length: 10 }, (_, i) => i + 1);
    const stats = computeStatistics(positions, frames);
    expect(stats.distanceCovered).toBe(0);
    expect(stats.averageSpeed).toBe(0);
    expect(stats.sprintCount).toBe(0);
  });

  it('counts a sustained fast run as exactly one sprint', () => {
    // ~12.7 px/m (soccer preset) * 7 m/s * (1/25s per frame) ≈ 3.56 px/frame
    // needed to hit the 7 m/s sprint threshold; move well past it to be
    // unambiguous, for MIN_SPRINT_RUN consecutive frames.
    const positions = [];
    for (let i = 0; i < 12; i++) positions.push({ x: i * 20, y: 0 });
    const frames = Array.from({ length: 12 }, (_, i) => i + 1);
    const stats = computeStatistics(positions, frames);
    expect(stats.sprintCount).toBe(1);
  });

  it('labels activation area from the average position quadrant', () => {
    const topLeft = computeStatistics(
      Array.from({ length: 10 }, () => ({ x: 10, y: 10 })),
      Array.from({ length: 10 }, (_, i) => i + 1)
    );
    expect(topLeft.activationArea).toBe('Top-Left');

    const bottomRight = computeStatistics(
      Array.from({ length: 10 }, () => ({ x: ASSUMED_FRAME_WIDTH - 10, y: FRAME_HEIGHT - 10 })),
      Array.from({ length: 10 }, (_, i) => i + 1)
    );
    expect(bottomRight.activationArea).toBe('Bottom-Right');
  });
});

describe('metricaParser.buildHeatmap', () => {
  it('bins positions into the correct grid cell and dimensions', () => {
    const { grid, cellSize } = buildHeatmap([{ positions: [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 200, y: 100 }] }]);
    expect(cellSize).toBe(CELL_SIZE);
    expect(grid.length).toBe(Math.floor(FRAME_HEIGHT / CELL_SIZE));
    expect(grid[0].length).toBe(Math.floor(ASSUMED_FRAME_WIDTH / CELL_SIZE));
    expect(grid[0][0]).toBe(2); // both (5,5) points land in cell (0,0)
    const gx = Math.floor(200 / CELL_SIZE);
    const gy = Math.floor(100 / CELL_SIZE);
    expect(grid[gy][gx]).toBe(1);
  });

  it('clamps out-of-bounds coordinates into the last valid cell instead of throwing', () => {
    expect(() =>
      buildHeatmap([{ positions: [{ x: ASSUMED_FRAME_WIDTH + 500, y: FRAME_HEIGHT + 500 }] }])
    ).not.toThrow();
  });
});

describe('metricaParser.parseEvents', () => {
  it('maps PASS/SHOT/won-CHALLENGE/intercepted-RECOVERY to the app action-type vocabulary', () => {
    const actions = parseEvents(SAMPLE_EVENTS_CSV, 10000);
    const types = actions.map((a) => a.type);
    expect(types).toEqual(['pass', 'tackle', 'interception', 'shot']);
  });

  it('only records the winning side of a CHALLENGE, not both', () => {
    const actions = parseEvents(SAMPLE_EVENTS_CSV, 10000);
    const tackles = actions.filter((a) => a.type === 'tackle');
    expect(tackles).toHaveLength(1);
    expect(tackles[0].playerId).toBe('5'); // Player5 (the AERIAL-WON side), not Player9
  });

  it('excludes events beyond the maxFrame cutoff', () => {
    const actions = parseEvents(SAMPLE_EVENTS_CSV, 10000);
    expect(actions.every((a) => a.frameNumber <= 10000)).toBe(true);
  });

  it('sorts actions chronologically by frame number', () => {
    const actions = parseEvents(SAMPLE_EVENTS_CSV, 10000);
    const frames = actions.map((a) => a.frameNumber);
    expect(frames).toEqual([...frames].sort((a, b) => a - b));
  });
});

describe('metricaParser.subsampleTracking', () => {
  it('caps output at ~50 points for a long track', () => {
    const frames = Array.from({ length: 5000 }, (_, i) => i + 1);
    const positions = frames.map((f) => ({ x: f, y: f }));
    const out = subsampleTracking(frames, positions);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out.length).toBeGreaterThan(10);
  });

  it('keeps every point for a track shorter than the subsample step', () => {
    const frames = [1, 2, 3];
    const positions = frames.map((f) => ({ x: f, y: f }));
    const out = subsampleTracking(frames, positions);
    expect(out).toHaveLength(3);
  });
});
