import React from 'react';

const formatCurrency = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

export default function PaymentSummary({
  dailyPrice,
  days,
  rentalFee,
  deliveryFee,
  platformFee,
  totalAmount,
  depositAmount,
  showDepositOnly = false
}) {
  return (
    <div className="rs-breakdown-card" style={{
      background: 'var(--surface-color)',
      border: '1px solid var(--border-color)',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <h3 className="rs-breakdown-title" style={{
        fontSize: '1.1rem',
        fontWeight: '700',
        color: 'var(--text-dark)',
        marginBottom: '20px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '12px'
      }}>
        {showDepositOnly ? '🔒 Security Deposit breakdown' : '💳 Payment Breakdown'}
      </h3>

      {!showDepositOnly ? (
        <div className="rs-breakdown-rows" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="rs-row" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            <span>Daily Rent</span>
            <span style={{ fontWeight: '500', color: 'var(--text-dark)' }}>{formatCurrency(dailyPrice)} × {days} day{days > 1 ? 's' : ''}</span>
          </div>
          <div className="rs-row" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            <span>Rental Fee</span>
            <span style={{ fontWeight: '600', color: 'var(--primary-color)' }}>{formatCurrency(rentalFee)}</span>
          </div>
          <div className="rs-row" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            <span>Delivery Fee</span>
            <span style={{ fontWeight: '500', color: 'var(--text-dark)' }}>{deliveryFee > 0 ? formatCurrency(deliveryFee) : 'Free (Pickup)'}</span>
          </div>
          <div className="rs-row" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            <span>Platform Fee</span>
            <span style={{ fontWeight: '500', color: 'var(--text-dark)' }}>{formatCurrency(platformFee)}</span>
          </div>
          
          <hr className="rs-divider" style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />
          
          <div className="rs-row rs-row-total" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-dark)' }}>
            <span>Total Booking Amount</span>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      ) : null}

      {depositAmount > 0 && (
        <div className="rs-deposit-info" style={{
          marginTop: showDepositOnly ? '0px' : '24px',
          background: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '12px',
          padding: '18px'
        }}>
          <div className="rs-deposit-badge" style={{
            fontSize: '0.78rem',
            fontWeight: '700',
            color: 'var(--primary-color)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '8px'
          }}>
            🔒 Security Deposit (Refundable)
          </div>
          <div className="rs-deposit-amount" style={{
            fontSize: '1.6rem',
            fontWeight: '800',
            color: 'var(--text-dark)',
            marginBottom: '10px'
          }}>
            {formatCurrency(depositAmount)}
          </div>
          <p className="rs-deposit-note" style={{
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            lineHeight: '1.5',
            margin: '0 0 8px'
          }}>
            This is collected {showDepositOnly ? 'now' : 'only after the owner accepts your request'} and is held securely.
          </p>
          <p className="rs-refund-note" style={{
            fontSize: '0.82rem',
            color: '#059669',
            lineHeight: '1.5',
            margin: '0',
            fontWeight: '500'
          }}>
            ✅ 100% fully refundable upon undamaged return of the item.
          </p>
        </div>
      )}
    </div>
  );
}
