const express = require('express');
const { body, param } = require('express-validator');
const authController = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { loginLimiter, registerLimiter, forgotPasswordLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post(
  '/register',
  registerLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  validate,
  authController.register
);

router.post(
  '/login',
  loginLimiter,
  [
    body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  authController.login
);

router.get('/me', requireAuth, authController.me);

// Admin-only user management: list accounts and promote/demote roles.
// Needed because only the very first registered user is auto-promoted to
// admin (see authController.register) — every account after that needs an
// existing admin to grant elevated access.
router.get('/users', requireAuth, requireRole('admin'), authController.listUsers);
router.patch(
  '/users/:id/role',
  requireAuth,
  requireRole('admin'),
  [
    param('id').isMongoId().withMessage('Invalid user id'),
    body('role')
      .isIn(['admin', 'scout', 'team', 'player'])
      .withMessage('role must be one of "admin", "scout", "team", or "player"'),
  ],
  validate,
  authController.setUserRole
);

// Email verification. Registration already sends a verify email; these
// let the user complete it or ask for a new link if the first expired.
router.post(
  '/verify-email',
  [body('token').trim().notEmpty().withMessage('token is required')],
  validate,
  authController.verifyEmail
);
router.post('/resend-verification', requireAuth, authController.resendVerification);

// Password reset. forgot-password always returns 200 (see controller) to
// avoid leaking which emails are registered.
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  [body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail()],
  validate,
  authController.forgotPassword
);
router.post(
  '/reset-password',
  [
    body('token').trim().notEmpty().withMessage('token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  authController.resetPassword
);

module.exports = router;
