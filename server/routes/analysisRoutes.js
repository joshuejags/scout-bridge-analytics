const express = require('express');
const { body, param } = require('express-validator');
const analysisController = require('../controllers/analysisController');
const validate = require('../middleware/validate');
const { analysisLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post(
  '/:videoId/process',
  analysisLimiter,
  [param('videoId').isMongoId().withMessage('Invalid video id')],
  validate,
  analysisController.processAnalysis
);
router.get(
  '/:videoId',
  [param('videoId').isMongoId().withMessage('Invalid video id')],
  validate,
  analysisController.getAnalysisByVideo
);

// Manual player-identity correction (jersey OCR only identifies a small
// fraction of tracks on typical footage; these let a human fill the gap).
router.patch(
  '/:analysisId/tracks/:trackId',
  [
    param('analysisId').isMongoId().withMessage('Invalid analysis id'),
    param('trackId').trim().notEmpty().withMessage('trackId is required'),
    body('jerseyNumber')
      .optional({ values: 'null' })
      .isInt({ min: 0, max: 99 })
      .withMessage('Jersey number must be between 0 and 99'),
    body('playerId').optional({ values: 'null' }).isMongoId().withMessage('Invalid player id'),
    body('teamColor').optional({ values: 'null' }).trim(),
  ],
  validate,
  analysisController.updatePlayerTrack
);
router.post(
  '/:analysisId/tracks/merge',
  [
    param('analysisId').isMongoId().withMessage('Invalid analysis id'),
    body('sourceTrackId').trim().notEmpty().withMessage('sourceTrackId is required'),
    body('targetTrackId').trim().notEmpty().withMessage('targetTrackId is required'),
  ],
  validate,
  analysisController.mergePlayerTracks
);

module.exports = router;
