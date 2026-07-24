const Video = require('../models/Video');
const { isOwnerOrAdmin } = require('../controllers/videoController');

/**
 * requireAuth alone only proves *a* valid session exists — it doesn't
 * check that the session's user actually owns the specific video or
 * thumbnail being requested. Video URLs are handed back directly in
 * GET /api/videos responses, so they're not meaningfully unguessable
 * either; without this, any signed-in user could fetch any other user's
 * video just by knowing (or listing) its URL. Resolves the requested path
 * back to its owning Video and checks ownership before falling through to
 * static file serving.
 *
 * Mounted at /uploads, so req.path here is relative to that — either
 * "/<filename>" (a video file) or "/thumbnails/<videoId>/<trackId>.jpg".
 */
const authorizeUploadAccess = async (req, res, next) => {
  try {
    const segments = req.path.replace(/^\/+/, '').split('/');

    let video = null;
    if (segments[0] === 'thumbnails' && segments[1]) {
      video = await Video.findById(segments[1]).catch(() => null);
    } else if (segments[0]) {
      video = await Video.findOne({ filename: segments[0] });
    }

    if (!video || !isOwnerOrAdmin(video, req.user)) {
      return res.status(404).end();
    }
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = authorizeUploadAccess;
