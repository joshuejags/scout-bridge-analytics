const express = require('express');
const { authenticate } = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');

const router = express.Router();

// All subscription routes require authentication
router.use(authenticate);

/**
 * GET /api/subscription - Get current subscription
 */
router.get('/', subscriptionController.getSubscription);

/**
 * GET /api/subscription/plans - Get available plans
 */
router.get('/plans', subscriptionController.getPlans);

/**
 * POST /api/subscription/upgrade - Upgrade subscription
 */
router.post('/upgrade', subscriptionController.upgradeSubscription);

/**
 * POST /api/subscription/downgrade - Downgrade subscription
 */
router.post('/downgrade', subscriptionController.downgradeSubscription);

/**
 * POST /api/subscription/cancel - Cancel subscription
 */
router.post('/cancel', subscriptionController.cancelSubscription);

/**
 * POST /api/subscription/billing-portal - Get billing portal URL
 */
router.post('/billing-portal', subscriptionController.getBillingPortalUrl);

/**
 * GET /api/subscription/usage - Get usage statistics
 */
router.get('/usage', subscriptionController.getUsage);

/**
 * GET /api/subscription/invoices - Get invoices
 */
router.get('/invoices', subscriptionController.getInvoices);

/**
 * POST /api/subscription/payment-method - Update payment method
 */
router.post('/payment-method', subscriptionController.updatePaymentMethod);

module.exports = router;
