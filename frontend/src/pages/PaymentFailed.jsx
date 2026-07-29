import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Payment.css';

export default function PaymentFailed() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    error = 'An error occurred while processing your payment.',
    retryPath = '/'
  } = location.state || {};

  return (
    <div className="result-page">
      <div className="result-card">
        {/* Warning Icon */}
        <div className="result-icon-circle failed">
          <span style={{ fontSize: '2.5rem' }}>⚠️</span>
        </div>

        <h2 className="result-title">
          Payment Failed
        </h2>

        <p className="result-msg">
          {error}
        </p>

        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            onClick={() => navigate(retryPath)}
            className="payment-btn-primary"
            style={{ flex: 1 }}
          >
            Try Again
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="payment-btn-outline"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
