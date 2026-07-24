const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const mongoose = require('mongoose');

const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const Player = require('../models/Player');
const { emitEvent } = require('../utils/socket');

// Project root is one level up from server/ (this file lives in
// server/controllers/) when running from a full repo checkout — true for
// local dev, but NOT true in the Docker image, which only copies server/
// into /app. Every path below can be overridden by env var for that case
// (see docker-compose.yml); the __dirname-based defaults keep local dev
// working unchanged.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const PYTHON_BIN =
  process.env.PYTHON_BIN ||
  (process.platform === 'win32'
    ? path.join(PROJECT_ROOT, 'venv', 'Scripts', 'python.exe')
    : path.join(PROJECT_ROOT, 'venv', 'bin', 'python'));

const CV_DIR = process.env.CV_DIR || path.join(PROJECT_ROOT, 'server', 'cv');
const ANALYZER_SCRIPT = path.join(CV_DIR, 'video_analyzer.py');
const TMP_DIR = process.env.TMP_ANALYSIS_DIR || path.join(PROJECT_ROOT, 'server', 'tmp_analysis');
const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(PROJECT_ROOT, 'server', 'uploads')
);
const THUMBNAILS_ROOT = path.join(UPLOAD_DIR, 'thumbnails');

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

/**
 * Run the Python analyzer as a child process, write its JSON to a temp file,
 * and return the parsed result. Resolves with the result dict, rejects with
 * an Error on spawn failure, non-zero exit, or invalid JSON. Thumbnails (one
 * representative crop per player track, for the manual review UI) are
 * written directly to thumbnailDir by the analyzer.
 */
function runAnalyzer(videoPath, maxFrames = null, thumbnailDir = null, onProgress = null, sport = null) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(ANALYZER_SCRIPT)) {
      return reject(new Error(`Analyzer script not found at ${ANALYZER_SCRIPT}`));
    }

    const outFile = path.join(TMP_DIR, `analysis-${Date.now()}-${process.pid}.json`);
    const args = [ANALYZER_SCRIPT, videoPath, '--output', outFile];
    if (maxFrames) args.push('--max-frames', String(maxFrames));
    if (thumbnailDir) args.push('--thumbnail-dir', thumbnailDir);
    if (sport) args.push('--sport', sport);

    const child = spawn(PYTHON_BIN, args, {
      cwd: CV_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      windowsHide: true,
    });

    let stderr = '';
    let stdout = '';
    // video_analyzer.py logs "Processed frame X/Y" to stderr (Python's
    // default logging stream) every 30 frames. Scraping that instead of
    // adding a second output channel keeps the analyzer's CLI contract
    // (stdout/--output = final JSON only) unchanged.
    const PROGRESS_RE = /Processed frame (\d+)\/(\d+)/;
    let stderrTail = '';
    child.stdout.on('data', (b) => {
      stdout += b.toString();
    });
    child.stderr.on('data', (b) => {
      const str = b.toString();
      stderr += str;
      if (!onProgress) return;
      // A log line can be split across chunk boundaries; buffer the tail
      // of the previous chunk and only parse complete lines.
      stderrTail += str;
      const lines = stderrTail.split('\n');
      stderrTail = lines.pop();
      for (const line of lines) {
        const m = line.match(PROGRESS_RE);
        if (m) {
          const frame = Number(m[1]);
          const total = Number(m[2]);
          onProgress({ frame, total, progress: total > 0 ? Math.min(99, Math.round((frame / total) * 100)) : null });
        }
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn analyzer: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            `Analyzer exited with code ${code}. stderr (tail): ${stderr.slice(-2000)}`
          )
        );
      }
      let raw;
      try {
        raw = fs.readFileSync(outFile, 'utf8');
      } catch (e) {
        return reject(new Error(`Analyzer produced no output file: ${e.message}`));
      } finally {
        // Best-effort cleanup of the temp file
        fs.unlink(outFile, () => {});
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return reject(new Error(`Analyzer output was not valid JSON: ${e.message}`));
      }
      if (parsed && parsed.error) {
        return reject(new Error(`Analyzer reported error: ${parsed.error}`));
      }
      resolve(parsed);
    });
  });
}

/**
 * Persist the analyzer's JSON output as an Analysis document and update the
 * parent video. Returns the saved Analysis.
 */
async function persistAnalysis(video, result) {
  // Map schema: the analyzer emits per-track data with an OCR-read jersey
  // number (when legible) and a dominant shirt color. Match each track to
  // a real Player document by jersey number, scoped to the video's team(s)
  // when known, so a roster player's stats reflect the track that actually
  // showed their number rather than an arbitrary first-track attachment.
  const teamIds = [video.team, video.opponentTeam].filter(Boolean);
  const rosterQuery = teamIds.length ? { team: { $in: teamIds } } : {};
  const roster = await Player.find(rosterQuery);
  const playerByJersey = new Map(
    roster.filter((p) => p.jerseyNumber != null).map((p) => [p.jerseyNumber, p])
  );

  const playerData = (result.playerData || []).map((p) => {
    const matchedPlayer =
      p.jerseyNumber != null ? playerByJersey.get(p.jerseyNumber) : null;
    return {
      playerId: matchedPlayer ? matchedPlayer._id : null,
      trackId: p.trackId ?? null,
      jerseyNumber: p.jerseyNumber ?? null,
      jerseyConfidence: p.jerseyConfidence ?? null,
      teamColor: p.teamColor ?? null,
      thumbnail: p.thumbnail ? `${video._id}/${p.thumbnail}` : null,
      verified: false,
      trackingData: p.trackingData || [],
      statistics: p.statistics || {
        distanceCovered: 0,
        averageSpeed: 0,
        sprintCount: 0,
        activationArea: 'Unknown',
      },
    };
  });

  const analysis = new Analysis({
    video: video._id,
    playerData,
    ballData: result.ballData || { trackingData: [], possessionStats: [] },
    actions: result.actions || [],
    heatmapData: result.heatmapData || { grid: [], cellSize: 50 },
    summary: {
      totalPlayers:
        result.summary?.totalPlayers ?? playerData.length,
      matchDuration: result.summary?.matchDuration ?? 0,
      highlightedMoments: result.summary?.highlightedMoments || [],
    },
  });

  await analysis.save();

  video.analysis = analysis._id;
  video.status = 'analyzed';
  if (result.metadata) {
    video.metadata = {
      width: result.metadata.width,
      height: result.metadata.height,
      fps: result.metadata.fps,
      frameCount: result.metadata.frameCount,
    };
  }
  await video.save();

  return analysis;
}

exports.processAnalysis = async (req, res) => {
  const { videoId } = req.params;
  const video = await Video.findById(videoId);

  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  // Idempotent: if the video already has an analysis attached, return it.
  if (video.status === 'analyzed' && video.analysis) {
    const existing = await Analysis.findById(video.analysis);
    if (existing) {
      return res.status(200).json(existing);
    }
    // status says analyzed but no analysis doc — fall through and reprocess
  }

  // Stale processing state: allow retry by clearing the flag and continuing.
  if (video.status === 'processing') {
    console.warn(`Video ${videoId} was stuck in 'processing'; retrying.`);
  }

  // Mark as processing and respond 202 immediately so the client can poll.
  video.status = 'processing';
  await video.save();

  // Resolve to an absolute file path. Multer's UPLOAD_DIR (./uploads) is
  // resolved relative to process.cwd(), which is server/ (the process is
  // always started from there), not the project root.
  const videoPath = path.isAbsolute(video.filePath)
    ? video.filePath
    : path.join(PROJECT_ROOT, 'server', video.filePath);
  const maxFrames = process.env.ANALYZER_MAX_FRAMES
    ? Number(process.env.ANALYZER_MAX_FRAMES)
    : null;
  const thumbnailDir = path.join(THUMBNAILS_ROOT, String(video._id));

  res.status(202).json({
    message: 'Analysis started',
    videoId: video._id,
    status: 'processing',
  });

  const videoIdStr = String(video._id);
  emitEvent('analysis:started', { videoId: videoIdStr });

  // Progress updates are pushed live via socket on every throttled log line,
  // but only persisted to Mongo every 10% — full per-frame DB writes would
  // add write load with no real benefit, since the socket push is what
  // drives the live UI and the DB copy only needs to be fresh enough to
  // survive a page reload mid-analysis.
  let lastPersistedProgress = 0;
  const onProgress = ({ frame, total, progress }) => {
    emitEvent('analysis:progress', { videoId: videoIdStr, frame, total, progress });
    if (progress != null && progress - lastPersistedProgress >= 10) {
      lastPersistedProgress = progress;
      Video.updateOne({ _id: video._id }, { progress }).catch(() => {});
    }
  };

  // Run analyzer in the background.
  runAnalyzer(videoPath, maxFrames, thumbnailDir, onProgress, video.sport)
    .then(async (result) => {
      const analysis = await persistAnalysis(video, result);
      console.log(
        `Analysis complete for video ${video._id} (${result._runtimeSeconds ?? '?'}s)`
      );
      emitEvent('analysis:complete', { videoId: videoIdStr, analysisId: String(analysis._id) });
    })
    .catch(async (err) => {
      console.error(`Analysis failed for video ${video._id}: ${err.message}`);
      try {
        const fresh = await Video.findById(video._id);
        if (fresh) {
          fresh.status = 'failed';
          await fresh.save();
        }
      } catch (saveErr) {
        console.error(`Failed to mark video ${video._id} as failed: ${saveErr.message}`);
      }
      emitEvent('analysis:failed', { videoId: videoIdStr, error: err.message });
    });
};

exports.getAnalysisByVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const analysis = await Analysis.findOne({ video: videoId })
      .populate({ path: 'video', populate: ['team', 'opponentTeam', 'players'] })
      .populate('playerData.playerId')
      .populate('actions.playerId');

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json(analysis);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Manual correction: update a single track's identity. Automatic jersey
 * OCR only successfully reads a small fraction of tracks on typical
 * broadcast-angle footage (numbers are only legible when a player's back
 * faces the camera), so a human reviewer needs to be able to label or
 * relink the rest by eye using the track's thumbnail.
 */
exports.updatePlayerTrack = async (req, res) => {
  try {
    const { analysisId, trackId } = req.params;
    const { jerseyNumber, playerId, teamColor } = req.body;

    const analysis = await Analysis.findById(analysisId);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const track = analysis.playerData.find((p) => p.trackId === trackId);
    if (!track) {
      return res.status(404).json({ error: 'Track not found in this analysis' });
    }

    if (playerId !== undefined) {
      if (playerId === null) {
        track.playerId = null;
      } else {
        const player = await Player.findById(playerId);
        if (!player) {
          return res.status(400).json({ error: 'playerId does not reference an existing player' });
        }
        track.playerId = player._id;
      }
    }
    if (jerseyNumber !== undefined) {
      track.jerseyNumber = jerseyNumber === null ? null : Number(jerseyNumber);
    }
    if (teamColor !== undefined) {
      track.teamColor = teamColor;
    }
    track.verified = true;

    await analysis.save();
    const populated = await Analysis.findById(analysisId).populate('playerData.playerId');
    res.json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Manual correction: merge two tracks that a human has identified as the
 * same real player (a common case given YOLO+ByteTrack fragments a single
 * player into several IDs across occlusion/re-entry). The source track's
 * tracking data, actions, and possession events are folded into the target
 * and the source entry is removed.
 */
exports.mergePlayerTracks = async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { sourceTrackId, targetTrackId } = req.body;

    if (!sourceTrackId || !targetTrackId) {
      return res.status(400).json({ error: 'sourceTrackId and targetTrackId are required' });
    }
    if (sourceTrackId === targetTrackId) {
      return res.status(400).json({ error: 'sourceTrackId and targetTrackId must differ' });
    }

    const analysis = await Analysis.findById(analysisId);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const sourceIdx = analysis.playerData.findIndex((p) => p.trackId === sourceTrackId);
    const targetIdx = analysis.playerData.findIndex((p) => p.trackId === targetTrackId);
    if (sourceIdx === -1 || targetIdx === -1) {
      return res.status(404).json({ error: 'One or both tracks not found in this analysis' });
    }

    const source = analysis.playerData[sourceIdx];
    const target = analysis.playerData[targetIdx];

    // Merge tracking data, sorted chronologically.
    const combined = [...target.trackingData, ...source.trackingData].sort(
      (a, b) => a.frameNumber - b.frameNumber
    );
    target.trackingData = combined;

    // Merge statistics: sum distances/sprints, weight-average speed by
    // each track's frame count (a rough but reasonable approximation).
    const tFrames = target.trackingData.length || 1;
    const sFrames = source.trackingData.length || 1;
    const totalFrames = tFrames + sFrames;
    target.statistics = {
      distanceCovered: round2(
        (target.statistics?.distanceCovered || 0) + (source.statistics?.distanceCovered || 0)
      ),
      averageSpeed: round2(
        ((target.statistics?.averageSpeed || 0) * tFrames +
          (source.statistics?.averageSpeed || 0) * sFrames) /
          totalFrames
      ),
      sprintCount: (target.statistics?.sprintCount || 0) + (source.statistics?.sprintCount || 0),
      activationArea: target.statistics?.activationArea || source.statistics?.activationArea,
    };

    // Prefer whichever side already has an identified jersey/player; target wins ties.
    if (target.jerseyNumber == null && source.jerseyNumber != null) {
      target.jerseyNumber = source.jerseyNumber;
      target.jerseyConfidence = source.jerseyConfidence;
    }
    if (!target.playerId && source.playerId) {
      target.playerId = source.playerId;
    }
    if (!target.teamColor && source.teamColor) {
      target.teamColor = source.teamColor;
    }
    if (!target.thumbnail && source.thumbnail) {
      target.thumbnail = source.thumbnail;
    }
    target.verified = true;

    // Repoint actions and possession events that referenced the source
    // track's id so they don't dangle after it's removed.
    analysis.actions.forEach((a) => {
      if (a.playerId === sourceTrackId) a.playerId = targetTrackId;
    });
    analysis.ballData.possessionStats.forEach((p) => {
      if (p.playerId === sourceTrackId) p.playerId = targetTrackId;
    });

    analysis.playerData.splice(sourceIdx, 1);
    analysis.summary.totalPlayers = analysis.playerData.length;

    await analysis.save();
    const populated = await Analysis.findById(analysisId).populate('playerData.playerId');
    res.json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

function round2(n) {
  return Math.round(n * 100) / 100;
}
