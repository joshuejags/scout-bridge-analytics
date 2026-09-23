const express = require('express');
const { param, query } = require('express-validator');
const adminController = require('../controllers/adminController');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', requireRole('admin'), adminController.getSummary);

router.get(
  '/dead-letter-jobs',
  requireRole('admin'),
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).toInt().withMessage('Offset must be a non-negative integer'),
  ],
  validate,
  adminController.listDeadLetterJobs
);

router.get(
  '/jobs',
  requireRole('admin'),
  [query('state').optional().isIn(['queued', 'processing', 'failed', 'analyzed']).withMessage('Invalid state')],
  validate,
  adminController.listJobs
);

router.post(
  '/jobs/:id/retry',
  requireRole('admin'),
  [param('id').isMongoId().withMessage('Invalid id')],
  validate,
  adminController.retryJob
);

module.exports = router;
