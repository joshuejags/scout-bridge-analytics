const Video = require('../models/Video');
const Analysis = require('../models/Analysis');

exports.processAnalysis = async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await Video.findById(videoId);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.status === 'processing') {
      const existingAnalysis = await Analysis.findOne({ video: video._id });
      if (existingAnalysis) {
        video.status = 'analyzed';
        await video.save();
        return res.status(400).json({ error: 'Video has already been analyzed' });
      }
      // stale processing state: allow retry
    }

    if (video.status === 'analyzed') {
      return res.status(400).json({ error: 'Video has already been analyzed' });
    }

    video.status = 'processing';
    await video.save();

    const analysis = new Analysis({
      video: video._id,
      playerData: [
        {
          playerId: 'player-1',
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
            playerId: 'player-1',
            duration: 38,
            startFrame: 1,
            endFrame: 120,
          },
        ],
      },
      actions: [
        {
          type: 'pass',
          playerId: 'player-1',
          frameNumber: 24,
          confidence: 0.85,
        },
        {
          type: 'shot',
          playerId: 'player-1',
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
    video.status = 'failed';
    await video.save();
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

exports.getAnalysisByVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const analysis = await Analysis.findOne({ video: videoId }).populate('video');

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json(analysis);
  } catch (error) {
    console.error(error);    video.status = 'failed';
    await video.save();    res.status(500).json({ error: error.message });
  }
};
