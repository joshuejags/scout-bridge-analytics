const mongoose = require('mongoose');
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');
const Player = require('../models/Player');

exports.processAnalysis = async (req, res) => {
  let video;
  try {
    const { videoId } = req.params;
    video = await Video.findById(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.status === 'processing') {
      const existingAnalysis = await Analysis.findOne({ video: video._id });
      if (existingAnalysis) {
        video.status = 'analyzed';
        video.analysis = existingAnalysis._id;
        await video.save();
        return res.status(200).json(existingAnalysis);
      }
      // stale processing state: allow retry
    }

    if (video.status === 'analyzed') {
      const existingAnalysis = await Analysis.findOne({ video: video._id });
      if (existingAnalysis) {
        return res.status(200).json(existingAnalysis);
      }
      // If status is analyzed but analysis is missing, fall through and reprocess.
    }

    video.status = 'processing';
    await video.save();

    const player = await Player.findOne() || null;
    const playerRef = player ? player._id : null;

    const analysis = new Analysis({
      video: video._id,
      playerData: [
        {
          playerId: playerRef,
          trackingData: [
            {
              frameNumber: 1,
              position: { x: 120, y: 200 },
              confidence: 0.98,
              pose: {},
            },
          ],
          statistics: {
            distanceCovered: 4200,
            averageSpeed: 5.1,
            sprintCount: 8,
            activationArea: 'Midfield',
          },
        },
      ],
      ballData: {
        trackingData: [
          {
            frameNumber: 1,
            position: { x: 320, y: 180 },
            confidence: 0.93,
          },
        ],
        possessionStats: [
          {
            playerId: playerRef,
            duration: 38,
            startFrame: 1,
            endFrame: 120,
          },
        ],
      },
      actions: [
        {
          type: 'pass',
          playerId: playerRef,
          frameNumber: 24,
          confidence: 0.85,
        },
        {
          type: 'shot',
          playerId: playerRef,
          frameNumber: 120,
          confidence: 0.74,
        },
      ],
      heatmapData: {
        grid: [
          [0, 2, 5],
          [1, 3, 4],
          [0, 1, 2],
        ],
        cellSize: 50,
      },
      summary: {
        totalPlayers: 11,
        matchDuration: 1200,
        highlightedMoments: [
          {
            frameNumber: 24,
            type: 'pass',
            description: 'Key pass from the right wing',
          },
          {
            frameNumber: 120,
            type: 'shot',
            description: 'Dangerous shot on target',
          },
        ],
      },
    });

    await analysis.save();
    video.analysis = analysis._id;
    video.status = 'analyzed';
    await video.save();

    return res.status(201).json(analysis);
  } catch (error) {
    if (video) {
      video.status = 'failed';
      await video.save();
    }
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
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
