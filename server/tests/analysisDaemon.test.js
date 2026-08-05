const mongoose = require('mongoose');
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');

// Ensure test setup loads env and connects (see tests/setup.js)
require('./setup');

jest.mock('../utils/analysisWorkerPool');
const workerPool = require('../utils/analysisWorkerPool');

const { processNextJob } = require('../scripts/analysisDaemon');

describe('analysis daemon', () => {
  it('claims a queued video, runs workerPool and persists analysis', async () => {
    // Create a queued video
    const v = await Video.create({ filename: 'test.mp4', originalName: 'test.mp4', fileSize: 100, filePath: 'uploads/test.mp4', status: 'queued' });

    // Mock workerPool to return a simple result
    workerPool.submitJob.mockResolvedValue({ playerData: [], ballData: {}, actions: [], heatmapData: {}, tacticalData: {}, summary: {} });

    const res = await processNextJob();
    expect(res).toBeDefined();
    const fresh = await Video.findById(v._id);
    expect(fresh.status).toBe('analyzed');
    const analysis = await Analysis.findOne({ video: v._id });
    expect(analysis).toBeTruthy();
  });
});
