require('./setup');
const request = require('supertest');
const app = require('../app');
const Video = require('../models/Video');
const Analysis = require('../models/Analysis');

const register = async (email) =>
  (
    await request(app).post('/api/auth/register').send({
      name: 'Report Scout',
      email,
      password: 'password123',
    })
  ).body;

describe('Saved reports', () => {
  it('saves and lists a saved scouting report', async () => {
    const { token } = await register('reports@example.com');
    const video = await Video.create({
      filename: 'report-video.mp4',
      originalName: 'report-video.mp4',
      fileSize: 100,
      filePath: 'report-video.mp4',
      status: 'analyzed',
      sport: 'soccer',
    });

    await Analysis.create({
      video: video._id,
      summary: { totalPlayers: 8, matchDuration: 92 },
      playerData: [
        {
          trackId: '10',
          verified: true,
          statistics: { distanceCovered: 1600, averageSpeed: 5.2, sprintCount: 3, activationArea: 'Center' },
        },
      ],
      actions: [{ type: 'shot', playerId: '10', frameNumber: 12, confidence: 0.9 }],
      heatmapData: { grid: [] },
    });

    const saved = await request(app)
      .post('/api/reports/saved')
      .set('Authorization', `Bearer ${token}`)
      .send({
        videoId: video._id.toString(),
        template: 'recruitment-decision',
        title: 'Weekend scouting report',
        summary: 'High-energy profile with repeat final-third actions.',
        tags: ['weekend', 'priority'],
      })
      .expect(201);

    expect(saved.body.title).toBe('Weekend scouting report');
    expect(saved.body.template).toBe('recruitment-decision');
    expect(saved.body.tags).toEqual(['weekend', 'priority']);
    expect(saved.body.insightSnapshot.recommendation.label).toBeTruthy();
    expect(saved.body.insightSnapshot.eventBreakdown).toEqual([{ type: 'shot', count: 1 }]);

    const list = await request(app)
      .get('/api/reports/saved')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0].video.originalName).toBe('report-video.mp4');
    expect(list.body[0].insightSnapshot.metrics.totalActions).toBe(1);
  });

  it('exports a saved report as markdown', async () => {
    const { token } = await register('reports-export@example.com');
    const video = await Video.create({
      filename: 'export-video.mp4',
      originalName: 'export-video.mp4',
      fileSize: 100,
      filePath: 'export-video.mp4',
      status: 'analyzed',
      sport: 'soccer',
    });

    await Analysis.create({
      video: video._id,
      summary: { totalPlayers: 10, matchDuration: 96 },
      playerData: [],
      actions: [{ type: 'pass', playerId: '12', frameNumber: 8, confidence: 0.9 }],
      heatmapData: { grid: [] },
    });

    const saved = await request(app)
      .post('/api/reports/saved')
      .set('Authorization', `Bearer ${token}`)
      .send({
        videoId: video._id.toString(),
        template: 'player-development',
        title: 'Development report',
      })
      .expect(201);

    const exportRes = await request(app)
      .get(`/api/reports/saved/${saved.body._id}/export`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(exportRes.text).toContain('# Development report');
    expect(exportRes.text).toContain('**Template:** Player Development');
    expect(exportRes.text).toContain('## Training Priorities');
    expect(exportRes.text).toContain('## Standout Profiles');
  });
});
