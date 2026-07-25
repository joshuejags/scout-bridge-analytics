const Team = require('../models/Team');
const { friendlyMongooseError } = require('../utils/mongooseErrors');
const { pick } = require('../utils/pick');

const TEAM_FIELDS = ['name', 'description'];

exports.createTeam = async (req, res) => {
  try {
    const team = new Team(pick(req.body, TEAM_FIELDS));
    await team.save();
    res.status(201).json(team);
  } catch (error) {
    const message = friendlyMongooseError(error);
    if (message) return res.status(400).json({ error: message });
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.find();
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const team = await Team.findByIdAndUpdate(req.params.id, pick(req.body, TEAM_FIELDS), {
      new: true,
    });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (error) {
    const message = friendlyMongooseError(error);
    if (message) return res.status(400).json({ error: message });
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json({ message: 'Team deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
