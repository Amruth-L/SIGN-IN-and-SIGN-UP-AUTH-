import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './RentalReturn.css';

const API_BASE = 'http://localhost:3003';
const formatCurrency = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

export default function RentalReturn() {
  const { rentalId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rental, setRental] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [isDamaged, setIsDamaged] = useState(false);
  const [damageDesc, setDamageDesc] = useState('');
  const [damageAmount, setDamageAmount] = useState('');

  useEffect(() => {
    const fetchRental = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`${API_BASE}/api/rentals/${rentalId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setRental(data.rental);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRental();
  }, [rentalId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isDamaged && !damageDesc.trim()) {
      setError('Please describe the damage.');
      return;
    }
    setSubmitting(true);
    setError('');
    const token = localStorage.getItem('token');
    try {
      const payload = {
        damage_description: isDamaged ? damageDesc : null,
        damage_amount: isDamaged ? parseFloat(damageAmount) || 0 : 0,
      };
      const res = await fetch(`${API_BASE}/api/rentals/${rentalId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Also process refund immediately (simulation)
      const refundRes = await fetch(`${API_BASE}/api/payment/refund-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rental_id: rentalId,
          damage_amount: payload.damage_amount,
          damage_description: payload.damage_description,
        }),
      });
      const refundData = await refundRes.json();
      if (!refundRes.ok) throw new Error(refundData.error);

      setSubmitted(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rr-loading">
        <div className="rr-spinner" />
        <p>Loading rental info…</p>
      </div>
    );
  }

  if (error && !rental) {
    return <div className="rr-error-page"><span>⚠️</span><p>{error}</p></div>;
  }

  const isOwner = rental?.owner_id === user?.id;
  const deposit = parseFloat(rental?.deposit_amount || 0);
  const deduction = isDamaged ? (parseFloat(damageAmount) || 0) : 0;
  const estimatedRefund = Math.max(0, deposit - deduction);

  if (submitted) {
    return (
      <div className="rr-success-page">
        <div className="rr-success-card">
          <div className="rr-success-icon">🎉</div>
          <h2>Return Confirmed!</h2>
          <p className="rr-success-msg">
            {isDamaged
              ? `Damage report submitted. After admin review, a refund of ${formatCurrency(estimatedRefund)} will be processed.`
              : `The item was returned in good condition. A full deposit refund of ${formatCurrency(deposit)} has been initiated.`
            }
          </p>
          <div className="rr-refund-display">
            <span className="rr-refund-label">Refund Amount</span>
            <span className="rr-refund-amount">{formatCurrency(estimatedRefund)}</span>
          </div>
          <button className="rr-home-btn" onClick={() => navigate('/owner-dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rr-page">
      <div className="rr-container">
        {/* Header */}
        <div className="rr-header">
          <button className="rr-back-btn" onClick={() => navigate(-1)}>← Back</button>
          <h1 className="rr-title">Return & Inspection</h1>
          <p className="rr-subtitle">Confirm item return and process security deposit refund</p>
        </div>

        <div className="rr-layout">
          {/* Left — Inspection Form */}
          <div className="rr-left">
            {/* Rental Info */}
            <div className="rr-info-card">
              {rental.listing_image && (
                <img src={rental.listing_image} alt={rental.listing_title} className="rr-item-img" />
              )}
              <div>
                <p className="rr-item-cat">{rental.listing_category}</p>
                <h2 className="rr-item-title">{rental.listing_title}</h2>
                <p className="rr-borrower">Rented by: <strong>{rental.borrower_name}</strong></p>
              </div>
            </div>

            {/* Condition Check */}
            {isOwner ? (
              <form onSubmit={handleSubmit} className="rr-form">
                <h3 className="rr-form-heading">📋 Condition Inspection</h3>
                <p className="rr-form-note">As the owner, confirm whether the item was returned in good condition.</p>

                <div className="rr-condition-choices">
                  <button
                    type="button"
                    className={`rr-condition-btn ${!isDamaged ? 'rr-condition-good' : ''}`}
                    onClick={() => setIsDamaged(false)}
                  >
                    <span>✅</span>
                    <span>Good Condition</span>
                    <small>Refund 100% deposit</small>
                  </button>
                  <button
                    type="button"
                    className={`rr-condition-btn ${isDamaged ? 'rr-condition-damaged' : ''}`}
                    onClick={() => setIsDamaged(true)}
                  >
                    <span>⚠️</span>
                    <span>Damaged / Issues</span>
                    <small>Partial refund after deduction</small>
                  </button>
                </div>

                {isDamaged && (
                  <div className="rr-damage-section">
                    <div className="rr-field">
                      <label htmlFor="damage-desc">Damage Description *</label>
                      <textarea
                        id="damage-desc"
                        rows={4}
                        placeholder="Describe the damage in detail (scratches, broken parts, stains, etc.)"
                        value={damageDesc}
                        onChange={(e) => setDamageDesc(e.target.value)}
                        required={isDamaged}
                      />
                    </div>
                    <div className="rr-field">
                      <label htmlFor="damage-amt">Estimated Damage Cost (₹)</label>
                      <input
                        id="damage-amt"
                        type="number"
                        min="0"
                        max={deposit}
                        step="1"
                        placeholder="e.g. 150"
                        value={damageAmount}
                        onChange={(e) => setDamageAmount(e.target.value)}
                      />
                      <small className="rr-field-note">Maximum deductible: {formatCurrency(deposit)}</small>
                    </div>
                  </div>
                )}

                {error && <div className="rr-error">{error}</div>}

                <button type="submit" className="rr-submit-btn" disabled={submitting}>
                  {submitting ? 'Processing…' : 'Confirm Return & Process Refund'}
                </button>
              </form>
            ) : (
              <div className="rr-borrower-view">
                <div className="rr-borrower-icon">📦</div>
                <h3>Return in Progress</h3>
                <p>The owner is inspecting your returned item. Your deposit refund will be processed shortly.</p>
              </div>
            )}
          </div>

          {/* Right — Refund Preview */}
          <div className="rr-right">
            <div className="rr-refund-card">
              <h3 className="rr-refund-title">💰 Refund Preview</h3>
              <div className="rr-refund-rows">
                <div className="rr-rrow"><span>Security Deposit</span><span>{formatCurrency(deposit)}</span></div>
                <div className="rr-rrow"><span>Damage Deduction</span><span className="rr-deduction">
                  {isDamaged ? `- ${formatCurrency(deduction)}` : '—'}
                </span></div>
                <div className="rr-rdivider" />
                <div className="rr-rrow rr-rrow-total">
                  <span>Estimated Refund</span>
                  <span className="rr-refund-val">{formatCurrency(estimatedRefund)}</span>
                </div>
              </div>

              <div className="rr-policy-note">
                <p>✅ Full refund if no damage is reported.</p>
                <p>⚠️ Partial refund if damage deduction applies — pending admin review.</p>
                <p>🔒 Refunds are processed via the original payment method.</p>
              </div>
            </div>

            {/* Rental Summary */}
            <div className="rr-summary-card">
              <h4>Rental Summary</h4>
              <div className="rr-srow"><span>Rental Fee</span><span>{formatCurrency(rental.rental_fee)}</span></div>
              <div className="rr-srow"><span>Duration</span><span>{rental.rental_days} day{rental.rental_days > 1 ? 's' : ''}</span></div>
              <div className="rr-srow"><span>Booking Amount</span><span>{formatCurrency(rental.booking_amount)}</span></div>
              <div className="rr-srow"><span>Status</span><span className="rr-status-chip">{rental.status.replace(/_/g, ' ')}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
