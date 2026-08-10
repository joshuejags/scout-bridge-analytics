const Video = require('../models/Video');
const User = require('../models/User');
const Team = require('../models/Team');
const Player = require('../models/Player');

async function getSummary(req, res) {
  const [totalUsers, totalTeams, totalPlayers, totalVideos, analyzedVideos, processingVideos, failedVideos, queuedVideos, pendingVerification, recentUsers, recentVideos, adminUsers, scoutUsers, teamUsers, playerUsers] =
    await Promise.all([
      User.countDocuments(),
      Team.countDocuments(),
      Player.countDocuments(),
      Video.countDocuments(),
      Video.countDocuments({ status: 'analyzed' }),
      Video.countDocuments({ status: 'processing' }),
      Video.countDocuments({ status: 'failed' }),
      Video.countDocuments({ status: 'queued' }),
      User.countDocuments({ emailVerified: false }),
      User.find().sort({ createdAt: -1 }).limit(5).select('name email role emailVerified createdAt'),
      Video.find()
        .sort({ updatedAt: -1 })
        .limit(6)
        .select('originalName status uploadedBy createdAt updatedAt lastError'),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'scout' }),
      User.countDocuments({ role: 'team' }),
      User.countDocuments({ role: 'player' }),
    ]);

  res.json({
    users: {
      total: totalUsers,
      pendingVerification,
      byRole: {
        admin: adminUsers,
        scout: scoutUsers,
        team: teamUsers,
        player: playerUsers,
      },
      recent: recentUsers,
    },
    content: {
      teams: totalTeams,
      players: totalPlayers,
      videos: totalVideos,
    },
    jobs: {
      analyzed: analyzedVideos,
      processing: processingVideos,
      failed: failedVideos,
      queued: queuedVideos,
    },
    recentVideos,
  });
}

async function listJobs(req, res) {
  const state = req.query.state;
  const allowed = ['queued', 'processing', 'failed', 'analyzed'];
  if (state && !allowed.includes(state)) {
    return res.status(400).json({ error: 'Invalid state' });
  }
  const filter = state ? { status: state } : {};
  const videos = await Video.find(filter)
    .sort({ updatedAt: -1 })
    .limit(200)
    .select('originalName status lastError owner metadata createdAt updatedAt');
  res.json({ items: videos });
}

async function retryJob(req, res) {
  const id = req.params.id;
  const video = await Video.findById(id);
  if (!video) return res.status(404).json({ error: 'Not found' });
  if (video.status === 'processing') {
    return res.status(409).json({ error: 'Job is currently processing' });
  }
  video.status = 'queued';
  video.lastError = null;
  await video.save();
  // The analysis daemon will pick this up automatically.
  res.json({ ok: true, id: video._id });
}

module.exports = { getSummary, listJobs, retryJob };
