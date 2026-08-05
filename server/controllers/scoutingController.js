const Player = require('../models/Player');
const ScoutingTarget = require('../models/ScoutingTarget');
const { friendlyMongooseError } = require('../utils/mongooseErrors');

const BOARD_POPULATE = {
  path: 'player',
  populate: {
    path: 'team',
    select: 'name',
  },
};

const STAGE_ORDER = ['discovery', 'watchlist', 'shortlist', 'live', 'decision'];

const getOwnerFilter = (user) => (user.role === 'admin' ? {} : { owner: user._id });

exports.getBoard = async (req, res) => {
  try {
    const ownerFilter = getOwnerFilter(req.user);
    const [targets, players] = await Promise.all([
      ScoutingTarget.find(ownerFilter).populate(BOARD_POPULATE).populate('owner', 'name role').sort({ updatedAt: -1 }),
      Player.find().populate('team').sort({ createdAt: -1 }).limit(24),
    ]);

    const targetedPlayerIds = new Set(targets.map((target) => String(target.player?._id)).filter(Boolean));
    const availablePlayers = players
      .filter((player) => !targetedPlayerIds.has(String(player._id)))
      .slice(0, 8);

    const summary = {
      totalTargets: targets.length,
      highPriority: targets.filter((target) => target.priority === 'high').length,
      activeDecisions: targets.filter((target) => target.stage === 'live' || target.stage === 'decision').length,
      dueThisWeek: targets.filter((target) => isDueThisWeek(target.dueDate)).length,
      byStage: STAGE_ORDER.reduce((acc, stage) => {
        acc[stage] = targets.filter((target) => target.stage === stage).length;
        return acc;
      }, {}),
    };

    res.json({
      summary,
      stages: STAGE_ORDER,
      targets,
      availablePlayers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.upsertTarget = async (req, res) => {
  try {
    const player = await Player.findById(req.body.playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const target = await ScoutingTarget.findOneAndUpdate(
      {
        owner: req.user._id,
        player: req.body.playerId,
      },
      {
        owner: req.user._id,
        player: req.body.playerId,
        stage: req.body.stage,
        priority: req.body.priority,
        fitScore: req.body.fitScore,
        note: req.body.note,
        nextAction: req.body.nextAction,
        dueDate: req.body.dueDate || null,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    )
      .populate(BOARD_POPULATE)
      .populate('owner', 'name role');

    res.status(201).json(target);
  } catch (error) {
    const message = friendlyMongooseError(error);
    if (message) return res.status(400).json({ error: message });
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateTarget = async (req, res) => {
  try {
    const filter =
      req.user.role === 'admin'
        ? { _id: req.params.id }
        : {
            _id: req.params.id,
            owner: req.user._id,
          };

    const target = await ScoutingTarget.findOneAndUpdate(
      filter,
      {
        stage: req.body.stage,
        priority: req.body.priority,
        fitScore: req.body.fitScore,
        note: req.body.note,
        nextAction: req.body.nextAction,
        dueDate: req.body.dueDate || null,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate(BOARD_POPULATE)
      .populate('owner', 'name role');

    if (!target) {
      return res.status(404).json({ error: 'Scouting target not found' });
    }

    res.json(target);
  } catch (error) {
    const message = friendlyMongooseError(error);
    if (message) return res.status(400).json({ error: message });
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteTarget = async (req, res) => {
  try {
    const filter =
      req.user.role === 'admin'
        ? { _id: req.params.id }
        : {
            _id: req.params.id,
            owner: req.user._id,
          };

    const target = await ScoutingTarget.findOneAndDelete(filter);
    if (!target) {
      return res.status(404).json({ error: 'Scouting target not found' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

function isDueThisWeek(value) {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;

  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);
  return due >= now && due <= sevenDaysFromNow;
}
