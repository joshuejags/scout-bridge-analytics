const Team = require('../models/Team');

exports.createTeam = async (req, res) => {
  try {
    const team = new Team(req.body);
    await team.save();
    res.status(201).json(team);
  } catch (error) {
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
    const team = await Team.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (error) {
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
