import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import './AuthForm.css';

const VerifyEmailPage = () => {
  const { verifyEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [error, setError] = useState(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('This verification link is missing its token.');
      return;
    }
    // Effects can run twice in dev (StrictMode); the token is single-use
    // server-side, so a duplicate call would surface as a false failure.
    if (attempted.current) return;
    attempted.current = true;

    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setError(err.response?.data?.error || 'Verification link is invalid or has expired');
      });
  }, [token, verifyEmail]);

  if (status === 'verifying') {
    return <LoadingSpinner fullScreen message="Verifying your email..." />;
  }

  return (
    <div className="auth-page">
      <div className="auth-form">
        {status === 'success' ? (
          <>
            <h2>Email verified</h2>
            <p>Your email address has been verified.</p>
          </>
        ) : (
          <>
            <h2>Verification failed</h2>
            <p>{error}</p>
          </>
        )}
        <p className="auth-switch">
          <Link to="/">Go to dashboard</Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
