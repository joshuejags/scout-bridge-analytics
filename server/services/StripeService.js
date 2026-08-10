const Stripe = require('stripe');
const { SUBSCRIPTION_PLANS, PLAN_FEATURES } = require('../models/Subscription');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-04-10',
});

/**
 * Stripe Service for managing subscriptions, payments, and customers
 */
class StripeService {
  /**
   * Create a new Stripe customer
   */
  static async createCustomer(user) {
    try {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user._id.toString(),
          createdAt: new Date().toISOString(),
        },
      });

      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw new Error(`Failed to create Stripe customer: ${error.message}`);
    }
  }

  /**
   * Create a payment intent for one-time payments
   */
  static async createPaymentIntent(customerId, amount, currency = 'usd', metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        customer: customerId,
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Create a subscription
   */
  static async createSubscription(customerId, priceId, billingCycle = 'monthly') {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        collection_method: 'charge_automatically',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          billingCycle,
        },
      });

      return subscription;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Update subscription plan
   */
  static async updateSubscription(subscriptionId, newPriceId, proration = true) {
    try {
      const items = await stripe.subscriptionItems.list({
        subscription: subscriptionId,
        limit: 1,
      });

      if (!items.data.length) {
        throw new Error('No subscription items found');
      }

      const updated = await stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: proration ? 'create_prorations' : 'none',
      });

      return updated;
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw new Error(`Failed to update subscription: ${error.message}`);
    }
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(subscriptionId, atPeriodEnd = true) {
    try {
      const cancelled = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: atPeriodEnd,
      });

      if (!atPeriodEnd) {
        // Immediately cancel if not waiting for period end
        return await stripe.subscriptions.cancel(subscriptionId);
      }

      return cancelled;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Get subscription details
   */
  static async getSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }
  }

  /**
   * Get customer details
   */
  static async getCustomer(customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      return customer;
    } catch (error) {
      console.error('Error fetching customer:', error);
      throw new Error(`Failed to fetch customer: ${error.message}`);
    }
  }

  /**
   * Get invoice details
   */
  static async getInvoice(invoiceId) {
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      return invoice;
    } catch (error) {
      console.error('Error fetching invoice:', error);
      throw new Error(`Failed to fetch invoice: ${error.message}`);
    }
  }

  /**
   * List invoices for a customer
   */
  static async listInvoices(customerId, limit = 10) {
    try {
      const invoices = await stripe.invoices.list({
        customer: customerId,
        limit,
      });

      return invoices.data;
    } catch (error) {
      console.error('Error listing invoices:', error);
      throw new Error(`Failed to list invoices: ${error.message}`);
    }
  }

  /**
   * Update payment method
   */
  static async updatePaymentMethod(customerId, paymentMethodId) {
    try {
      const updated = await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      return updated;
    } catch (error) {
      console.error('Error updating payment method:', error);
      throw new Error(`Failed to update payment method: ${error.message}`);
    }
  }

  /**
   * Create a billing portal session for customer self-service
   */
  static async createBillingPortalSession(customerId, returnUrl) {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return session;
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      throw new Error(`Failed to create billing portal session: ${error.message}`);
    }
  }

  /**
   * Create a checkout session
   */
  static async createCheckoutSession(customerId, lineItems, successUrl, cancelUrl) {
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error(`Failed to create checkout session: ${error.message}`);
    }
  }

  /**
   * Handle webhook event
   */
  static async handleWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'customer.subscription.updated':
          return this._handleSubscriptionUpdated(event.data.object);
        case 'customer.subscription.deleted':
          return this._handleSubscriptionDeleted(event.data.object);
        case 'invoice.payment_succeeded':
          return this._handleInvoicePaymentSucceeded(event.data.object);
        case 'invoice.payment_failed':
          return this._handleInvoicePaymentFailed(event.data.object);
        case 'charge.refunded':
          return this._handleChargeRefunded(event.data.object);
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook event:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(body, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_placeholder'
      );

      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw new Error(`Webhook verification failed: ${error.message}`);
    }
  }

  /**
   * Handle subscription.updated event
   */
  static async _handleSubscriptionUpdated(subscription) {
    console.log(`Subscription ${subscription.id} updated`);
    // Update in database
  }

  /**
   * Handle subscription.deleted event
   */
  static async _handleSubscriptionDeleted(subscription) {
    console.log(`Subscription ${subscription.id} deleted`);
    // Update in database
  }

  /**
   * Handle invoice.payment_succeeded event
   */
  static async _handleInvoicePaymentSucceeded(invoice) {
    console.log(`Invoice ${invoice.id} payment succeeded`);
    // Update in database
  }

  /**
   * Handle invoice.payment_failed event
   */
  static async _handleInvoicePaymentFailed(invoice) {
    console.log(`Invoice ${invoice.id} payment failed`);
    // Send email notification
  }

  /**
   * Handle charge.refunded event
   */
  static async _handleChargeRefunded(charge) {
    console.log(`Charge ${charge.id} refunded`);
    // Update in database
  }
}

module.exports = StripeService;
