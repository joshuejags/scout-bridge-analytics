/**
 * Seeds a real demo match into the database from Metrica Sports' public
 * sample tracking dataset (github.com/metrica-sports/sample-data, MIT-ish
 * "free to use" sample data released for the football-analytics
 * community — anonymized player positions + event annotations from a
 * real match, not synthetic data).
 *
 * This gives the app real player-position tracking to derive stats from,
 * so seeded heatmaps/distance/speed/sprint numbers and pass/shot/tackle/
 * interception events are *computed* the same way a real analysis run
 * would compute them (same formulas as server/cv/video_analyzer.py), not
 * hand-typed placeholder numbers.
 *
 * Usage: node scripts/seedDemoData.js
 *
 * Writes to MongoDB (a dedicated "demo" account owns the seeded video, so
 * it doesn't show up in any real user's video list — see the video
 * isolation fix in videoController.js) and also emits a static JSON
 * snapshot at client/src/data/sampleAnalysis.json for the public landing
 * page, which has no backend session to fetch from.
 */
const path = require('path');
const https = require('https');
const fs = require('fs');
const mongoose = require('mongoose');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });

const Team = require('../models/Team');
const Player = require('../models/Player');
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const User = require('../models/User');
const {
  ASSUMED_FRAME_WIDTH,
  FRAME_HEIGHT,
  round2,
  parseTrackingCsv,
  computeStatistics,
  buildHeatmap,
  parseEvents,
  subsampleTracking,
} = require('./lib/metricaParser');

const FPS = 25;
// ~6.7 minutes of real match action — enough to be a rich, varied sample
// (46 passes, 4 shots, 12 challenges, several interceptions in this
// window) without seeding a full 90-minute match worth of tracking data.
const MAX_FRAME = 10000;

const BASE_URL =
  'https://raw.githubusercontent.com/metrica-sports/sample-data/master/data/Sample_Game_1';

const CACHE_DIR = path.join(__dirname, '.cache');

/**
 * Fetches with a hard timeout (this session's connection has been slow
 * enough at times to hang a bare https.get() indefinitely) and caches the
 * response to disk, so re-running this script to tweak the seed doesn't
 * re-download ~10MB of tracking data every time.
 */
function fetchText(url) {
  const cachePath = path.join(CACHE_DIR, encodeURIComponent(url));
  if (fs.existsSync(cachePath)) {
    return Promise.resolve(fs.readFileSync(cachePath, 'utf8'));
  }
  return new Promise((resolve, reject) => {
    const req = https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          fs.mkdirSync(CACHE_DIR, { recursive: true });
          fs.writeFileSync(cachePath, data);
          resolve(data);
        });
      })
      .on('error', reject);
    req.setTimeout(45000, () => {
      req.destroy(new Error(`Timed out fetching ${url}`));
    });
  });
}

async function ensureDemoUser() {
  let user = await User.findOne({ email: 'demo@scoutbridge.local' });
  if (!user) {
    user = new User({
      name: 'Demo Data',
      email: 'demo@scoutbridge.local',
      password: require('crypto').randomBytes(24).toString('hex'), // never logged in with, just needs to satisfy the schema
      role: 'scout',
      emailVerified: true,
    });
    await user.save();
    console.log('Created demo owner account demo@scoutbridge.local');
  }
  return user;
}

async function main() {
  console.log('Fetching real match tracking + event data from metrica-sports/sample-data...');
  const [homeCsv, awayCsv, eventsCsv] = await Promise.all([
    fetchText(`${BASE_URL}/Sample_Game_1_RawTrackingData_Home_Team.csv`),
    fetchText(`${BASE_URL}/Sample_Game_1_RawTrackingData_Away_Team.csv`),
    fetchText(`${BASE_URL}/Sample_Game_1_RawEventsData.csv`),
  ]);
  console.log('Fetched. Parsing...');

  const { tracks: homeTracks, ballSeries } = parseTrackingCsv(homeCsv, MAX_FRAME);
  const { tracks: awayTracks } = parseTrackingCsv(awayCsv, MAX_FRAME);
  const actions = parseEvents(eventsCsv, MAX_FRAME);

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scout-bridge-analytics');
  console.log('Connected to MongoDB.');

  const demoUser = await ensureDemoUser();

  // Clear out any previously-seeded demo data so this script is safely
  // re-runnable rather than accumulating duplicates on each run.
  const previous = await Video.find({ user: demoUser._id, originalName: /Sample Match/ });
  for (const v of previous) {
    if (v.analysis) await Analysis.findByIdAndDelete(v.analysis);
    await Video.findByIdAndDelete(v._id);
  }
  await Team.deleteMany({ name: { $in: ['Home Team (Sample Data)', 'Away Team (Sample Data)'] } });
  await Player.deleteMany({ name: /^Player #\d+ \((Home|Away) Sample\)$/ });

  const homeTeam = await Team.create({ name: 'Home Team (Sample Data)' });
  const awayTeam = await Team.create({ name: 'Away Team (Sample Data)' });

  const playerDataEntries = [];
  const allTracksForHeatmap = [];

  const buildSide = async (tracks, team, label) => {
    for (const [jersey, track] of tracks) {
      if (track.positions.length < 10) continue; // matches video_analyzer.py's MIN_TRACK_FRAMES filter
      const player = await Player.create({
        name: `Player #${jersey} (${label} Sample)`,
        team: team._id,
        jerseyNumber: jersey,
      });
      const statistics = computeStatistics(track.positions, track.frames);
      allTracksForHeatmap.push(track);
      playerDataEntries.push({
        playerId: player._id,
        trackId: String(jersey),
        jerseyNumber: jersey,
        jerseyConfidence: 1,
        teamColor: label === 'Home' ? 'blue' : 'red',
        thumbnail: null,
        verified: true, // this is real tracking data, not an OCR guess
        trackingData: subsampleTracking(track.frames, track.positions),
        statistics,
      });
    }
  };
  await buildSide(homeTracks, homeTeam, 'Home');
  await buildSide(awayTracks, awayTeam, 'Away');

  const heatmapData = buildHeatmap(allTracksForHeatmap);

  const video = await Video.create({
    filename: 'sample-match-demo.mp4',
    originalName: 'Sample Match (Metrica Sports open tracking data)',
    fileSize: 0,
    filePath: 'uploads/.demo-no-file', // no real video file backs this — see README
    uploadedBy: demoUser.email,
    user: demoUser._id,
    status: 'analyzed',
    sport: 'soccer',
    team: homeTeam._id,
    opponentTeam: awayTeam._id,
    metadata: { width: ASSUMED_FRAME_WIDTH, height: FRAME_HEIGHT, fps: FPS, frameCount: MAX_FRAME },
  });

  const analysis = await Analysis.create({
    video: video._id,
    playerData: playerDataEntries,
    ballData: {
      trackingData: ballSeries.filter((_, i) => i % Math.max(1, Math.floor(ballSeries.length / 200)) === 0),
      possessionStats: [],
    },
    actions,
    heatmapData,
    summary: {
      totalPlayers: playerDataEntries.length,
      matchDuration: round2(MAX_FRAME / FPS),
      highlightedMoments: actions.slice(0, 10).map((a) => ({
        frameNumber: a.frameNumber,
        type: a.type,
        description: `${a.type.charAt(0).toUpperCase()}${a.type.slice(1)} at frame ${a.frameNumber}`,
      })),
    },
  });

  video.analysis = analysis._id;
  await video.save();

  console.log(`Seeded demo match: ${playerDataEntries.length} players, ${actions.length} actions, video ${video._id}`);

  // Static snapshot for the public landing page (no auth session to fetch
  // this from, and a guest shouldn't need one just to see what the
  // product produces).
  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: 'https://github.com/metrica-sports/sample-data (Sample_Game_1, real anonymized match tracking)',
    video: {
      originalName: video.originalName,
      sport: video.sport,
      metadata: video.metadata,
    },
    summary: analysis.summary,
    heatmapData: analysis.heatmapData,
    actions: analysis.actions,
    playerData: playerDataEntries.map((p) => ({
      trackId: p.trackId,
      jerseyNumber: p.jerseyNumber,
      teamColor: p.teamColor,
      statistics: p.statistics,
      playerName: `Player #${p.jerseyNumber}`,
    })),
  };
  const outPath = path.join(PROJECT_ROOT, 'client', 'src', 'data', 'sampleAnalysis.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`Wrote static landing-page snapshot to ${outPath}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
