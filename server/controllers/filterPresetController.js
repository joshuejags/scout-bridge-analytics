const SavedFilterPreset = require('../models/SavedFilterPreset');

exports.listFilterPresets = async (req, res, next) => {
  try {
    const { scope } = req.query;
    const query = { owner: req.user._id };

    if (scope) {
      query.scope = scope;
    }

    const presets = await SavedFilterPreset.find(query).sort({ updatedAt: -1 });
    res.json(presets);
  } catch (error) {
    next(error);
  }
};

exports.createFilterPreset = async (req, res, next) => {
  try {
    const preset = await SavedFilterPreset.create({
      owner: req.user._id,
      name: req.body.name.trim(),
      scope: req.body.scope,
      filters: req.body.filters || {},
      isDefault: Boolean(req.body.isDefault),
    });

    res.status(201).json(preset);
  } catch (error) {
    next(error);
  }
};

exports.updateFilterPreset = async (req, res, next) => {
  try {
    const preset = await SavedFilterPreset.findOne({ _id: req.params.id, owner: req.user._id });
    if (!preset) {
      return res.status(404).json({ error: 'Filter preset not found.' });
    }

    if (req.body.name !== undefined) {
      preset.name = req.body.name.trim();
    }
    if (req.body.scope !== undefined) {
      preset.scope = req.body.scope;
    }
    if (req.body.filters !== undefined) {
      preset.filters = req.body.filters;
    }
    if (req.body.isDefault !== undefined) {
      preset.isDefault = Boolean(req.body.isDefault);
    }

    await preset.save();
    res.json(preset);
  } catch (error) {
    next(error);
  }
};

exports.deleteFilterPreset = async (req, res, next) => {
  try {
    const deleted = await SavedFilterPreset.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!deleted) {
      return res.status(404).json({ error: 'Filter preset not found.' });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
