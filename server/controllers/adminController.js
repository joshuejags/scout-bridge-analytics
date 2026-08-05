const Video = require('../models/Video');

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

module.exports = { listJobs, retryJob };
