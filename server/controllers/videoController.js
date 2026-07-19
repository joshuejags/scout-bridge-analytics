const Video = require('../models/Video');
const fs = require('fs');
const path = require('path');

// Upload video file
exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const players = Array.isArray(req.body.players)
      ? req.body.players
      : req.body.players
      ? [req.body.players]
      : [];

    const video = new Video({
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      filePath: req.file.path,
      uploadedBy: req.body.uploadedBy || 'anonymous',
      status: 'uploaded',
      team: req.body.team || null,
      opponentTeam: req.body.opponentTeam || null,
      players,
    });

    await video.save();
    res.status(201).json(video);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all videos
exports.getVideos = async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const videos = await Video.find()
      .populate('analysis')
      .populate('team')
      .populate('opponentTeam')
      .populate('players');
    const response = videos.map((video) => ({
      ...video.toObject(),
      url: `${baseUrl}/uploads/${video.filename}`,
    }));
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get video by ID
exports.getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('analysis')
      .populate('team')
      .populate('opponentTeam')
      .populate('players');
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete video
exports.deleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Delete file from storage
    if (fs.existsSync(video.filePath)) {
      fs.unlinkSync(video.filePath);
    }

    await Video.findByIdAndDelete(req.params.id);
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
