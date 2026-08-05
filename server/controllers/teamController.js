const Team = require('../models/Team');
const Player = require('../models/Player');
const Video = require('../models/Video');
const { friendlyMongooseError } = require('../utils/mongooseErrors');
const { pick } = require('../utils/pick');

const TEAM_FIELDS = ['name', 'description'];

exports.createTeam = async (req, res) => {
  try {
    const team = new Team(pick(req.body, TEAM_FIELDS));
    await team.save();
    res.status(201).json(team);
  } catch (error) {
    const message = friendlyMongooseError(error);
    if (message) return res.status(400).json({ error: message });
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.find();
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTeamOverview = async (req, res) => {
  try {
    const [teams, players, videos, totalVideos, analyzedVideos] = await Promise.all([
      Team.find().sort({ name: 1 }),
      Player.find().select('team'),
      Video.find()
        .populate('team', 'name')
        .populate('opponentTeam', 'name')
        .sort({ createdAt: -1 })
        .limit(24),
      Video.countDocuments(),
      Video.countDocuments({ status: 'analyzed' }),
    ]);

    const rosterCounts = players.reduce((acc, player) => {
      const key = player.team ? String(player.team) : null;
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const videoStats = videos.reduce(
      (acc, video) => {
        if (video.team) {
          const key = String(video.team._id);
          acc.byTeam[key] = acc.byTeam[key] || { owned: 0, opponent: 0, lastVideo: null };
          acc.byTeam[key].owned += 1;
          acc.byTeam[key].lastVideo = acc.byTeam[key].lastVideo || video;
        }
        if (video.opponentTeam) {
          const key = String(video.opponentTeam._id);
          acc.byTeam[key] = acc.byTeam[key] || { owned: 0, opponent: 0, lastVideo: null };
          acc.byTeam[key].opponent += 1;
          acc.byTeam[key].lastVideo = acc.byTeam[key].lastVideo || video;
        }
        return acc;
      },
      { byTeam: {} }
    );

    const topTeams = teams
      .map((team) => {
        const stats = videoStats.byTeam[String(team._id)] || { owned: 0, opponent: 0, lastVideo: null };
        return {
          _id: team._id,
          name: team.name,
          description: team.description,
          rosterCount: rosterCounts[String(team._id)] || 0,
          ownedVideoCount: stats.owned,
          opponentVideoCount: stats.opponent,
          lastVideo: stats.lastVideo
            ? {
                _id: stats.lastVideo._id,
                originalName: stats.lastVideo.originalName,
                status: stats.lastVideo.status,
                createdAt: stats.lastVideo.createdAt,
              }
            : null,
        };
      })
      .sort((a, b) => {
        const scoreA = a.rosterCount * 3 + a.ownedVideoCount + a.opponentVideoCount;
        const scoreB = b.rosterCount * 3 + b.ownedVideoCount + b.opponentVideoCount;
        return scoreB - scoreA;
      })
      .slice(0, 6);

    res.json({
      summary: {
        totalTeams: teams.length,
        totalPlayers: players.length,
        totalVideos,
        analyzedVideos,
        teamsWithVideoContext: Object.keys(videoStats.byTeam).length,
      },
      topTeams,
      recentMatches: videos.slice(0, 6).map((video) => ({
        _id: video._id,
        originalName: video.originalName,
        status: video.status,
        createdAt: video.createdAt,
        team: video.team,
        opponentTeam: video.opponentTeam,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(req.params.id, pick(req.body, TEAM_FIELDS), {
      new: true,
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (error) {
    const message = friendlyMongooseError(error);
    if (message) return res.status(400).json({ error: message });
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json({ message: 'Team deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
