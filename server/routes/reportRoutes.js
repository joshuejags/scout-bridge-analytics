const express = require('express');
const { body, param } = require('express-validator');
const reportController = require('../controllers/reportController');
const validate = require('../middleware/validate');

const router = express.Router();

router.get('/saved', reportController.listSavedReports);
router.post(
  '/saved',
  [
    body('videoId').isMongoId().withMessage('Invalid video id'),
    body('template').optional().isIn(['scout-summary', 'recruitment-decision', 'player-development']),
    body('title').optional().trim(),
    body('summary').optional().trim(),
    body('tags').optional(),
  ],
  validate,
  reportController.saveReport
);
router.patch(
  '/saved/:id',
  [
    param('id').isMongoId().withMessage('Invalid saved report id'),
    body('template').optional().isIn(['scout-summary', 'recruitment-decision', 'player-development']),
    body('title').optional().trim(),
    body('summary').optional().trim(),
    body('tags').optional(),
  ],
  validate,
  reportController.updateSavedReport
);
router.get('/saved/:id/export', [param('id').isMongoId().withMessage('Invalid saved report id')], validate, reportController.exportSavedReport);
router.delete('/saved/:id', [param('id').isMongoId().withMessage('Invalid saved report id')], validate, reportController.deleteSavedReport);

module.exports = router;
