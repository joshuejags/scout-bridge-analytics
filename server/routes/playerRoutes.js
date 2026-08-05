const express = require('express');
const { body, param } = require('express-validator');
const playerController = require('../controllers/playerController');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const idParam = param('id').isMongoId().withMessage('Invalid player id');
const createBody = [
  body('name').trim().notEmpty().withMessage('Player name is required'),
  body('team').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid team id'),
  body('position').optional().trim(),
  body('jerseyNumber')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 99 })
    .withMessage('Jersey number must be between 0 and 99'),
];
const updateBody = [
  body('name').optional().trim().notEmpty().withMessage('Player name cannot be empty'),
  body('team').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid team id'),
  body('position').optional().trim(),
  body('jerseyNumber')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 99 })
    .withMessage('Jersey number must be between 0 and 99'),
];

router.post('/', createBody, validate, playerController.createPlayer);
router.get('/', playerController.getPlayers);
// Must come before /:id — otherwise Express would try to match "compare"
// itself as a player id and fail the isMongoId validation.
router.get('/overview', playerController.getPlayerOverview);
router.get('/compare', playerController.comparePlayers);
router.get('/:id/profile', [idParam], validate, playerController.getPlayerProfile);
router.get('/:id', [idParam], validate, playerController.getPlayerById);
router.put('/:id', [idParam, ...updateBody], validate, playerController.updatePlayer);
router.delete('/:id', requireRole('admin'), [idParam], validate, playerController.deletePlayer);

module.exports = router;
