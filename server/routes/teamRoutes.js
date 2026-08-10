const express = require('express');
const { body, param } = require('express-validator');
const teamController = require('../controllers/teamController');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const idParam = param('id').isMongoId().withMessage('Invalid team id');
const nameBody = body('name').trim().notEmpty().withMessage('Team name is required');

router.post('/', [nameBody], validate, teamController.createTeam);
router.get('/', teamController.getTeams);
router.get('/overview', teamController.getTeamOverview);
router.get('/:id', [idParam], validate, teamController.getTeamById);
router.put(
  '/:id',
  [idParam, body('name').optional().trim().notEmpty().withMessage('Team name cannot be empty')],
  validate,
  teamController.updateTeam
);
// Deleting a team cascades into every player/video that references it, so
// it's restricted to admins rather than any authenticated scout.
router.delete('/:id', requireRole('admin'), [idParam], validate, teamController.deleteTeam);

module.exports = router;
