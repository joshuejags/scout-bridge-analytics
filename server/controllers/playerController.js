const mongoose = require('mongoose');
const Player = require('../models/Player');
const Analysis = require('../models/Analysis');
const { friendlyMongooseError } = require('../utils/mongooseErrors');
const { pick } = require('../utils/pick');

const PLAYER_FIELDS = [
  'name',
  'team',
  'position',
  'jerseyNumber',
  'age',
  'heightCm',
  'weightKg',
  'nationality',
  'preferredFoot',
  'contractStatus',
  'marketValue',
  'profileSummary',
];

exports.createPlayer = async (req, res) => {
  try {
    const player = new Player(pick(req.body, PLAYER_FIELDS));
    await player.save();
    res.status(201).json(player);
  } catch (error) {
    const message = friendlyMongooseError(error);
    if (message) return res.status(400).json({ error: message });
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPlayers = async (req, res) => {
  try {
    const query = req.query.q?.trim();
    const filters = {};
    const searchClauses = [];

    if (query) {
      searchClauses.push(
        { name: { $regex: query, $options: 'i' } },
        { position: { $regex: query, $options: 'i' } },
        { nationality: { $regex: query, $options: 'i' } },
        { profileSummary: { $regex: query, $options: 'i' } }
      );
    }

    if (req.query.position) {
      filters.position = { $regex: req.query.position, $options: 'i' };
    }

    const clubQuery = req.query.club?.trim();
    if (clubQuery) {
      const clubClauses = [{ name: { $regex: clubQuery, $options: 'i' } }, { profileSummary: { $regex: clubQuery, $options: 'i' } }];
      if (mongoose.Types.ObjectId.isValid(clubQuery)) {
        clubClauses.push({ team: clubQuery });
      }
      searchClauses.push(...clubClauses);
    }

    if (req.query.country) {
      filters.nationality = { $regex: req.query.country, $options: 'i' };
    }

    if (req.query.league) {
      searchClauses.push({ profileSummary: { $regex: req.query.league, $options: 'i' } });
    }

    if (req.query.ageMin || req.query.ageMax) {
      filters.age = {};
      if (req.query.ageMin) filters.age.$gte = Number(req.query.ageMin);
      if (req.query.ageMax) filters.age.$lte = Number(req.query.ageMax);
    }
    if (req.query.heightMin || req.query.heightMax) {
      filters.heightCm = {};
      if (req.query.heightMin) filters.heightCm.$gte = Number(req.query.heightMin);
      if (req.query.heightMax) filters.heightCm.$lte = Number(req.query.heightMax);
    }
    if (req.query.weightMin || req.query.weightMax) {
      filters.weightKg = {};
      if (req.query.weightMin) filters.weightKg.$gte = Number(req.query.weightMin);
      if (req.query.weightMax) filters.weightKg.$lte = Number(req.query.weightMax);
    }

    if (searchClauses.length) {
      filters.$or = searchClauses;
    }

    const players = await Player.find(filters).populate('team').sort({ createdAt: -1 });
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPlayerOverview = async (req, res) => {
  try {
    const players = await Player.find().populate('team').sort({ createdAt: -1 });
    const analyses = await Analysis.find({ 'playerData.0': { $exists: true } }).populate(
      'video',
      'originalName createdAt status sport'
    );

    const playerSummaries = players.map((player) => ({
      player: {
        _id: player._id,
        name: player.name,
        position: player.position,
        jerseyNumber: player.jerseyNumber,
        age: player.age,
        heightCm: player.heightCm,
        weightKg: player.weightKg,
        nationality: player.nationality,
        preferredFoot: player.preferredFoot,
        contractStatus: player.contractStatus,
        marketValue: player.marketValue,
        profileSummary: player.profileSummary,
        team: player.team,
      },
      summary: aggregatePlayerSummary(String(player._id), analyses),
    }));

    const trackedProfiles = playerSummaries.filter((item) => item.summary.matchesPlayed > 0);
    const analyzedMatchIds = new Set();
    analyses.forEach((analysis) => {
      if (analysis.video?._id) analyzedMatchIds.add(String(analysis.video._id));
    });

    res.json({
      summary: {
        totalPlayers: players.length,
        trackedProfiles: trackedProfiles.length,
        analyzedMatches: analyzedMatchIds.size,
        verifiedTracks: trackedProfiles.reduce((sum, item) => sum + item.summary.verifiedTracks, 0),
      },
      featuredPlayers: [...playerSummaries]
        .sort((a, b) => {
          const scoreA = a.summary.matchesPlayed * 3 + a.summary.totalActions + a.summary.totalDistanceCovered / 1000;
          const scoreB = b.summary.matchesPlayed * 3 + b.summary.totalActions + b.summary.totalDistanceCovered / 1000;
          return scoreB - scoreA;
        })
        .slice(0, 6),
      recentMatches: [...analyses]
        .filter((analysis) => analysis.video)
        .sort((a, b) => new Date(b.video.createdAt) - new Date(a.video.createdAt))
        .slice(0, 6)
        .map((analysis) => ({
          analysisId: analysis._id,
          video: analysis.video,
          trackedPlayers: analysis.playerData.length,
          actionCount: analysis.actions.length,
        })),
    });
  } catch (error) {
    console.error(error);
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
    const player = await Player.findByIdAndUpdate(req.params.id, pick(req.body, PLAYER_FIELDS), {
      new: true,
    });
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(player);
  } catch (error) {
    const message = friendlyMongooseError(error);
    if (message) return res.status(400).json({ error: message });
    console.error(error);
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
      const trendPoints = [];

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
        let matchSprints = 0;
        analysis.actions.forEach((a) => {
          if (a.playerId && trackIds.has(a.playerId) && actionCounts[a.type] !== undefined) {
            actionCounts[a.type] += 1;
            matchActionCount += 1;
          }
        });

        tracks.forEach((track) => {
          matchSprints += track.statistics?.sprintCount || 0;
        });

        matches.push({
          video: analysis.video
            ? { _id: analysis.video._id, originalName: analysis.video.originalName }
            : null,
          distanceCovered: round2(matchDistance),
          actionCount: matchActionCount,
          sprints: round2(matchSprints),
        });

        trendPoints.push({
          label: analysis.video?.originalName || `Match ${trendPoints.length + 1}`,
          distance: round2(matchDistance),
          actions: matchActionCount,
          sprints: round2(matchSprints),
        });
      });

      const avgSpeed = speedSamples.length
        ? round2(speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length)
        : 0;

      const totalActions = Object.values(actionCounts).reduce((a, b) => a + b, 0);
      const averageDistancePerMatch = matchesPlayed ? round2(totalDistance / matchesPlayed) : 0;
      const averageSprintsPerMatch = matchesPlayed ? round2(totalSprints / matchesPlayed) : 0;

      return {
        player: {
          _id: player._id,
          name: player.name,
          position: player.position,
          jerseyNumber: player.jerseyNumber,
          age: player.age,
          heightCm: player.heightCm,
          weightKg: player.weightKg,
          nationality: player.nationality,
          preferredFoot: player.preferredFoot,
          contractStatus: player.contractStatus,
          marketValue: player.marketValue,
          profileSummary: player.profileSummary,
          team: player.team,
        },
        matchesPlayed,
        totalDistanceCovered: round2(totalDistance),
        averageDistancePerMatch,
        averageSpeed: avgSpeed,
        totalSprints,
        averageSprintsPerMatch,
        actions: actionCounts,
        totalActions,
        verifiedTracks,
        matches,
        trendSeries: {
          distance: trendPoints.map((point) => ({ label: point.label, value: point.distance })),
          actions: trendPoints.map((point) => ({ label: point.label, value: point.actions })),
          sprints: trendPoints.map((point) => ({ label: point.label, value: point.sprints })),
        },
      };
    });

    const enrichedResults = results.map((result) => ({
      ...result,
      evaluation: buildComparisonEvaluation(result, results),
    }));

    res.json(enrichedResults);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPlayerProfile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid player id' });
    }

    const player = await Player.findById(id).populate('team');
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const analyses = await Analysis.find({ 'playerData.playerId': id }).populate(
      'video',
      'originalName createdAt status sport'
    );
    const summary = aggregatePlayerSummary(id, analyses);

    res.json({
      player: {
        _id: player._id,
        name: player.name,
        position: player.position,
        jerseyNumber: player.jerseyNumber,
        age: player.age,
        heightCm: player.heightCm,
        weightKg: player.weightKg,
        nationality: player.nationality,
        preferredFoot: player.preferredFoot,
        contractStatus: player.contractStatus,
        marketValue: player.marketValue,
        profileSummary: player.profileSummary,
        team: player.team,
        createdAt: player.createdAt,
        updatedAt: player.updatedAt,
      },
      summary,
      recentMatches: summary.matches.slice(0, 6),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function buildComparisonEvaluation(result, peers) {
  const maxDistance = Math.max(...peers.map((peer) => peer.averageDistancePerMatch || 0), 1);
  const maxActions = Math.max(...peers.map((peer) => peer.totalActions || 0), 1);
  const maxVerified = Math.max(...peers.map((peer) => peer.verifiedTracks || 0), 1);
  const maxSprints = Math.max(...peers.map((peer) => peer.averageSprintsPerMatch || 0), 1);

  const distanceScore = Math.min(
    100,
    Math.round(((result.averageDistancePerMatch || 0) / maxDistance) * 100)
  );
  const actionScore = Math.min(100, Math.round(((result.totalActions || 0) / maxActions) * 100));
  const reliabilityScore = Math.min(
    100,
    Math.round(((result.verifiedTracks || 0) / maxVerified) * 100)
  );
  const sprintScore = Math.min(
    100,
    Math.round(((result.averageSprintsPerMatch || 0) / maxSprints) * 100)
  );

  const scoutingScore = Math.round(
    distanceScore * 0.35 + actionScore * 0.35 + reliabilityScore * 0.2 + sprintScore * 0.1
  );

  const standoutSignal =
    result.totalActions >= maxActions * 0.8
      ? 'High action volume'
      : result.averageDistancePerMatch >= maxDistance * 0.8
      ? 'High workload profile'
      : result.verifiedTracks >= maxVerified * 0.8
      ? 'Strong match fidelity'
      : 'Balanced profile';

  const developmentFocus =
    result.verifiedTracks === 0
      ? 'Add more verified clips to sharpen the scouting confidence.'
      : result.totalActions < maxActions * 0.6
      ? 'Increase end-product volume in the next review window.'
      : 'Maintain current output and keep tracking the same match patterns.';

  const executiveSummary =
    result.matchesPlayed === 0
      ? 'No analyzed match data yet; this view will become more valuable as clips are verified.'
      : `${result.player.name} shows ${standoutSignal.toLowerCase()} and a ${scoutingScore >= 75 ? 'premium' : 'solid'} scouting score.`;

  return {
    scoutingScore,
    standoutSignal,
    developmentFocus,
    executiveSummary,
    recommendation: scoutingScore >= 80 ? 'Strong shortlist candidate' : scoutingScore >= 60 ? 'Promising profile' : 'Needs more data',
  };
}

function aggregatePlayerSummary(id, analyses) {
  let matchesPlayed = 0;
  let totalDistance = 0;
  let totalSprints = 0;
  const speedSamples = [];
  let verifiedTracks = 0;
  const actionCounts = { pass: 0, shot: 0, tackle: 0, interception: 0 };
  const matches = [];

  analyses.forEach((analysis) => {
    const tracks = analysis.playerData.filter((pd) => pd.playerId && String(pd.playerId) === id);
    if (tracks.length === 0) return;

    matchesPlayed += 1;
    const trackIds = new Set();
    let matchDistance = 0;

    tracks.forEach((track) => {
      matchDistance += track.statistics?.distanceCovered || 0;
      totalSprints += track.statistics?.sprintCount || 0;
      if (track.statistics?.averageSpeed) speedSamples.push(track.statistics.averageSpeed);
      if (track.verified) verifiedTracks += 1;
      if (track.trackId) trackIds.add(track.trackId);
    });

    totalDistance += matchDistance;

    let matchActionCount = 0;
    analysis.actions.forEach((action) => {
      if (action.playerId && trackIds.has(action.playerId) && actionCounts[action.type] !== undefined) {
        actionCounts[action.type] += 1;
        matchActionCount += 1;
      }
    });

    matches.push({
      analysisId: analysis._id,
      video: analysis.video
        ? {
            _id: analysis.video._id,
            originalName: analysis.video.originalName,
            createdAt: analysis.video.createdAt,
            status: analysis.video.status,
            sport: analysis.video.sport,
          }
        : null,
      distanceCovered: round2(matchDistance),
      actionCount: matchActionCount,
    });
  });

  const averageSpeed = speedSamples.length
    ? round2(speedSamples.reduce((sum, value) => sum + value, 0) / speedSamples.length)
    : 0;

  return {
    matchesPlayed,
    totalDistanceCovered: round2(totalDistance),
    averageDistancePerMatch: matchesPlayed ? round2(totalDistance / matchesPlayed) : 0,
    averageSpeed,
    totalSprints,
    averageSprintsPerMatch: matchesPlayed ? round2(totalSprints / matchesPlayed) : 0,
    actions: actionCounts,
    totalActions: Object.values(actionCounts).reduce((sum, value) => sum + value, 0),
    verifiedTracks,
    matches,
  };
}
