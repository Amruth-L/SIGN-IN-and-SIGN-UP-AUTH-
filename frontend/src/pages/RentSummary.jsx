import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Calendar, AlertTriangle, Lock, CheckCircle2, ClipboardList, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockProducts, mockSellers } from '../data/mockData';
import { openRazorpayCheckout } from '../utils/RazorpayService';
import './RentSummary.css';

const API_BASE = 'http://localhost:3003';

const formatCurrency = (n) => {
  const parsed = Number(n);
  if (isNaN(parsed)) return '₹0.00';
  return `₹${parsed.toFixed(2)}`;
};

const today = () => new Date().toISOString().split('T')[0];
const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export default function RentSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const queryParams = new URLSearchParams(location.search);
  const paramStart = queryParams.get('start_date');
  const paramEnd = queryParams.get('end_date');

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState(paramStart || today());
  const [endDate, setEndDate] = useState(paramEnd || addDays(today(), 1));
  const [submitting, setSubmitting] = useState(false);
  const [breakdown, setBreakdown] = useState(null);

  const isMock = id?.startsWith('mp-');

  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true);
      try {
        if (isMock) {
          const mock = mockProducts.find((p) => p.id === id);
          if (!mock) throw new Error('Mock product not found');
          
          // Find mock seller details to show the owner name properly
          const mockSeller = mockSellers.find((s) => s.id === mock.sellerId);
          
          setListing({
            id: mock.id,
            title: mock.title || mock.name || 'Listing Item',
            image_url: mock.image_url || mock.image || '',
            category: mock.category || 'Item',
            condition: mock.condition || 'Good',
            location: mock.location || 'Campus',
            rent_price: Number(mock.rentPrice || mock.rent_price || 0),
            deposit: Number(mock.deposit || 0),
            delivery_available: mock.deliveryAvailable || false,
            delivery_charge: Number(mock.deliveryCharge || 0),
            owner_name: mockSeller ? mockSeller.name : 'Student Seller',
          });
        } else {
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_BASE}/api/listings/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error('Failed to load listing');
          const data = await res.json();
          setListing(data);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [id]);

  useEffect(() => {
    if (!listing) return;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let days = 1;
    if (startDate && endDate && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      days = Math.max(1, diffDays);
    }

    const fetchPricingBreakdown = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/pricing/calculate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            listing_id: isMock ? null : listing.id,
            daily_rent: listing.rent_price || listing.rentPrice || 0,
            rental_days: days,
            delivery_type: (listing.delivery_available || listing.deliveryAvailable) ? 'STANDARD' : 'SELF_PICKUP',
            owner_location: listing.location || '',
            item_value: listing.price || 0,
            custom_deposit: listing.deposit
          })
        });
        const data = await res.json();
        setBreakdown({
          days,
          rentalFee: data.rentalFee,
          deliveryFee: data.deliveryFee,
          platformFee: data.platformFee,
          bookingAmount: data.totalAmount,
          depositAmount: data.securityDeposit,
          distance: data.distance,
          estimatedTime: data.estimatedTime
        });
      } catch (err) {
        console.error('Failed to calculate pricing breakdown from API:', err);
      }
    };

    fetchPricingBreakdown();
  }, [startDate, endDate, listing]);

  const handleBook = async (e) => {
    e.preventDefault();
    console.log('[Frontend Debug] handleBook triggered. Breakdown details:', breakdown);
    if (!breakdown || submitting || breakdown.bookingAmount <= 0) {
      console.warn('[Frontend Debug] handleBook validation failed. Breakdown missing or amount <= 0.');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      console.log('[Frontend Debug] Retrieve user token:', token ? 'Token exists' : 'Token missing');
      
      let rentalId = '';
      let bookingAmount = breakdown.bookingAmount;
      
      if (isMock) {
        // Generate simulated rental ID including the mock listing ID
        rentalId = `mock-rental-${id}-${Date.now()}`;
      } else {
        console.log('[Frontend Debug] Requesting booking creation from backend...');
        const res = await fetch(`${API_BASE}/api/rentals/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ listing_id: id, start_date: startDate, end_date: endDate }),
        });
        const data = await res.json();
        console.log('[Frontend Debug] Booking creation response:', data);
        if (!res.ok) throw new Error(data.error || 'Failed to create rental request.');
        
        rentalId = data.rental.id;
        bookingAmount = Number(data.rental.booking_amount || breakdown.bookingAmount);
      }
      
      console.log('[Frontend Debug] Requesting payment order details from backend...');
      let orderData;
      if (isMock) {
        orderData = {
          order_id: `sim_order_${Math.random().toString(36).substr(2, 9)}`,
          amount: bookingAmount,
          razorpay_key: 'SIMULATION_MODE',
          simulated: true
        };
        console.log('[Frontend Debug] Mock product detected. Simulated orderData:', orderData);
      } else {
        const orderRes = await fetch(`${API_BASE}/api/payment/create-rental-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ booking_id: rentalId })
        });
        orderData = await orderRes.json();
        console.log('[Frontend Debug] Payment order creation response:', orderData);
        if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create payment order.');
      }
      
      const paymentAmount = Number(orderData.amount || bookingAmount);
      console.log('[Frontend Debug] Parsed paymentAmount in INR:', paymentAmount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        throw new Error('Invalid payment amount calculated by the system.');
      }
      
      let razorpayKey = orderData.razorpay_key;
      if (!razorpayKey || razorpayKey === 'SIMULATION_MODE' || razorpayKey === 'SIMULATION') {
        razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TJCbHTYQTsOUNU';
      }

      // Step 3: Launch Razorpay checkout
      console.log('[Frontend Debug] Launching Razorpay checkout with data:', {
        simulated: orderData.simulated,
        order_id: orderData.order_id,
        amount: paymentAmount,
        key: razorpayKey
      });

      const razorpayOptions = {
        key: razorpayKey,
        amount: paymentAmount,
        currency: orderData.currency || 'INR',
        name: 'CampusMesh',
        description: 'Rental Payment',
        prefill: {
          name: user?.name,
          email: user?.email
        },
        handler: async (resp) => {
          console.log('[Frontend Debug] Razorpay payment completed successfully. Response:', resp);
          try {
            if (isMock) {
              console.log('[Frontend Debug] Mock item detected, navigating directly to success page');
              navigate('/payment-success', {
                state: {
                  message: 'Rental charges paid successfully! Booking request submitted to owner.',
                  actionText: 'Track Rental Status',
                  nextPath: `/rent-details/${rentalId}`
                }
              });
              return;
            }

            console.log('[Frontend Debug] Verifying signature with backend...');
            const verifyRes = await fetch(`${API_BASE}/api/payment/verify-rental`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                booking_id: rentalId,
                gateway_order_id: resp.gateway_order_id || orderData.order_id,
                gateway_payment_id: resp.gateway_payment_id,
                gateway_signature: resp.gateway_signature || 'sim_sig'
              })
            });
            const verifyData = await verifyRes.json();
            console.log('[Frontend Debug] Verification response:', verifyData);
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Signature verification failed.');
            
            navigate('/payment-success', {
              state: {
                message: 'Rental charges paid successfully! Booking request submitted to owner.',
                actionText: 'Track Rental Status',
                nextPath: `/rent-details/${rentalId}`
              }
            });
          } catch (vErr) {
            console.error('[Frontend Debug] Verification failed:', vErr);
            navigate('/payment-failed', {
              state: { error: vErr.message, retryPath: `/rent-summary/${id}` }
            });
          }
        },
        modalDismissHandler: () => {
          console.log('[Frontend Debug] Razorpay checkout dismissed by user.');
          setSubmitting(false);
        }
      };

      if (!orderData.simulated) {
        razorpayOptions.order_id = orderData.order_id;
      }

      console.log('[Frontend Debug] Invoking openRazorpayCheckout with options:', razorpayOptions);
      await openRazorpayCheckout(razorpayOptions);
      console.log('[Frontend Debug] openRazorpayCheckout invoked successfully.');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rs-loading">
        <div className="rs-spinner" />
        <p>Loading item details...</p>
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div className="rs-error-page" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <AlertTriangle size={32} style={{ color: '#ef4444', display: 'block', margin: '0 auto 12px auto' }} />
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="rs-back-btn">Go Back</button>
      </div>
    );
  }

  const isBtnDisabled = !breakdown || submitting || breakdown.bookingAmount <= 0;

  return (
    <div className="rs-page">
      <div className="rs-container">
        {/* Header */}
        <div className="rs-header">
          <button className="rs-back-btn" onClick={() => navigate(-1)}>← Back</button>
          <h1 className="rs-title">Booking Summary</h1>
          <p className="rs-subtitle">Review your rental before confirming payment</p>
        </div>

        <div className="rs-layout">
          {/* Left Column — Item Details & Date Picker */}
          <div className="rs-left">
            {/* Item Card */}
            <div className="rs-item-card">
              {listing.image_url && (
                <img src={listing.image_url} alt={listing.title} className="rs-item-img" />
              )}
              <div className="rs-item-info">
                <span className="rs-category-badge">{listing.category}</span>
                <h2 className="rs-item-title">{listing.title}</h2>
                <div className="rs-item-meta">
                  <span className="rs-condition">{listing.condition}</span>
                  <span className="rs-location" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <MapPin size={12} strokeWidth={2} /> {listing.location}
                  </span>
                </div>
                <div className="rs-owner-info">
                  Owner: <strong>{listing.owner_name}</strong>
                </div>
              </div>
            </div>

            {/* Date Selection */}
            <div className="rs-date-section">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} strokeWidth={2} /> Select Rental Period
              </h3>
              <form onSubmit={handleBook} className="rs-date-form">
                <div className="rs-date-row">
                  <div className="rs-date-field">
                    <label htmlFor="start-date">Start Date</label>
                    <input
                      id="start-date"
                      type="date"
                      min={today()}
                      value={startDate}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setStartDate(newStart);
                        const sD = new Date(newStart);
                        const eD = new Date(endDate);
                        if (eD <= sD) {
                          setEndDate(addDays(newStart, 1));
                        }
                      }}
                    />
                  </div>
                  <div className="rs-date-field">
                    <label htmlFor="end-date">End Date</label>
                    <input
                      id="end-date"
                      type="date"
                      min={addDays(startDate, 1)}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                {breakdown && (
                  <div className="rs-duration-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} strokeWidth={2} /> {breakdown.days} Day{breakdown.days > 1 ? 's' : ''} Rental
                  </div>
                )}
                {error && <div className="rs-error-msg" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> {error}</div>}
                
                <button
                  type="submit"
                  className="rs-pay-btn"
                  disabled={isBtnDisabled}
                >
                  {submitting ? 'Processing…' : `Pay ${breakdown ? formatCurrency(breakdown.bookingAmount) : '₹0.00'} Now`}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column — Breakdown & Security Deposit */}
          <div className="rs-right">
            {/* Booking Summary Card */}
            <div className="rs-breakdown-card">
              <h3 className="rs-breakdown-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ClipboardList size={16} strokeWidth={2} /> Booking Summary
              </h3>

              {breakdown ? (
                <div className="rs-breakdown-rows">
                  <div className="rs-row">
                    <span>Daily Rent</span>
                    <span>{formatCurrency(listing.rent_price || listing.rentPrice)}</span>
                  </div>
                  <div className="rs-row">
                    <span>Rental Days</span>
                    <span>{breakdown.days} day{breakdown.days > 1 ? 's' : ''}</span>
                  </div>
                  <div className="rs-row rs-row-value">
                    <span>Rental Fee</span>
                    <span>{formatCurrency(breakdown.rentalFee)}</span>
                  </div>
                  <div className="rs-row">
                    <span>Delivery Fee</span>
                    <span>{(listing.delivery_available || listing.deliveryAvailable) ? formatCurrency(breakdown.deliveryFee) : 'Free (Pickup)'}</span>
                  </div>
                  <div className="rs-row">
                    <span>Platform Fee</span>
                    <span>{formatCurrency(breakdown.platformFee)}</span>
                  </div>
                  <div className="rs-divider" />
                  <div className="rs-row rs-row-total">
                    <span>Booking Total</span>
                    <span>{formatCurrency(breakdown.bookingAmount)}</span>
                  </div>
                </div>
              ) : (
                <div className="rs-breakdown-empty">
                  <p>Select valid rental dates to see the breakdown</p>
                </div>
              )}
            </div>

            {/* Security Deposit Card */}
            {breakdown && (
              <div className="rs-deposit-card">
                <h3 className="rs-deposit-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={15} strokeWidth={2} /> Security Deposit
                </h3>
                <div className="rs-deposit-amount">{formatCurrency(breakdown.depositAmount)}</div>
                <p className="rs-deposit-note">Collected only after owner accepts booking.</p>
                <p className="rs-refund-note" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                  <span>This amount is fully refundable after the owner confirms the item has been returned in good condition.</span>
                </p>
              </div>
            )}

            <div className="rs-policy-box">
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                <ClipboardList size={14} strokeWidth={2} /> Rental Policy
              </h4>
              <ul>
                <li>Owner must accept your booking request</li>
                <li>Security deposit due within 30 mins of acceptance</li>
                <li>A secure QR code will be generated for item handover</li>
                <li>Deposit refunded upon undamaged return</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
