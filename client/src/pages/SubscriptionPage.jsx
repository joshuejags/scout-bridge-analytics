import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { apiUrl } from '../utils/api';
import './SubscriptionPage.css';

const SubscriptionPage = () => {
  const { token } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch(apiUrl('/subscription'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch subscription');
        const data = await response.json();
        setSubscription(data.subscription || data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchSubscription();
    } else {
      setLoading(false);
    }
  }, [token]);

  const handleUpgrade = async (plan) => {
    setUpgrading(true);
    try {
      const response = await fetch(apiUrl('/subscription/upgrade'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });
      if (!response.ok) throw new Error('Upgrade failed');
      const data = await response.json();
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUpgrading(false);
    }
  };

  const handleBillingPortal = async () => {
    try {
      const response = await fetch(apiUrl('/subscription/billing-portal'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to open billing portal');
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading subscription..." />;
  }

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      features: [
        '5 videos/month',
        '10 GB storage',
        'Basic analytics',
        'Community support',
      ],
      current: subscription?.plan === 'Free',
      recommended: false,
    },
    {
      name: 'Scout Pro',
      price: '$29.99',
      period: '/month',
      features: [
        '100 videos/month',
        '500 GB storage',
        'Advanced analytics',
        'Player comparison',
        'Scout reports',
        'Email support',
      ],
      current: subscription?.plan === 'Scout Pro',
      recommended: true,
    },
    {
      name: 'Club Pro',
      price: '$99.99',
      period: '/month',
      features: [
        '500 videos/month',
        '2 TB storage',
        'Team analytics',
        'Recruitment workflows',
        'Multi-user access',
        'Priority support',
      ],
      current: subscription?.plan === 'Club Pro',
      recommended: false,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'pricing',
      features: [
        'Unlimited videos',
        'Unlimited storage',
        'Full feature suite',
        'Custom integrations',
        'Dedicated support',
      ],
      current: subscription?.plan === 'Enterprise',
      recommended: false,
    },
  ];

  return (
    <div className="subscription-page">
      <div className="subscription-header">
        <h1>Subscription & Billing</h1>
        <p>Manage your ScoutBridge subscription and billing settings</p>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {subscription && (
        <div className="current-subscription">
          <div className="subscription-info">
            <h2>Current Plan</h2>
            <div className="plan-details">
              <p className="plan-name">{subscription.plan}</p>
              <p className="plan-status">
                Status: <span className={subscription.status}>{subscription.status}</span>
              </p>
              {subscription.currentPeriodEnd && (
                <p className="renewal-date">
                  Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          <button className="billing-portal-btn" onClick={handleBillingPortal}>
            Manage Billing Portal
          </button>
        </div>
      )}

      <div className="plans-container">
        <h2>Available Plans</h2>
        <div className="plans-grid">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`plan-card ${plan.recommended ? 'recommended' : ''} ${plan.current ? 'current' : ''}`}
            >
              {plan.recommended && <div className="recommended-badge">Recommended</div>}
              {plan.current && <div className="current-badge">Current Plan</div>}

              <h3>{plan.name}</h3>
              <div className="price">
                <span className="amount">{plan.price}</span>
                <span className="period">{plan.period}</span>
              </div>

              <ul className="features-list">
                {plan.features.map((feature, idx) => (
                  <li key={idx}>
                    <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {!plan.current && (
                <button className="upgrade-btn" onClick={() => handleUpgrade(plan.name)} disabled={upgrading}>
                  {upgrading ? 'Processing...' : 'Upgrade to ' + plan.name}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {subscription && (
        <div className="usage-section">
          <h2>Usage</h2>
          <div className="usage-grid">
            <div className="usage-card">
              <h3>Videos Uploaded</h3>
              <div className="usage-bar">
                <div
                  className="usage-fill"
                  style={{ width: `${(subscription.usageMetrics?.videosUploaded || 0) / (subscription.plan === 'Free' ? 5 : subscription.plan === 'Scout Pro' ? 100 : subscription.plan === 'Club Pro' ? 500 : 99999) * 100}%` }}
                ></div>
              </div>
              <p className="usage-text">
                {subscription.usageMetrics?.videosUploaded || 0} of{' '}
                {subscription.plan === 'Free' ? '5' : subscription.plan === 'Scout Pro' ? '100' : subscription.plan === 'Club Pro' ? '500' : 'unlimited'} videos
              </p>
            </div>

            <div className="usage-card">
              <h3>Storage Used</h3>
              <div className="usage-bar">
                <div
                  className="usage-fill"
                  style={{ width: `${(subscription.usageMetrics?.storageUsed || 0) / (subscription.plan === 'Free' ? 10 : subscription.plan === 'Scout Pro' ? 500 : subscription.plan === 'Club Pro' ? 2000 : 99999) * 100}%` }}
                ></div>
              </div>
              <p className="usage-text">
                {subscription.usageMetrics?.storageUsed || 0} of{' '}
                {subscription.plan === 'Free' ? '10' : subscription.plan === 'Scout Pro' ? '500' : subscription.plan === 'Club Pro' ? '2000' : 'unlimited'} GB
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;
