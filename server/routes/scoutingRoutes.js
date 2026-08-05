const express = require('express');
const { body, param } = require('express-validator');
const scoutingController = require('../controllers/scoutingController');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const targetRoles = requireRole('admin', 'scout');
const targetIdParam = param('id').isMongoId().withMessage('Invalid scouting target id');
const targetBody = [
  body('playerId').optional().isMongoId().withMessage('Invalid player id'),
  body('stage')
    .optional()
    .isIn(['discovery', 'watchlist', 'shortlist', 'live', 'decision'])
    .withMessage('Invalid recruitment stage'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid recruitment priority'),
  body('fitScore')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 100 })
    .withMessage('Fit score must be between 0 and 100'),
  body('note').optional().trim(),
  body('nextAction').optional().trim(),
  body('dueDate').optional({ values: 'falsy' }).isISO8601().withMessage('Due date must be a valid date'),
];

router.get('/board', targetRoles, scoutingController.getBoard);
router.post('/targets', targetRoles, [body('playerId').isMongoId().withMessage('Invalid player id'), ...targetBody], validate, scoutingController.upsertTarget);
router.patch('/targets/:id', targetRoles, [targetIdParam, ...targetBody], validate, scoutingController.updateTarget);
router.delete('/targets/:id', targetRoles, [targetIdParam], validate, scoutingController.deleteTarget);

module.exports = router;
