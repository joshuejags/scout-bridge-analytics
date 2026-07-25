import React from 'react';
import { Link } from 'react-router-dom';
import './NotFoundPage.css';

const NotFoundPage = () => {
  return (
    <div className="not-found">
      <div className="not-found-container">
        <div className="not-found-icon">🧭</div>
        <h2>Page not found</h2>
        <p className="not-found-message">
          We couldn't find that page. It may have been moved, or the link might be out of date.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
