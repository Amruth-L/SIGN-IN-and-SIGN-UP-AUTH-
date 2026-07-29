import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { openRazorpayCheckout } from '../utils/RazorpayService';
import { mockProducts } from '../data/mockData';
import PaymentSummary from '../components/PaymentSummary';
import './Payment.css';

const API_BASE = 'http://localhost:3003';

export default function DepositPayment() {
  const { id } = useParams(); // Booking/Rental ID
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const fetchBookingDetails = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`${API_BASE}/api/rentals/${id}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch booking details.');

        // Resolve correct mock product details if mock rental
        if (id && id.startsWith('mock-rental-')) {
          const parts = id.split('-');
          const mockProductId = parts.slice(2, parts.length - 1).join('-');
          const mockItem = mockProducts.find(p => p.id === mockProductId);
          if (mockItem) {
            data.rental.listing_title = mockItem.title;
            data.rental.listing_category = mockItem.category;
            data.rental.listing_image = mockItem.image_url;
            data.rental.listing_location = mockItem.location;
            data.rental.deposit_amount = Number(mockItem.deposit || 0);
          }
        }

        setBooking(data.rental);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBookingDetails();
  }, [id]);

  const handlePayment = async () => {
    if (!booking) return;
    setPaying(true);
    setError('');
    const token = localStorage.getItem('token');

    try {
      // Create Razorpay Order on Backend for Security Deposit only
      const orderRes = await fetch(`${API_BASE}/api/payment/create-deposit-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ booking_id: id })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create deposit order.');

      // If simulated order in test mode, automate verification
      // Open Razorpay Checkout (supports simulated mode)
      let razorpayKey = orderData.razorpay_key;
      if (!razorpayKey || razorpayKey === 'SIMULATION_MODE' || razorpayKey === 'SIMULATION') {
        razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TJCbHTYQTsOUNU';
      }

      const razorpayOptions = {
        key: razorpayKey,
        amount: Number(orderData.amount || booking.deposit_amount),
        description: `Security Deposit for: ${booking.listing_title}`,
        prefill: {
          name: user?.name,
          email: user?.email
        },
        handler: async (resp) => {
          try {
            const verifyRes = await fetch(`${API_BASE}/api/payment/verify-deposit`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                booking_id: id,
                gateway_order_id: resp.gateway_order_id || orderData.order_id,
                gateway_payment_id: resp.gateway_payment_id,
                gateway_signature: resp.gateway_signature || 'sim_sig'
              })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Signature verification failed.');

            if (id.startsWith('mock-rental-')) {
              localStorage.setItem(`mock_status_${id}`, 'QR_GENERATED');
            }

            navigate('/payment-success', {
              state: {
                message: 'Security deposit paid successfully! Secure Handover QR Code has been generated.',
                actionText: 'Get Pickup QR Code',
                nextPath: `/rent-details/${id}`
              }
            });
          } catch (vErr) {
            navigate('/payment-failed', {
              state: { error: vErr.message, retryPath: `/deposit-payment/${id}` }
            });
          }
        },
        modalDismissHandler: () => {
          setPaying(false);
        }
      };

      if (!orderData.simulated) {
        razorpayOptions.order_id = orderData.order_id;
      }

      await openRazorpayCheckout(razorpayOptions);
    } catch (err) {
      setError(err.message);
      setPaying(false);
      navigate('/payment-failed', {
        state: { error: err.message, retryPath: `/deposit-payment/${id}` }
      });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--primary-color)' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(16, 185, 129, 0.2)',
          borderTopColor: 'var(--primary-color)',
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite'
        }} />
        <p style={{ marginTop: '20px' }}>Loading deposit details...</p>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#ef4444' }}>
        <span style={{ fontSize: '2rem' }}>⚠️</span>
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="payment-btn-outline" style={{ marginTop: '16px' }}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <div className="payment-container">
        <h1 className="payment-title">
          🔒 Pay Refundable Security Deposit
        </h1>

        <div className="payment-alert">
          <strong>💡 Owner Accepted Your Booking Request!</strong><br />
          To secure the item and enable the pickup QR code, you must submit the refundable security deposit.
        </div>

        {/* Info Card */}
        <div className="payment-card payment-item-header">
          {booking.listing_image && (
            <img src={booking.listing_image} alt={booking.listing_title} className="payment-item-img" />
          )}
          <div className="payment-item-info">
            <span className="payment-badge">{booking.listing_category}</span>
            <h3 className="payment-item-title">{booking.listing_title}</h3>
            <p className="payment-item-meta">📍 Pickup Location: {booking.listing_location}</p>
          </div>
        </div>

        {/* Payment Summary focusing on Security Deposit */}
        <PaymentSummary
          dailyPrice={parseFloat(booking.rental_fee) / booking.rental_days}
          days={booking.rental_days}
          rentalFee={booking.rental_fee}
          deliveryFee={booking.delivery_fee}
          platformFee={booking.platform_fee}
          totalAmount={booking.booking_amount}
          depositAmount={booking.deposit_amount}
          showDepositOnly={true}
        />

        {error && <div style={{ color: '#ef4444', background: '#fef2f2', padding: '12px', borderRadius: '8px', margin: '16px 0', border: '1px solid #fecaca' }}>⚠️ {error}</div>}

        {/* Pay Button */}
        <div style={{ marginTop: '24px' }}>
          <button
            onClick={handlePayment}
            disabled={paying}
            className="payment-btn-primary"
          >
            {paying ? 'Launching Payment Gateway...' : `Pay Security Deposit ${formatCurrency(booking.deposit_amount)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

const formatCurrency = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
