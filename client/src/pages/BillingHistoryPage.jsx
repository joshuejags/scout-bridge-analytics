import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../utils/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './BillingHistoryPage.css';

const BillingHistoryPage = () => {
  const { token } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    const loadBilling = async () => {
      setLoading(true);
      setError('');
      try {
        const [subscriptionResponse, invoicesResponse] = await Promise.all([
          axios.get(apiUrl('/subscription'), { headers: authHeaders }),
          axios.get(apiUrl('/subscription/invoices'), { headers: authHeaders }),
        ]);
        setSubscription(subscriptionResponse.data.subscription || null);
        const nextInvoices = invoicesResponse.data.invoices || [];
        setInvoices(nextInvoices);
      } catch (err) {
        setError(err.response?.data?.error || 'Unable to load billing history.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      loadBilling();
    } else {
      setLoading(false);
    }
  }, [authHeaders, token]);

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading billing history..." />;
  }

  return (
    <div className="page-shell page-shell--wide">
      <div className="page-header">
        <div className="page-heading">
          <div className="page-kicker">Billing</div>
          <h1 className="page-title">Billing history</h1>
          <p className="page-lead">Review current plan access, invoice activity, and upcoming renewals from one place.</p>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      <div className="billing-grid">
        <section className="surface-card saas-card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Current plan</h2>
              <p className="card-subtitle">Your active subscription status and coverage.</p>
            </div>
          </div>
          {subscription ? (
            <div className="plan-summary">
              <div className="kpi-card">
                <p className="kpi-card__label">Plan</p>
                <p className="kpi-card__value">{subscription.plan}</p>
              </div>
              <div className="kpi-card">
                <p className="kpi-card__label">Status</p>
                <p className="kpi-card__value">{subscription.status}</p>
              </div>
              <div className="kpi-card">
                <p className="kpi-card__label">Renewal</p>
                <p className="kpi-card__value">{subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : '—'}</p>
              </div>
            </div>
          ) : (
            <div className="empty-state">No subscription found yet. Visit the subscription center to activate your plan.</div>
          )}
        </section>

        <section className="surface-card saas-card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Invoice history</h2>
              <p className="card-subtitle">Track completed payments and renewal activity.</p>
            </div>
          </div>

          {invoices.length === 0 ? (
            <div className="empty-state">No invoices recorded yet. Once billing is activated, charges will appear here.</div>
          ) : (
            <div className="invoice-list">
              {invoices.map((invoice, index) => (
                <article key={invoice.id || `${invoice.status}-${index}`} className="invoice-item">
                  <div>
                    <strong>{invoice.number || invoice.id || `Invoice ${index + 1}`}</strong>
                    <p>{invoice.description || 'Subscription invoice'}</p>
                  </div>
                  <div className="invoice-item__meta">
                    <span>{invoice.amount ? `$${invoice.amount}` : '—'}</span>
                    <span>{invoice.status || 'Paid'}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default BillingHistoryPage;
