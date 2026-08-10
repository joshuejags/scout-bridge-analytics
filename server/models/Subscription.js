const mongoose = require('mongoose');

// Subscription plans available
const SUBSCRIPTION_PLANS = {
  FREE: 'free',
  SCOUT_PRO: 'scout_pro',
  CLUB_PRO: 'club_pro',
  ENTERPRISE: 'enterprise',
};

// Plan limits and features
const PLAN_FEATURES = {
  [SUBSCRIPTION_PLANS.FREE]: {
    name: 'Free',
    videoUploadsPerMonth: 5,
    storageGB: 10,
    reportSaved: false,
    watchlistsCount: 0,
    scoutingReports: false,
    advancedAnalytics: false,
    teamAccess: false,
    price: 0,
    monthlyPrice: 0,
    annualPrice: 0,
  },
  [SUBSCRIPTION_PLANS.SCOUT_PRO]: {
    name: 'Scout Pro',
    videoUploadsPerMonth: 100,
    storageGB: 500,
    reportSaved: true,
    watchlistsCount: 10,
    scoutingReports: true,
    advancedAnalytics: true,
    teamAccess: false,
    price: 29.99,
    monthlyPrice: 29.99,
    annualPrice: 299.99,
  },
  [SUBSCRIPTION_PLANS.CLUB_PRO]: {
    name: 'Club Pro',
    videoUploadsPerMonth: 500,
    storageGB: 2000,
    reportSaved: true,
    watchlistsCount: 50,
    scoutingReports: true,
    advancedAnalytics: true,
    teamAccess: true,
    multiTeam: true,
    multiUser: 10,
    price: 99.99,
    monthlyPrice: 99.99,
    annualPrice: 999.99,
  },
  [SUBSCRIPTION_PLANS.ENTERPRISE]: {
    name: 'Enterprise',
    videoUploadsPerMonth: null, // unlimited
    storageGB: null, // unlimited
    reportSaved: true,
    watchlistsCount: null, // unlimited
    scoutingReports: true,
    advancedAnalytics: true,
    teamAccess: true,
    multiTeam: true,
    multiUser: null, // unlimited
    price: null, // custom
    monthlyPrice: null,
    annualPrice: null,
  },
};

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: Object.values(SUBSCRIPTION_PLANS),
      default: SUBSCRIPTION_PLANS.FREE,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'cancelled', 'trial', 'past_due'],
      default: 'active',
    },
    
    // Stripe integration
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    stripeProductId: String,
    stripePriceId: String,
    
    // Billing cycle
    billingCycle: {
      type: String,
      enum: ['monthly', 'annual'],
      default: 'monthly',
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    trialEnd: Date,
    cancelledAt: Date,
    
    // Usage tracking
    usage: {
      videosUploaded: { type: Number, default: 0 },
      storageUsedGB: { type: Number, default: 0 },
      reportsGenerated: { type: Number, default: 0 },
    },
    
    // Monthly reset for usage (should happen on currentPeriodStart)
    lastUsageReset: Date,
    
    // Invoice history
    invoices: [
      {
        stripeInvoiceId: String,
        amount: Number,
        currency: String,
        status: String,
        paidAt: Date,
        createdAt: Date,
      },
    ],
    
    // Payment method
    paymentMethod: {
      type: {
        type: String,
        enum: ['card', 'bank_transfer'],
      },
      lastFour: String,
      expiryMonth: Number,
      expiryYear: Number,
    },
    
    // Features flag
    featuresEnabled: {
      advancedAnalytics: { type: Boolean, default: false },
      scoutingReports: { type: Boolean, default: false },
      watchlists: { type: Boolean, default: false },
      teamAccess: { type: Boolean, default: false },
    },
    
    // Notes
    notes: String,
  },
  { timestamps: true }
);

// Index for querying subscriptions by status and plan
subscriptionSchema.index({ status: 1, plan: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });

/**
 * Get subscription features for current plan
 */
subscriptionSchema.methods.getFeatures = function getFeatures() {
  return PLAN_FEATURES[this.plan] || PLAN_FEATURES[SUBSCRIPTION_PLANS.FREE];
};

/**
 * Check if subscription is active
 */
subscriptionSchema.methods.isActive = function isActive() {
  return this.status === 'active' || this.status === 'trial';
};

/**
 * Check if user can upload video
 */
subscriptionSchema.methods.canUploadVideo = function canUploadVideo() {
  const features = this.getFeatures();
  if (features.videoUploadsPerMonth === null) return true; // unlimited
  
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonth = `${(this.lastUsageReset || now).getFullYear()}-${String((this.lastUsageReset || now).getMonth() + 1).padStart(2, '0')}`;
  
  // Reset usage if we're in a new billing period
  if (yearMonth !== currentMonth) {
    this.usage.videosUploaded = 0;
    this.lastUsageReset = now;
  }
  
  return this.usage.videosUploaded < features.videoUploadsPerMonth;
};

/**
 * Check if user has enough storage
 */
subscriptionSchema.methods.hasStorageAvailable = function hasStorageAvailable(requiredGB) {
  const features = this.getFeatures();
  if (features.storageGB === null) return true; // unlimited
  
  return this.usage.storageUsedGB + requiredGB <= features.storageGB;
};

/**
 * Check if feature is enabled
 */
subscriptionSchema.methods.hasFeature = function hasFeature(featureName) {
  return this.featuresEnabled[featureName] === true;
};

module.exports = {
  model: mongoose.model('Subscription', subscriptionSchema),
  SUBSCRIPTION_PLANS,
  PLAN_FEATURES,
};
