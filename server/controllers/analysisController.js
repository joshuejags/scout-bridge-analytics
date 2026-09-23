const path = require('path');

const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const Player = require('../models/Player');
const { emitEvent } = require('../utils/socket');
const { isOwnerOrAdmin } = require('./videoController');
const { buildReportInsights } = require('../utils/reportInsights');

// Project root is one level up from server/ (this file lives in
// server/controllers/) when running from a full repo checkout — true for
// local dev, but NOT true in the Docker image, which only copies server/
// into /app. Every path below can be overridden by env var for that case
// (see docker-compose.yml); the __dirname-based defaults keep local dev
// working unchanged.
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(PROJECT_ROOT, 'server', 'uploads')
);
const THUMBNAILS_ROOT = path.join(UPLOAD_DIR, 'thumbnails');

/**
 * Persist the analyzer's JSON output as an Analysis document and update the
 * parent video. Returns the saved Analysis.
 */
async function persistAnalysis(video, result, processingLeaseId = null) {
  const { validateAnalysisResult } = require('../utils/validateResult');
  const validation = validateAnalysisResult(result);
  if (!validation.valid) {
    console.warn('analysis result validation failed', validation.errors);
    if (processingLeaseId) {
      await Video.updateOne(
        { _id: video._id, status: 'processing', processingLeaseId },
        { $set: { status: 'failed', lastError: 'analysis result validation failed' }, $unset: { processingStartedAt: 1, processingLeaseId: 1, processingHeartbeatAt: 1 } }
      );
    } else {
      video.status = 'failed';
      video.lastError = 'analysis result validation failed';
      await video.save();
    }
    return null;
  }
  // Map schema: the analyzer emits per-track data with an OCR-read jersey
  // number (when legible) and a dominant shirt color. Match each track to
  // a real Player document by jersey number, scoped to the video's team(s)
  // when known, so a roster player's stats reflect the track that actually
  // showed their number rather than an arbitrary first-track attachment.
  if (processingLeaseId) {
    const leaseIsAlive = await Video.exists({ _id: video._id, status: 'processing', processingLeaseId });
    if (!leaseIsAlive) throw new Error('Analysis worker lease was lost before persistence');
  }

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
    tacticalData: result.tacticalData || { teams: [] },
    summary: {
      totalPlayers:
        result.summary?.totalPlayers ?? playerData.length,
      matchDuration: result.summary?.matchDuration ?? 0,
      highlightedMoments: result.summary?.highlightedMoments || [],
      qualityFlag: result.summary?.qualityFlag || null,
    },
  });

  await analysis.save();

  // Offload large per-track trackingData to object storage to avoid
  // bloating the MongoDB documents. Replace the in-document array with
  // a pointer to the uploaded artifact if it's larger than the
  // configurable threshold.
  try {
    const { uploadJsonObject } = require('../utils/artifactStore');
    const THRESHOLD = Number(process.env.TRACKING_OFFLOAD_THRESHOLD || 500);
    const bucket = process.env.S3_BUCKET || null;
    let updated = false;
    for (let i = 0; i < analysis.playerData.length; i++) {
      const p = analysis.playerData[i];
      if (Array.isArray(p.trackingData) && p.trackingData.length > THRESHOLD) {
        const key = `artifacts/analysis/${analysis._id}/player-${p.trackId || i}-tracking.json`;
        await uploadJsonObject(key, p.trackingData);
        p.trackingData = { s3: bucket ? `s3://${bucket}/${key}` : key };
        updated = true;
      }
    }
    if (updated) await analysis.save();
  } catch (err) {
    console.warn('artifact offload failed:', err.message);
  }

  const finalUpdate = {
    $set: {
      analysis: analysis._id,
      status: 'analyzed',
      lastError: null,
      ...(result.metadata
        ? {
            metadata: {
              width: result.metadata.width,
              height: result.metadata.height,
              fps: result.metadata.fps,
              frameCount: result.metadata.frameCount,
            },
          }
        : {}),
    },
    $unset: { processingStartedAt: 1, processingLeaseId: 1, processingHeartbeatAt: 1 },
  };
  if (processingLeaseId) {
    const finalized = await Video.updateOne(
      { _id: video._id, status: 'processing', processingLeaseId },
      finalUpdate
    );
    if (finalized.modifiedCount !== 1) {
      await Analysis.deleteOne({ _id: analysis._id });
      throw new Error('Analysis worker lease was lost before completion');
    }
  } else {
    video.analysis = analysis._id;
    video.status = 'analyzed';
    video.lastError = null;
    video.processingStartedAt = null;
    video.processingLeaseId = null;
    video.processingHeartbeatAt = null;
  }
  if (result.metadata) {
    video.metadata = {
      width: result.metadata.width,
      height: result.metadata.height,
      fps: result.metadata.fps,
      frameCount: result.metadata.frameCount,
    };
  }
  if (!processingLeaseId) await video.save();

  return analysis;
}

exports.processAnalysis = async (req, res) => {
  const { videoId } = req.params;
  const MAX_ACTIVE_PER_USER = Number(process.env.ANALYSIS_MAX_ACTIVE_PER_USER || 3);
  const MAX_GLOBAL_QUEUED = Number(process.env.ANALYSIS_MAX_GLOBAL_QUEUED || 50);
  let video;
  try {
    video = await Video.findById(videoId);

    if (!video || !isOwnerOrAdmin(video, req.user)) {
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

    // Idempotent while a job is already active: never create a second
    // analysis for the same video when a user double-clicks/retries.
    if (video.status === 'queued' || video.status === 'processing') {
      return res.status(202).json({
        message: 'Analysis already queued',
        videoId: video._id,
        status: video.status,
      });
    }

    // Protect the shared worker pool from one account consuming all slots.
    const ownerId = video.user || req.user?._id;
    const activeFilter = {
      user: ownerId,
      status: { $in: ['queued', 'processing'] },
    };
    const activeForUser = await Video.countDocuments(activeFilter);
    if (activeForUser >= MAX_ACTIVE_PER_USER) {
      return res.status(429).json({
        error: 'Analysis capacity for this account is currently full.',
        code: 'ANALYSIS_USER_CAPACITY',
        active: activeForUser,
        limit: MAX_ACTIVE_PER_USER,
        retryAfterSeconds: 60,
      });
    }

    // Protect the whole installation from an unbounded database-backed
    // queue. This is intentionally separate from BullMQ's worker count:
    // queued videos are claimed by the analysis daemon before they reach
    // the Python worker pool.
    const queuedCount = await Video.countDocuments({ status: 'queued' });
    if (queuedCount >= MAX_GLOBAL_QUEUED) {
      return res.status(429).json({
        error: 'Analysis queue is at capacity. Please try again later.',
        code: 'ANALYSIS_GLOBAL_CAPACITY',
        queued: queuedCount,
        limit: MAX_GLOBAL_QUEUED,
        retryAfterSeconds: 120,
      });
    }

    // Mark as queued and respond 202 immediately; the daemon atomically
    // claims the video and dispatches it to BullMQ/Python workers.
    video.status = 'queued';
    await video.save();
  } catch (error) {
    // Everything above runs before any response is sent, so a plain 500 is
    // safe here — unlike the background job below (which already has its
    // own .catch()), an unhandled rejection in this part previously had
    // nothing catching it at all and could crash the whole process.
    console.error(error);
    return res.status(500).json({ error: error.message });
  }

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
    message: 'Analysis queued',
    videoId: video._id,
    status: 'queued',
  });

  emitEvent('analysis:queued', { videoId: String(video._id) });

  return;

};

// Export helper so external daemons can persist analysis results after
// running the analyzer (used by server/scripts/analysisDaemon.js).
module.exports.persistAnalysis = persistAnalysis;

exports.getAnalysisStatus = async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await Video.findById(videoId).select(
      '_id status progress lastError analysis updatedAt processingStartedAt processingHeartbeatAt'
    );

    if (!video || !isOwnerOrAdmin(video, req.user)) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({
      videoId: video._id,
      status: video.status,
      progress: video.progress || 0,
      lastError: video.lastError || null,
      analysisId: video.analysis || null,
      updatedAt: video.updatedAt,
      processingStartedAt: video.processingStartedAt || null,
      processingHeartbeatAt: video.processingHeartbeatAt || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAnalysisByVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const analysis = await Analysis.findOne({ video: videoId })
      .select(
        'video playerData.playerId playerData.trackId playerData.jerseyNumber playerData.jerseyConfidence playerData.teamColor playerData.thumbnail playerData.verified playerData.statistics actions ballData tacticalData heatmapData summary modelVersion detectionConfig'
      )
      .populate({ path: 'video', populate: ['team', 'opponentTeam', 'players'] })
      .populate('playerData.playerId')
      .populate('actions.playerId');

    // Analysis data is exactly as private as the video it belongs to.
    if (!analysis || !analysis.video || !isOwnerOrAdmin(analysis.video, req.user)) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const analysisObject = analysis.toObject();
    analysisObject.reportInsights = buildReportInsights(analysisObject);
    res.json(analysisObject);
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
    const video = await Video.findById(analysis.video);
    if (!video || !isOwnerOrAdmin(video, req.user)) {
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
    const video = await Video.findById(analysis.video);
    if (!video || !isOwnerOrAdmin(video, req.user)) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const sourceIdx = analysis.playerData.findIndex((p) => p.trackId === sourceTrackId);
    const targetIdx = analysis.playerData.findIndex((p) => p.trackId === targetTrackId);
    if (sourceIdx === -1 || targetIdx === -1) {
      return res.status(404).json({ error: 'One or both tracks not found in this analysis' });
    }

    const source = analysis.playerData[sourceIdx];
    const target = analysis.playerData[targetIdx];

    // Tracking data may be inline or stored as an artifact. Rehydrate it
    // transparently so manual track merging remains available even after
    // MongoDB offloading has reduced the analysis document size.
    const { readJsonObject, uploadJsonObject } = require('../utils/artifactStore');
    const readTrackingData = async (value) => {
      if (Array.isArray(value)) return value;
      if (!value || typeof value !== 'object') return [];

      const pointer = value.s3 || value.key;
      if (!pointer) return [];

      const key = String(pointer).startsWith('s3://')
        ? String(pointer).replace(/^s3:\/\/[^/]+\//, '')
        : String(pointer);

      const data = await readJsonObject(key);
      if (!Array.isArray(data)) throw new Error('Tracking artifact is not a valid array');
      return data;
    };

    const [sourceTrackingData, targetTrackingData] = await Promise.all([
      readTrackingData(source.trackingData),
      readTrackingData(target.trackingData),
    ]);

    // Merge tracking data, sorted chronologically.
    const combined = [...targetTrackingData, ...sourceTrackingData].sort(
      (a, b) => (a.frameNumber ?? 0) - (b.frameNumber ?? 0)
    );
    target.trackingData = combined;

    // Merge statistics: sum distances/sprints, weight-average speed by
    // each track's frame count (a rough but reasonable approximation).
    const tFrames = targetTrackingData.length || 1;
    const sFrames = sourceTrackingData.length || 1;
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

    // Keep the merged result compact: large tracks are written back to the
    // same artifact storage mechanism used by the analysis worker.
    const threshold = Number(process.env.TRACKING_OFFLOAD_THRESHOLD || 500);
    const artifactKeyFromPointer = (value) => {
      if (!value || typeof value !== 'object') return null;
      const pointer = value.s3 || value.key;
      if (!pointer) return null;
      return String(pointer).replace(/^s3:\/\/[^/]+\//, '');
    };

    const previousSourceArtifact = artifactKeyFromPointer(source.trackingData);
    const previousTargetArtifact = artifactKeyFromPointer(target.trackingData);
    let replacementArtifact = null;

    if (combined.length > threshold) {
      const key = `artifacts/analysis/${analysis._id}/player-${target.trackId || targetIdx}-tracking.json`;
      await uploadJsonObject(key, combined);
      const bucket = process.env.S3_BUCKET || null;
      target.trackingData = { s3: bucket ? `s3://${bucket}/${key}` : key };
      replacementArtifact = key;
    } else {
      target.trackingData = combined;
    }

    await analysis.save();

    // The database now references the merged representation, so obsolete
    // source/target artifacts can be removed without risking a broken
    // analysis if the MongoDB write fails.
    const staleArtifacts = [previousSourceArtifact, previousTargetArtifact]
      .filter(Boolean)
      .filter((key, index, keys) => keys.indexOf(key) === index)
      .filter((key) => key !== replacementArtifact);

    if (staleArtifacts.length) {
      const { deleteJsonObject } = require('../utils/artifactStore');
      await Promise.all(
        staleArtifacts.map((key) =>
          deleteJsonObject(key).catch((err) => {
            console.warn(`artifact cleanup failed for ${key}: ${err.message}`);
          })
        )
      );
    }
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

/**
 * Run once at server startup (see server.js). The analysis worker pool's
 * queue is purely in-memory (see utils/analysisWorkerPool.js's pendingQueue/
 * activeJobs) — a server restart, crash, or redeploy while any job was
 * queued or actively running loses it with nothing left to ever pick it
 * back up. Left alone, that video stays stuck at status 'queued'/
 * 'processing' forever: the progress bar looks alive, VideoList disables
 * the Process button for exactly those statuses, and the user has no way
 * to even retry.
 *
 * This process's in-memory queue is necessarily empty at this point (it
 * was just created), so any video already in 'queued'/'processing' is
 * guaranteed to be orphaned from a previous process, not actually in
 * flight — marking it 'failed' (rather than silently re-submitting it,
 * which risks a crash-loop if the same input is what killed the previous
 * process) is what makes the existing "failed -> Retry" UI affordance
 * apply to it, so a human decides whether to try again.
 */
exports.reconcileOrphanedJobs = async () => {
  // Queued jobs are durable: the separate analysis daemon will pick them up
  // after an API restart. Only recover processing jobs that have exceeded the
  // configured timeout, which indicates the worker that claimed them is gone.
  const staleAfterMs = Number(process.env.ANALYSIS_JOB_TIMEOUT || 1800000);
  const staleBefore = new Date(Date.now() - staleAfterMs);
  const result = await Video.updateMany(
    {
      status: 'processing',
      $or: [
        { processingHeartbeatAt: { $lt: staleBefore } },
        { processingHeartbeatAt: null, processingStartedAt: { $lt: staleBefore } },
        { processingHeartbeatAt: { $exists: false }, processingStartedAt: { $lt: staleBefore } },
      ],
    },
    {
      status: 'queued',
      lastError: null,
      $unset: { processingStartedAt: 1, processingLeaseId: 1, processingHeartbeatAt: 1 },
    }
  );
  if (result.modifiedCount > 0) {
    console.warn(
      `[analysis] Re-queued ${result.modifiedCount} stale processing video(s) after restart.`
    );
  }

  // Same problem, one step earlier: a video whose URL download was still
  // running (see videoController.importVideoFromUrl) when the process
  // exited has nothing left to resume it either.
  const importResult = await Video.updateMany(
    { status: 'importing' },
    {
      status: 'failed',
      lastError: 'Import from URL was interrupted by a server restart. Please try again.',
    }
  );
  if (importResult.modifiedCount > 0) {
    console.warn(
      `[analysis] Reconciled ${importResult.modifiedCount} video(s) stuck importing from a previous run.`
    );
  }

  return result.modifiedCount + importResult.modifiedCount;
};
