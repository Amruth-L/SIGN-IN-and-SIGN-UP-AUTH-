import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import './Payment.css';

export default function PaymentSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Destructure custom success state
  const {
    message = 'Your payment has been successfully processed!',
    actionText = 'Go to Dashboard',
    nextPath = '/',
    rentals = []
  } = location.state || {};

  return (
    <div className="result-page">
      <div className="result-card" style={{ maxWidth: rentals.length > 0 ? '600px' : '500px' }}>
        {/* Animated Checkmark Circle */}
        <div className="result-icon-circle success">
          <span style={{ fontSize: '2.5rem' }}>✓</span>
        </div>

        <h2 className="result-title">
          Payment Successful!
        </h2>

        <p className="result-msg">
          {message}
        </p>

        {/* QR Codes Section */}
        {rentals.length > 0 && (
          <div className="qr-codes-section">
            <h3 className="qr-section-title">Your Booking QR Codes</h3>
            <p className="qr-section-subtitle">
              Show these QR codes to the item owner during handover for verification
            </p>
            
            <div className="qr-codes-grid">
              {rentals.map((rental, index) => (
                <div key={rental.rental_id || index} className="qr-code-card">
                  <div className="qr-code-wrapper">
                    <QRCodeSVG
                      value={JSON.stringify({
                        rental_id: rental.rental_id,
                        hash: rental.qr_code_hash,
                        platform: 'CampusMesh'
                      })}
                      size={160}
                      level="H"
                      includeMargin={true}
                      bgColor="#ffffff"
                      fgColor="#1f2937"
                    />
                  </div>
                  <p className="qr-item-title">{rental.listing_title || 'Rental Item'}</p>
                  <span className="qr-rental-id">ID: {rental.rental_id?.slice(0, 8)}...</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => navigate(nextPath)}
          className="payment-btn-primary"
        >
          {actionText}
        </button>
      </div>
    </div>
  );
}
