const { model: Subscription, SUBSCRIPTION_PLANS, PLAN_FEATURES } = require('../models/Subscription');
const { model: User } = require('../models/User');
const StripeService = require('../services/StripeService');

/**
 * Get current subscription for user
 */
exports.getSubscription = async (req, res) => {
  try {
    const userId = req.user._id;

    let subscription = await Subscription.findOne({ userId }).lean();

    // If no subscription exists, create a free tier
    if (!subscription) {
      subscription = await Subscription.create({
        userId,
        plan: SUBSCRIPTION_PLANS.FREE,
        status: 'active',
        featuresEnabled: {
          advancedAnalytics: false,
          scoutingReports: false,
          watchlists: false,
          teamAccess: false,
        },
      });
    }

    res.json({
      success: true,
      subscription,
      features: PLAN_FEATURES[subscription.plan],
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription',
    });
  }
};

/**
 * Get subscription plans
 */
exports.getPlans = async (req, res) => {
  try {
    res.json({
      success: true,
      plans: Object.entries(PLAN_FEATURES).map(([planId, features]) => ({
        id: planId,
        ...features,
      })),
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plans',
    });
  }
};

/**
 * Upgrade subscription
 */
exports.upgradeSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plan, billingCycle = 'monthly' } = req.body;

    if (!Object.values(SUBSCRIPTION_PLANS).includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan',
      });
    }

    let subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    // If upgrading to paid plan, create Stripe customer and subscription
    if (plan !== SUBSCRIPTION_PLANS.FREE && !subscription.stripeCustomerId) {
      const user = await User.findById(userId);

      // Create Stripe customer
      const customer = await StripeService.createCustomer(user);
      subscription.stripeCustomerId = customer.id;

      // Map plan to Stripe price ID (should be configured in env)
      const priceIds = {
        [SUBSCRIPTION_PLANS.SCOUT_PRO]: process.env.STRIPE_PRICE_SCOUT_PRO,
        [SUBSCRIPTION_PLANS.CLUB_PRO]: process.env.STRIPE_PRICE_CLUB_PRO,
        [SUBSCRIPTION_PLANS.ENTERPRISE]: process.env.STRIPE_PRICE_ENTERPRISE,
      };

      const priceId = priceIds[plan];
      if (!priceId) {
        return res.status(400).json({
          success: false,
          error: 'Plan pricing not configured',
        });
      }

      // Create Stripe subscription
      const stripeSubscription = await StripeService.createSubscription(customer.id, priceId, billingCycle);

      subscription.stripeSubscriptionId = stripeSubscription.id;
      subscription.stripePriceId = priceId;
      subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
      subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    }

    // Update plan and features
    subscription.plan = plan;
    subscription.billingCycle = billingCycle;
    subscription.status = 'active';

    // Enable features based on plan
    const features = PLAN_FEATURES[plan];
    subscription.featuresEnabled = {
      advancedAnalytics: features.advancedAnalytics,
      scoutingReports: features.scoutingReports,
      watchlists: features.watchlistsCount > 0,
      teamAccess: features.teamAccess,
    };

    await subscription.save();

    res.json({
      success: true,
      subscription,
      message: `Successfully upgraded to ${features.name}`,
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upgrade subscription',
    });
  }
};

/**
 * Downgrade subscription
 */
exports.downgradeSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plan = SUBSCRIPTION_PLANS.FREE } = req.body;

    let subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    // If downgrading to free tier, cancel Stripe subscription
    if (plan === SUBSCRIPTION_PLANS.FREE && subscription.stripeSubscriptionId) {
      await StripeService.cancelSubscription(subscription.stripeSubscriptionId, true);
    }

    // Update subscription
    subscription.plan = plan;
    subscription.status = 'active';

    // Update features
    const features = PLAN_FEATURES[plan];
    subscription.featuresEnabled = {
      advancedAnalytics: features.advancedAnalytics,
      scoutingReports: features.scoutingReports,
      watchlists: features.watchlistsCount > 0,
      teamAccess: features.teamAccess,
    };

    await subscription.save();

    res.json({
      success: true,
      subscription,
      message: `Successfully downgraded to ${features.name}`,
    });
  } catch (error) {
    console.error('Error downgrading subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to downgrade subscription',
    });
  }
};

/**
 * Cancel subscription
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { immediate = false } = req.body;

    let subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    if (subscription.stripeSubscriptionId) {
      await StripeService.cancelSubscription(subscription.stripeSubscriptionId, !immediate);
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();

    await subscription.save();

    res.json({
      success: true,
      subscription,
      message: 'Subscription cancelled',
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription',
    });
  }
};

/**
 * Get billing portal URL
 */
exports.getBillingPortalUrl = async (req, res) => {
  try {
    const userId = req.user._id;
    const { returnUrl } = req.body;

    let subscription = await Subscription.findOne({ userId });

    if (!subscription || !subscription.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        error: 'No active Stripe customer',
      });
    }

    const session = await StripeService.createBillingPortalSession(
      subscription.stripeCustomerId,
      returnUrl || process.env.FRONTEND_URL
    );

    res.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create billing portal session',
    });
  }
};

/**
 * Get usage statistics
 */
exports.getUsage = async (req, res) => {
  try {
    const userId = req.user._id;

    let subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found',
      });
    }

    const features = PLAN_FEATURES[subscription.plan];

    res.json({
      success: true,
      usage: {
        videosUploaded: subscription.usage.videosUploaded,
        videoLimit: features.videoUploadsPerMonth,
        storageUsedGB: subscription.usage.storageUsedGB,
        storageLimit: features.storageGB,
        reportsGenerated: subscription.usage.reportsGenerated,
        canUploadVideo: subscription.canUploadVideo(),
        hasStorage: subscription.hasStorageAvailable(0),
      },
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage statistics',
    });
  }
};

/**
 * Get invoices
 */
exports.getInvoices = async (req, res) => {
  try {
    const userId = req.user._id;

    let subscription = await Subscription.findOne({ userId });

    if (!subscription || !subscription.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        error: 'No invoices found',
      });
    }

    const invoices = await StripeService.listInvoices(subscription.stripeCustomerId);

    res.json({
      success: true,
      invoices,
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices',
    });
  }
};

/**
 * Update payment method
 */
exports.updatePaymentMethod = async (req, res) => {
  try {
    const userId = req.user._id;
    const { paymentMethodId } = req.body;

    let subscription = await Subscription.findOne({ userId });

    if (!subscription || !subscription.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        error: 'No Stripe customer',
      });
    }

    await StripeService.updatePaymentMethod(subscription.stripeCustomerId, paymentMethodId);

    res.json({
      success: true,
      message: 'Payment method updated',
    });
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment method',
    });
  }
};
