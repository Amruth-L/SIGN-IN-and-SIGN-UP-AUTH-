import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { openRazorpayCheckout } from '../utils/RazorpayService';
import './Checkout.css';

const formatCurrency = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, api } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Retrieve passed checkout state
  const checkoutData = location.state;
  if (!checkoutData || !checkoutData.cartItems || checkoutData.cartItems.length === 0) {
    return (
      <div className="checkout-page-empty">
        <div className="checkout-empty-card">
          <h2>No items to check out</h2>
          <p>Please return to your cart and proceed from there.</p>
          <button onClick={() => navigate('/cart')} className="checkout-btn">Go to Cart</button>
        </div>
      </div>
    );
  }

  const { cartItems, breakdown, selected_item_ids } = checkoutData;

  const handlePayment = async () => {
    setSubmitting(true);
    try {
      // 1. Build delivery_opted map
      const delivery_opted = {};
      cartItems.forEach(item => {
        delivery_opted[item.item_id || item.id] = !!item.deliveryOpted;
      });

      // 2. Call backend to create checkout order with selected item IDs
      const orderRes = await api.post('/api/payment/create-checkout-order', { 
        delivery_opted,
        selected_item_ids: selected_item_ids || cartItems.map(i => i.item_id || i.id)
      });
      const orderData = orderRes.data;

      // 3. Complete payment
      if (orderData.simulated) {
        console.log('[Checkout Simulation] Simulating payment success for order:', orderData.order_id);
        
        // Call backend to verify checkout directly
        const verifyRes = await api.post('/api/payment/verify-checkout', {
          gateway_order_id: orderData.order_id,
          gateway_payment_id: `pay_sim_${Math.random().toString(36).substr(2, 9)}`,
          gateway_signature: 'sim_sig'
        });

        // Trigger cart count update
        window.dispatchEvent(new Event('cart-updated'));

        navigate('/payment-success', {
          state: {
            message: 'All rental bookings submitted successfully! Awaiting owner acceptance.',
            actionText: 'Track Bookings',
            nextPath: '/profile',
            rentals: verifyRes.data?.rentals || []
          }
        });
      } else {
        // Run live Razorpay flow with exact backend calculated totalAmount
        const rzpOptions = {
          key: orderData.razorpay_key,
          amount: orderData.totalAmount || orderData.amount, // Exact backend totalAmount
          currency: orderData.currency || 'INR',
          name: 'CampusMesh',
          description: 'CampusMesh Student Rentals',
          order_id: orderData.order_id,
          prefill: {
            name: user?.name,
            email: user?.email,
            phone_number: user?.phone_number
          },
          handler: async (resp) => {
            try {
              const verifyRes = await api.post('/api/payment/verify-checkout', {
                gateway_order_id: resp.gateway_order_id || orderData.order_id,
                gateway_payment_id: resp.gateway_payment_id,
                gateway_signature: resp.gateway_signature
              });

              window.dispatchEvent(new Event('cart-updated'));

              navigate('/payment-success', {
                state: {
                  message: 'All rental bookings submitted successfully! Awaiting owner acceptance.',
                  actionText: 'Track Bookings',
                  nextPath: '/profile',
                  rentals: verifyRes.data?.rentals || []
                }
              });
            } catch (vErr) {
              console.error('[Checkout Verification Fail]', vErr);
              navigate('/payment-failed', {
                state: { error: vErr.response?.data?.error || 'Signature verification failed.', retryPath: '/cart' }
              });
            }
          },
          modalDismissHandler: () => {
            setSubmitting(false);
          }
        };

        await openRazorpayCheckout(rzpOptions);
      }
    } catch (err) {
      console.error('[Checkout Order Fail]', err);
      alert(err.response?.data?.error || 'Failed to initialize payment.');
      setSubmitting(false);
    }
  };

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <h1 className="checkout-title">Review & Pay</h1>
        <p className="checkout-subtitle">Verify your item dates and pay the booking fees to request items</p>

        <div className="checkout-layout">
          {/* Left panel: List of rentals */}
          <div className="checkout-details-list">
            {cartItems.map((item, index) => (
              <div key={index} className="checkout-item-card">
                {item.image_url && (
                  <img src={item.image_url} alt={item.title} className="checkout-item-img" />
                )}
                <div className="checkout-item-info">
                  <span className="checkout-item-cat">{item.category}</span>
                  <h3>{item.title}</h3>
                  <p className="checkout-item-dates">
                    🗓️ {new Date(item.start_date).toLocaleDateString()} to {new Date(item.end_date).toLocaleDateString()} ({item.days} days)
                  </p>
                  <p className="checkout-item-delivery">
                    📍 {item.deliveryOpted ? `Delivery requested (+${formatCurrency(item.delivery_charge)})` : 'Self-pickup'}
                  </p>
                  <div className="checkout-item-sub">
                    <span>Rental: {formatCurrency(item.subtotal)}</span>
                    <span className="checkout-deposit-label">Security Deposit (Refundable, paid later): {formatCurrency(item.deposit)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right panel: Summary breakdown */}
          <div className="checkout-summary-sidebar">
            <div className="checkout-summary-card">
              <h3>Order Summary</h3>
              
              <div className="checkout-breakdown">
                <div className="check-row">
                  <span>Selected Items</span>
                  <span>{cartItems.length} item{cartItems.length === 1 ? '' : 's'}</span>
                </div>
                <div className="check-row">
                  <span>Rental Total</span>
                  <span>{formatCurrency(breakdown.rentalTotal)}</span>
                </div>
                <div className="check-row">
                  <span>Platform Fee</span>
                  <span>{formatCurrency(breakdown.platformFee)}</span>
                </div>
                <div className="check-row">
                  <span>Delivery Total</span>
                  <span>{formatCurrency(breakdown.deliveryTotal)}</span>
                </div>
                
                <hr className="check-divider" />

                <div className="check-row" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span>📍 Distance</span>
                  <span>Campus Pickup (~0.5 km)</span>
                </div>
                <div className="check-row" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span>⏱️ Pickup ETA</span>
                  <span>5 - 10 mins Pickup</span>
                </div>

                <hr className="check-divider" />
                
                <div className="check-row grand-to-pay">
                  <span>Amount to Pay Now</span>
                  <span>{formatCurrency(breakdown.bookingTotal)}</span>
                </div>

                <div className="checkout-deposit-notice">
                  <span className="notice-icon">🛡️</span>
                  <div>
                    <strong>Security Deposits: {formatCurrency(breakdown.depositTotal)}</strong>
                    <p>Will be requested only after the item owners accept your request. No deposit is charged today.</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={handlePayment} 
                disabled={submitting}
                className="checkout-pay-btn"
              >
                {submitting ? 'Processing Payment...' : `Pay ${formatCurrency(breakdown.bookingTotal)} Now`}
              </button>

              <button 
                onClick={() => navigate('/cart')} 
                disabled={submitting}
                className="checkout-cancel-btn"
              >
                Back to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
