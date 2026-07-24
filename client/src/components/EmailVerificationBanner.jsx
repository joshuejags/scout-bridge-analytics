import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './EmailVerificationBanner.css';

const EmailVerificationBanner = () => {
  const { isAuthenticated, user, resendVerification } = useAuth();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  if (!isAuthenticated || !user || user.emailVerified) {
    return null;
  }

  const handleResend = async () => {
    setSending(true);
    setError(null);
    try {
      await resendVerification();
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send verification email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="email-verification-banner">
      <span>
        Your email address isn't verified yet.
        {error && <span className="evb-error"> {error}</span>}
      </span>
      <button onClick={handleResend} disabled={sending || sent}>
        {sent ? 'Verification email sent' : sending ? 'Sending...' : 'Resend verification email'}
      </button>
    </div>
  );
};

export default EmailVerificationBanner;
