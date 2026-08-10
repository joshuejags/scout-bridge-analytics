require('./setup');
const request = require('supertest');
const app = require('../app');
const Team = require('../models/Team');
const Player = require('../models/Player');
const Video = require('../models/Video');

const register = async (email) =>
  (
    await request(app).post('/api/auth/register').send({
      name: 'Team Manager',
      email,
      password: 'password123',
    })
  ).body;

describe('Teams overview', () => {
  it('returns team hub summary data', async () => {
    const { token } = await register('team-overview@example.com');
    const [homeTeam, awayTeam] = await Team.create([
      { name: 'Blue FC', description: 'Possession-heavy first team.' },
      { name: 'Gold FC', description: 'Transition-focused opponent.' },
    ]);

    await Player.create([
      { name: 'Captain Blue', team: homeTeam._id, position: 'Midfielder' },
      { name: 'Finisher Blue', team: homeTeam._id, position: 'Forward' },
    ]);

    await Video.create({
      originalName: 'blue-vs-gold.mp4',
      filename: 'blue-vs-gold.mp4',
      fileSize: 10,
      filePath: 'blue-vs-gold.mp4',
      status: 'analyzed',
      team: homeTeam._id,
      opponentTeam: awayTeam._id,
    });

    const res = await request(app)
      .get('/api/teams/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.summary.totalTeams).toBe(2);
    expect(res.body.summary.totalPlayers).toBe(2);
    expect(res.body.summary.analyzedVideos).toBe(1);
    expect(res.body.topTeams[0].name).toBe('Blue FC');
    expect(res.body.topTeams[0].rosterCount).toBe(2);
    expect(res.body.recentMatches[0].team.name).toBe('Blue FC');
  });
});
