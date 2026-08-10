const express = require('express');
const { body, param } = require('express-validator');
const filterPresetController = require('../controllers/filterPresetController');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/', filterPresetController.listFilterPresets);
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Preset name is required'),
    body('scope').isIn(['players', 'reports', 'scouting']).withMessage('Invalid preset scope'),
    body('filters').optional().isObject().withMessage('Filters must be an object'),
  ],
  validate,
  filterPresetController.createFilterPreset
);
router.patch(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid preset id'),
    body('name').optional().trim().notEmpty().withMessage('Preset name is required'),
    body('scope').optional().isIn(['players', 'reports', 'scouting']).withMessage('Invalid preset scope'),
    body('filters').optional().isObject().withMessage('Filters must be an object'),
  ],
  validate,
  filterPresetController.updateFilterPreset
);
router.delete('/:id', [param('id').isMongoId().withMessage('Invalid preset id')], validate, filterPresetController.deleteFilterPreset);

module.exports = router;
