require('./setup');
const request = require('supertest');
const app = require('../app');
const Team = require('../models/Team');
const Player = require('../models/Player');
const User = require('../models/User');

const register = async (name, email) =>
  (
    await request(app).post('/api/auth/register').send({
      name,
      email,
      password: 'password123',
    })
  ).body;

describe('Scouting routes', () => {
  it('creates a scouting target and returns board summary data', async () => {
    const { token } = await register('Scout Lead', 'scout-board@example.com');
    const team = await Team.create({ name: 'Rivers United' });
    const player = await Player.create({ name: 'Tobi Winger', team: team._id, position: 'Winger', jerseyNumber: 11 });

    await request(app)
      .post('/api/scouting/targets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        playerId: player._id.toString(),
        stage: 'watchlist',
        priority: 'high',
        fitScore: 82,
        note: 'Explosive in transition and attacks the weak-side fullback well.',
        nextAction: 'Schedule live view during weekend fixture.',
        dueDate: '2099-02-01',
      })
      .expect(201);

    const board = await request(app)
      .get('/api/scouting/board')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(board.body.summary.totalTargets).toBe(1);
    expect(board.body.summary.highPriority).toBe(1);
    expect(board.body.summary.byStage.watchlist).toBe(1);
    expect(board.body.targets[0].player.name).toBe('Tobi Winger');
    expect(board.body.targets[0].player.team.name).toBe('Rivers United');
  });

  it('updates an existing target for the same scout instead of creating duplicates', async () => {
    const { token } = await register('Scout Update', 'scout-update@example.com');
    const player = await Player.create({ name: 'Sam Playmaker', position: 'Midfielder' });

    const first = await request(app)
      .post('/api/scouting/targets')
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: player._id.toString(), stage: 'discovery', priority: 'medium', fitScore: 70 })
      .expect(201);

    const second = await request(app)
      .post('/api/scouting/targets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        playerId: player._id.toString(),
        stage: 'shortlist',
        priority: 'high',
        fitScore: 88,
        note: 'Ready for shortlist review.',
      })
      .expect(201);

    expect(second.body._id).toBe(first.body._id);

    const board = await request(app)
      .get('/api/scouting/board')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(board.body.targets).toHaveLength(1);
    expect(board.body.targets[0].stage).toBe('shortlist');
    expect(board.body.targets[0].priority).toBe('high');
  });

  it('blocks non-scout roles from using scouting workflows', async () => {
    const admin = await register('Admin One', 'admin-scouting@example.com');
    const playerAccount = await register('Player User', 'player-scouting@example.com');
    await request(app)
      .patch(`/api/auth/users/${playerAccount.user._id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'player' })
      .expect(200);

    const playerUser = await User.findById(playerAccount.user._id);

    await request(app)
      .get('/api/scouting/board')
      .set('Authorization', `Bearer ${playerAccount.token}`)
      .expect(403);

    expect(playerUser.role).toBe('player');
  });
});
