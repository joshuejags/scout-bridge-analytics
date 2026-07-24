const mongoose = require('mongoose');
const Player = require('../models/Player');
const Analysis = require('../models/Analysis');

exports.createPlayer = async (req, res) => {
  try {
    const player = new Player(req.body);
    await player.save();
    res.status(201).json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPlayers = async (req, res) => {
  try {
    const players = await Player.find().populate('team');
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPlayerById = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id).populate('team');
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePlayer = async (req, res) => {
  try {
    const player = await Player.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deletePlayer = async (req, res) => {
  try {
    const player = await Player.findByIdAndDelete(req.params.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json({ message: 'Player deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Cross-match stats aggregation for 2+ players, for side-by-side comparison.
 *
 * A Player is linked to CV data indirectly: each Analysis document's
 * playerData entries carry a playerId once a track has been matched (by
 * jersey OCR) or manually verified (see analysisController.updatePlayerTrack/
 * mergePlayerTracks). Actions and possession events, though, are keyed by
 * that analysis's own trackId strings, not the Player's real ObjectId — so
 * per-analysis action counts require going track -> trackId -> matching
 * actions, one analysis at a time, rather than a single cross-collection
 * query.
 */
exports.comparePlayers = async (req, res) => {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length < 2) {
      return res.status(400).json({ error: 'Provide at least two player ids via ?ids=id1,id2' });
    }
    if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ error: 'One or more player ids are invalid' });
    }

    const players = await Player.find({ _id: { $in: ids } }).populate('team');
    const foundIds = new Set(players.map((p) => String(p._id)));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length) {
      return res.status(404).json({ error: `Player(s) not found: ${missing.join(', ')}` });
    }

    const analyses = await Analysis.find({ 'playerData.playerId': { $in: ids } }).populate(
      'video',
      'originalName createdAt'
    );

    // Preserve the order the caller asked for rather than Mongo's $in order.
    const playersById = new Map(players.map((p) => [String(p._id), p]));
    const results = ids.map((id) => {
      const player = playersById.get(id);
      let matchesPlayed = 0;
      let totalDistance = 0;
      let totalSprints = 0;
      let speedSamples = [];
      let verifiedTracks = 0;
      const actionCounts = { pass: 0, shot: 0, tackle: 0, interception: 0 };
      const matches = [];

      analyses.forEach((analysis) => {
        const tracks = analysis.playerData.filter(
          (pd) => pd.playerId && String(pd.playerId) === id
        );
        if (tracks.length === 0) return;

        matchesPlayed += 1;
        const trackIds = new Set();
        let matchDistance = 0;
        tracks.forEach((t) => {
          matchDistance += t.statistics?.distanceCovered || 0;
          totalSprints += t.statistics?.sprintCount || 0;
          if (t.statistics?.averageSpeed) speedSamples.push(t.statistics.averageSpeed);
          if (t.verified) verifiedTracks += 1;
          if (t.trackId) trackIds.add(t.trackId);
        });
        totalDistance += matchDistance;

        let matchActionCount = 0;
        analysis.actions.forEach((a) => {
          if (a.playerId && trackIds.has(a.playerId) && actionCounts[a.type] !== undefined) {
            actionCounts[a.type] += 1;
            matchActionCount += 1;
          }
        });

        matches.push({
          video: analysis.video
            ? { _id: analysis.video._id, originalName: analysis.video.originalName }
            : null,
          distanceCovered: round2(matchDistance),
          actionCount: matchActionCount,
        });
      });

      const avgSpeed = speedSamples.length
        ? round2(speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length)
        : 0;

      return {
        player: {
          _id: player._id,
          name: player.name,
          position: player.position,
          jerseyNumber: player.jerseyNumber,
          team: player.team,
        },
        matchesPlayed,
        totalDistanceCovered: round2(totalDistance),
        averageDistancePerMatch: matchesPlayed ? round2(totalDistance / matchesPlayed) : 0,
        averageSpeed: avgSpeed,
        totalSprints,
        averageSprintsPerMatch: matchesPlayed ? round2(totalSprints / matchesPlayed) : 0,
        actions: actionCounts,
        totalActions: Object.values(actionCounts).reduce((a, b) => a + b, 0),
        verifiedTracks,
        matches,
      };
    });

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

function round2(n) {
  return Math.round(n * 100) / 100;
}
