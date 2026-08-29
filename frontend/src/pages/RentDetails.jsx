import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { mockProducts } from '../data/mockData';
import QRCode from 'qrcode';
import './RentDetails.css';

const API_BASE = 'http://localhost:3003';
const formatCurrency = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

const STATUS_CONFIG = {
  BOOKING_PAYMENT_PENDING: { label: 'Payment Pending', color: '#f59e0b', icon: '⏳' },
  RENTAL_PAYMENT_COMPLETED: { label: 'Awaiting Owner', color: '#3b82f6', icon: '👀' },
  OWNER_PENDING:           { label: 'Awaiting Owner', color: '#3b82f6', icon: '👀' },
  DEPOSIT_PENDING:         { label: 'Deposit Required', color: '#f59e0b', icon: '🔒' },
  QR_GENERATED:            { label: 'QR Ready', color: '#10b981', icon: '✅' },
  COURIER_PICKUP:          { label: 'Courier Pickup', color: '#3b82f6', icon: '🚚' },
  BORROWER_RECEIVED:       { label: 'Item Received', color: '#10b981', icon: '📦' },
  RENTAL_ACTIVE:           { label: 'Rental Active', color: '#22c55e', icon: '🟢' },
  RETURN_REQUESTED:        { label: 'Return Requested', color: '#f97316', icon: '↩️' },
  RETURNED:                { label: 'Returned', color: '#10b981', icon: '🏠' },
  OWNER_INSPECTION:        { label: 'Under Inspection', color: '#f59e0b', icon: '🔍' },
  DEPOSIT_REFUNDED:        { label: 'Refunded', color: '#22c55e', icon: '💚' },
  COMPLETED:               { label: 'Completed', color: '#6b7280', icon: '🏁' },
  CANCELLED:               { label: 'Cancelled', color: '#ef4444', icon: '❌' },
};

const STEPS = [
  { key: 'OWNER_PENDING',   label: 'Owner Review' },
  { key: 'DEPOSIT_PENDING', label: 'Deposit' },
  { key: 'QR_GENERATED',   label: 'QR Handover' },
  { key: 'RENTAL_ACTIVE',  label: 'Active' },
  { key: 'COMPLETED',      label: 'Completed' },
];

const stepIndex = (status) => {
  const order = ['BOOKING_PAYMENT_PENDING','RENTAL_PAYMENT_COMPLETED','OWNER_PENDING','DEPOSIT_PENDING','QR_GENERATED','COURIER_PICKUP','BORROWER_RECEIVED','RENTAL_ACTIVE','RETURN_REQUESTED','RETURNED','OWNER_INSPECTION','DEPOSIT_REFUNDED','COMPLETED'];
  return order.indexOf(status);
};

function CountdownTimer({ deadline, onExpired }) {
  const [seconds, setSeconds] = useState(null);

  useEffect(() => {
    const calc = () => Math.max(0, Math.floor((new Date(deadline) - Date.now()) / 1000));
    setSeconds(calc());
    const interval = setInterval(() => {
      const s = calc();
      setSeconds(s);
      if (s === 0) { clearInterval(interval); onExpired?.(); }
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (seconds === null) return null;
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  const isUrgent = seconds < 300;

  return (
    <div className={`rd-timer ${isUrgent ? 'rd-timer-urgent' : ''}`}>
      <span className="rd-timer-icon">⏳</span>
      <span className="rd-timer-value">{m}:{s}</span>
    </div>
  );
}

export default function RentDetails() {
  const { rentalId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canvasRef = useRef(null);

  const [rental, setRental] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [depositSeconds, setDepositSeconds] = useState(null);
  const [payingDeposit, setPayingDeposit] = useState(false);
  const [justBooked] = useState(location.state?.justBooked);
  const [deliveryInfo, setDeliveryInfo] = useState(null);

  const fetchStatus = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/rentals/${rentalId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Resolve correct mock product details if mock rental
      if (rentalId && rentalId.startsWith('mock-rental-')) {
        const parts = rentalId.split('-');
        const mockProductId = parts.slice(2, parts.length - 1).join('-');
        const mockItem = mockProducts.find(p => p.id === mockProductId);
        if (mockItem) {
          data.rental.listing_title = mockItem.title;
          data.rental.listing_category = mockItem.category;
          data.rental.listing_image = mockItem.image_url;
          data.rental.listing_location = mockItem.location;
          data.rental.deposit_amount = Number(mockItem.deposit || 0);
        }

        const persistedStatus = localStorage.getItem(`mock_status_${rentalId}`);
        if (persistedStatus) {
          data.rental.status = persistedStatus;
          if (persistedStatus === 'DEPOSIT_PENDING') {
            data.rental.booking_status = 'CONFIRMED';
            data.rental.deposit_status = 'PENDING';
            data.rental.deposit_deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          } else if (persistedStatus === 'QR_GENERATED') {
            data.rental.booking_status = 'CONFIRMED';
            data.rental.deposit_status = 'PAID';
            data.rental.payment_status = 'PAID';
            data.rental.qr_code_hash = `mock_qr_hash_${rentalId}`;
          }
        }
      }

      setRental(data.rental);
      setPayments(data.payments || []);
      setDepositSeconds(data.deposit_seconds_remaining);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [rentalId]);

  // Fetch delivery status for this rental
  const fetchDeliveryStatus = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/delivery/rental/${rentalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDeliveryInfo(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchDeliveryStatus();
    const interval = setInterval(fetchDeliveryStatus, 15000);
    return () => clearInterval(interval);
  }, [rentalId]);

  // Poll every 15s when waiting for owner
  useEffect(() => {
    if (!rental) return;
    if (!['OWNER_PENDING', 'RENTAL_PAYMENT_COMPLETED', 'DEPOSIT_PENDING'].includes(rental.status)) return;
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [rental?.status]);

  // Generate QR canvas when status is QR_GENERATED
  useEffect(() => {
    if (rental?.status === 'QR_GENERATED' && rental.qr_code_hash && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, `campusmesh:rental:${rental.id}:${rental.qr_code_hash}`, {
        width: 200,
        color: { dark: '#ffffff', light: '#1a1040' },
      }).catch(console.error);
    }
  }, [rental?.status, rental?.qr_code_hash]);

  const handlePayDeposit = async () => {
    setPayingDeposit(true);
    const token = localStorage.getItem('token');
    try {
      const orderRes = await fetch(`${API_BASE}/api/payment/create-deposit-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rental_id: rentalId }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error);

      if (orderData.simulated) {
        const verifyRes = await fetch(`${API_BASE}/api/payment/verify-deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            rental_id: rentalId,
            gateway_order_id: orderData.order_id,
            gateway_payment_id: `sim_dep_${Date.now()}`,
            gateway_signature: 'sim_sig',
          }),
        });
        const vd = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(vd.error);
        await fetchStatus();
      } else {
        const options = {
          key: orderData.razorpay_key,
          amount: Math.round(rental.deposit_amount * 100),
          currency: 'INR',
          name: 'CampusMesh — Security Deposit',
          description: `Deposit for: ${rental.listing_title}`,
          order_id: orderData.order_id,
          handler: async (resp) => {
            const vRes = await fetch(`${API_BASE}/api/payment/verify-deposit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                rental_id: rentalId,
                gateway_order_id: resp.razorpay_order_id,
                gateway_payment_id: resp.razorpay_payment_id,
                gateway_signature: resp.razorpay_signature,
              }),
            });
            if (vRes.ok) await fetchStatus();
            else alert('Deposit verification failed. Contact support.');
          },
          prefill: { name: user?.name, email: user?.email },
          theme: { color: '#8B5CF6' },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setPayingDeposit(false);
    }
  };

  if (loading) {
    return (
      <div className="rd-loading">
        <div className="rd-spinner" />
        <p>Loading rental details…</p>
      </div>
    );
  }

  if (error && !rental) {
    return (
      <div className="rd-error-page" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>⚠️</span>
        <h3 style={{ fontSize: '1.25rem', color: '#dc2626', marginBottom: '0.5rem' }}>Unable to load this rental item. Please refresh.</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>The booking details could not be found or you do not have permission to view them.</p>
        <button onClick={() => navigate('/profile')} className="btn btn-primary">Go to My Rentals</button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[rental.status] || { label: rental.status, color: '#6b7280', icon: '•' };
  const currentStep = STEPS.findIndex(s => s.key === rental.status || (s.key === 'OWNER_PENDING' && rental.status === 'RENTAL_PAYMENT_COMPLETED'));

  const isBorrower = rental.borrower_id === user?.id;
  const isOwner = rental.owner_id === user?.id;

  return (
    <div className="rd-page">
      <div className="rd-container">
        {/* Header */}
        <div className="rd-header">
          <button className="rd-back-btn" onClick={() => navigate(-1)}>← Back</button>
          <div className="rd-header-top">
            <div>
              <h1 className="rd-title">Rental Status</h1>
              <p className="rd-rental-id">ID: {rentalId}</p>
            </div>
            <div className="rd-status-badge" style={{ '--status-color': statusCfg.color }}>
              <span>{statusCfg.icon}</span>
              <span>{statusCfg.label}</span>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="rd-steps">
          {STEPS.map((step, i) => (
            <div
              key={step.key}
              className={`rd-step ${i < currentStep ? 'rd-step-done' : ''} ${i === currentStep ? 'rd-step-active' : ''}`}
            >
              <div className="rd-step-dot">
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span className="rd-step-label">{step.label}</span>
              {i < STEPS.length - 1 && <div className={`rd-step-line ${i < currentStep ? 'rd-step-line-done' : ''}`} />}
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="rd-layout">
          <div className="rd-left">
            {/* Listing Info */}
            <div className="rd-card">
              <div className="rd-listing-row">
                {rental.listing_image && (
                  <img src={rental.listing_image} alt={rental.listing_title} className="rd-listing-img" />
                )}
                <div>
                  <p className="rd-listing-cat">{rental.listing_category}</p>
                  <h2 className="rd-listing-title">{rental.listing_title}</h2>
                  <p className="rd-listing-loc">📍 {rental.listing_location}</p>
                </div>
              </div>
              <div className="rd-date-row">
                <div><span className="rd-label">Start</span><span className="rd-value">{new Date(rental.start_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span></div>
                <div className="rd-arrow">→</div>
                <div><span className="rd-label">End</span><span className="rd-value">{new Date(rental.end_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span></div>
                <div><span className="rd-label">Duration</span><span className="rd-value">{rental.rental_days} day{rental.rental_days > 1 ? 's' : ''}</span></div>
              </div>
            </div>

            {/* Deposit Warning Banner */}
            {rental.status === 'DEPOSIT_PENDING' && isBorrower && (
              <div className="rd-deposit-banner">
                <div className="rd-deposit-warning-text">
                  <strong>Owner Accepted Your Booking!</strong>
                  <p>Please pay the refundable security deposit before the timer expires. Failure to pay will automatically cancel your booking and release the item.</p>
                </div>
                {rental.deposit_deadline && (
                  <CountdownTimer
                    deadline={rental.deposit_deadline}
                    onExpired={() => setTimeout(fetchStatus, 1000)}
                  />
                )}
                <button
                  className="rd-pay-deposit-btn"
                  onClick={() => navigate(`/deposit-payment/${rentalId}`)}
                >
                  Pay Security Deposit {formatCurrency(rental.deposit_amount)}
                </button>
              </div>
            )}

            {/* QR Code Handover */}
            {rental.status === 'QR_GENERATED' && (
              <div className="rd-qr-card">
                <h3 className="rd-qr-title">🔐 Secure Handover QR Code</h3>
                <p className="rd-qr-subtitle">Show this QR to the owner during item pickup/delivery</p>
                <canvas ref={canvasRef} className="rd-qr-canvas" />
                <p className="rd-qr-hash">Hash: {rental.qr_code_hash?.slice(0, 20)}…</p>
              </div>
            )}

            {/* Delivery Courier Status */}
            {deliveryInfo && deliveryInfo.has_delivery && (
              <div className="rd-delivery-section" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  🚚 Delivery Status
                </h4>
                {deliveryInfo.status === 'AVAILABLE' && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Waiting for a courier to accept your delivery request...</p>
                )}
                {deliveryInfo.status !== 'AVAILABLE' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Status</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: deliveryInfo.status === 'DELIVERED' ? '#22c55e' : '#6366f1' }}>
                        {{
                          ACCEPTED: '✅ Courier Assigned',
                          ARRIVING_FOR_PICKUP: '🚶 Heading to Seller',
                          PICKED_UP: '📋 Item Picked Up',
                          IN_TRANSIT: '🚚 On the Way',
                          ARRIVED: '📍 Courier Arrived',
                          DELIVERED: '🎉 Delivered!',
                        }[deliveryInfo.status] || deliveryInfo.status}
                      </div>
                    </div>
                    {deliveryInfo.courier_name && (
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Courier</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{deliveryInfo.courier_name}</div>
                      </div>
                    )}
                  </div>
                )}
                {/* Customer's Delivery Token — shown when courier needs to verify delivery */}
                {isBorrower && deliveryInfo.delivery_token && ['PICKED_UP','IN_TRANSIT','ARRIVED'].includes(deliveryInfo.status) && (
                  <div style={{ background: 'linear-gradient(135deg, #1a1040, #2d1b69)', borderRadius: 'var(--radius-md)', padding: '1.25rem', textAlign: 'center', marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Your Delivery Token</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, fontFamily: 'Courier New, monospace', letterSpacing: '0.25em', color: '#fff', userSelect: 'all' }}>
                      {deliveryInfo.delivery_token}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.4rem' }}>Show this token to the courier when they deliver your item</div>
                  </div>
                )}
              </div>
            )}

            {/* Status-specific messages */}
            {(rental.status === 'OWNER_PENDING' || rental.status === 'RENTAL_PAYMENT_COMPLETED') && isBorrower && (
              <div className="rd-info-banner rd-info-blue">
                <span>👀</span>
                <div style={{ flex: 1 }}>
                  <strong>Waiting for Owner</strong>
                  <p>Your booking payment was successful! The owner has been notified and will respond shortly.</p>
                  <button
                    className="rd-pay-deposit-btn"
                    style={{ marginTop: '1rem', backgroundColor: '#22C55E', color: '#ffffff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                    onClick={async () => {
                      if (rental.id.startsWith('mock-rental-')) {
                        localStorage.setItem(`mock_status_${rental.id}`, 'DEPOSIT_PENDING');
                        setRental(prev => ({
                          ...prev,
                          status: 'DEPOSIT_PENDING',
                          deposit_deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString()
                        }));
                      } else {
                        const token = localStorage.getItem('token');
                        try {
                          const res = await fetch(`${API_BASE}/api/rentals/respond`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              rental_id: rental.id,
                              response: 'ACCEPTED',
                              bypass_owner: true
                            })
                          });
                          if (!res.ok) {
                            const errData = await res.json();
                            throw new Error(errData.error || 'Failed to respond to booking.');
                          }
                          await fetchStatus();
                        } catch (err) {
                          alert('Failed to simulate owner acceptance: ' + err.message);
                        }
                      }
                    }}
                  >
                    ✓ Simulate Owner Acceptance (Test)
                  </button>
                </div>
              </div>
            )}

            {rental.status === 'CANCELLED' && (
              <div className="rd-info-banner rd-info-red">
                <span>❌</span>
                <div>
                  <strong>Booking Cancelled</strong>
                  <p>{rental.deposit_status === 'TIMEOUT'
                    ? 'Deposit payment deadline expired. Your booking was automatically cancelled.'
                    : 'This booking was cancelled by the owner. A refund will be processed per platform policy.'
                  }</p>
                </div>
              </div>
            )}

            {rental.status === 'RENTAL_ACTIVE' && isBorrower && (
              <div className="rd-action-section">
                <button
                  className="rd-return-btn"
                  onClick={() => navigate(`/rental-return/${rentalId}`)}
                >
                  ↩️ Request Return
                </button>
              </div>
            )}

            {error && <div className="rd-error-msg">⚠️ {error}</div>}
          </div>

          {/* Right — Payment Summary */}
          <div className="rd-right">
            <div className="rd-summary-card">
              <h3 className="rd-summary-title">💳 Payment Summary</h3>
              <div className="rd-summary-rows">
                <div className="rd-srow"><span>Rental Fee</span><span>{formatCurrency(rental.rental_fee)}</span></div>
                <div className="rd-srow"><span>Delivery Fee</span><span>{formatCurrency(rental.delivery_fee)}</span></div>
                <div className="rd-srow"><span>Platform Fee</span><span>{formatCurrency(rental.platform_fee)}</span></div>
                <div className="rd-divider" />
                <div className="rd-srow rd-srow-bold"><span>Booking Amount</span><span>{formatCurrency(rental.booking_amount)}</span></div>
                <div className="rd-srow rd-srow-deposit">
                  <span>Security Deposit</span>
                  <span className={`rd-deposit-status ${rental.deposit_status === 'PAID' ? 'paid' : ''}`}>
                    {rental.deposit_status === 'PAID' ? '✅ Paid' : `${formatCurrency(rental.deposit_amount)}`}
                  </span>
                </div>
              </div>

              {/* People */}
              <div className="rd-people">
                <div className="rd-person">
                  <span className="rd-person-role">Owner</span>
                  <span className="rd-person-name">{rental.owner_name}</span>
                  {isOwner && <span className="rd-you-badge">You</span>}
                </div>
                <div className="rd-person">
                  <span className="rd-person-role">Borrower</span>
                  <span className="rd-person-name">{rental.borrower_name}</span>
                  {isBorrower && <span className="rd-you-badge">You</span>}
                </div>
              </div>
            </div>

            {/* Payment History */}
            {payments.length > 0 && (
              <div className="rd-payment-history">
                <h4>📜 Transactions</h4>
                {payments.map((p) => (
                  <div key={p.id} className="rd-txn">
                    <div className="rd-txn-type">{p.payment_type.replace('_', ' ')}</div>
                    <div className="rd-txn-amount">{formatCurrency(p.amount)}</div>
                    <div className={`rd-txn-status ${p.status === 'PAID' ? 'paid' : 'pending'}`}>{p.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
