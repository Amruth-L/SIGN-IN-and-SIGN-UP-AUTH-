import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Cart.css';

const formatCurrency = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

export default function Cart() {
  const { api, user } = useAuth();
  const navigate = useNavigate();

  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  // Track selected items for checkout: array of cart item IDs
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  // Track delivery option opted per cart item: { [cartItemId]: boolean }
  const [deliveryOptions, setDeliveryOptions] = useState({});

  const fetchCart = async () => {
    try {
      const res = await api.get('/api/cart');
      setCartItems(res.data);
      
      // Initialize delivery options & select all items by default
      const deliveryMap = {};
      const allIds = res.data.map(item => item.id);
      res.data.forEach(item => {
        deliveryMap[item.id] = false;
      });
      setDeliveryOptions(prev => ({ ...deliveryMap, ...prev }));
      setSelectedItemIds(allIds);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load cart.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchCart();
  }, [user]);

  const toggleSelectItem = (id) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === cartItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(cartItems.map(item => item.id));
    }
  };

  const handleRemove = async (id) => {
    try {
      await api.delete(`/api/cart/${id}`);
      setCartItems(prev => prev.filter(item => item.id !== id));
      setSelectedItemIds(prev => prev.filter(itemId => itemId !== id));
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove item.');
    }
  };

  const handleDateChange = async (id, startDate, endDate) => {
    if (!startDate || !endDate) return;
    if (new Date(endDate) < new Date(startDate)) {
      alert('End date cannot be before start date.');
      return;
    }

    setUpdatingId(id);
    try {
      const res = await api.put(`/api/cart/${id}`, {
        start_date: startDate,
        end_date: endDate
      });
      
      // Update local state
      setCartItems(prev => prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            start_date: res.data.cartItem.start_date,
            end_date: res.data.cartItem.end_date,
            days: res.data.cartItem.days,
            subtotal: res.data.cartItem.subtotal
          };
        }
        return item;
      }));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update dates.');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleDelivery = (id) => {
    setDeliveryOptions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filter selected cart items for calculations
  const selectedCartItems = cartItems.filter(item => selectedItemIds.includes(item.id));
  const selectedCount = selectedCartItems.length;

  // Dynamic Pricing Calculations for SELECTED items only
  const rentalTotal = selectedCartItems.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);
  const depositTotal = selectedCartItems.reduce((sum, item) => sum + parseFloat(item.deposit || 0), 0);
  const deliveryTotal = selectedCartItems.reduce((sum, item) => {
    const isOpted = deliveryOptions[item.id];
    const charge = isOpted ? parseFloat(item.delivery_charge || 0) : 0;
    return sum + charge;
  }, 0);
  
  // Flat Platform Fee = ₹5.00 if any selected, else 0
  const platformFee = selectedCount > 0 ? 5.00 : 0.00;
  const bookingTotal = rentalTotal + platformFee + deliveryTotal;
  const grandTotal = bookingTotal + depositTotal;

  const handleCheckout = () => {
    if (selectedCount === 0) {
      alert('Please select at least one item to proceed with checkout.');
      return;
    }
    
    // Package selected items and pass to Checkout page
    navigate('/checkout', {
      state: {
        cartItems: selectedCartItems.map(item => ({
          ...item,
          deliveryOpted: !!deliveryOptions[item.id]
        })),
        selected_item_ids: selectedCartItems.map(item => item.item_id || item.id),
        breakdown: {
          rentalTotal,
          depositTotal,
          deliveryTotal,
          platformFee,
          bookingTotal,
          grandTotal,
          selectedCount
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="cart-loading">
        <div className="cart-spinner" />
        <p>Loading your shopping cart...</p>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-container">
        <h1 className="cart-title">Your Cart</h1>
        <p className="cart-subtitle">Select items, review dates, and customize delivery before checkout</p>

        {error && <div className="cart-error-msg">⚠️ {error}</div>}

        {cartItems.length === 0 ? (
          <div className="cart-empty-state">
            <span className="cart-empty-icon">🛒</span>
            <h2>Your cart is empty</h2>
            <p>Looks like you haven't added any rental items yet.</p>
            <Link to="/" className="cart-browse-btn">Browse Products</Link>
          </div>
        ) : (
          <div className="cart-layout">
            {/* Left side: Cart items list */}
            <div className="cart-items-list">
              <div className="cart-select-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  <input 
                    type="checkbox"
                    checked={selectedItemIds.length === cartItems.length && cartItems.length > 0}
                    onChange={toggleSelectAll}
                    style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
                  />
                  <span>Select All Items ({selectedCount}/{cartItems.length})</span>
                </label>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Only selected items are processed at checkout</span>
              </div>

              {cartItems.map(item => {
                const todayStr = new Date().toISOString().split('T')[0];
                const formattedStartDate = new Date(item.start_date).toISOString().split('T')[0];
                const formattedEndDate = new Date(item.end_date).toISOString().split('T')[0];
                const isSelected = selectedItemIds.includes(item.id);

                return (
                  <div key={item.id} className={`cart-item-card ${!isSelected ? 'unselected-card' : ''}`} style={{ opacity: isSelected ? 1 : 0.65, border: isSelected ? '1px solid var(--border-color)' : '1px dashed #d1d5db', transition: 'all 0.2s ease' }}>
                    <div style={{ padding: '12px 16px 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item.id)}
                        style={{ width: '20px', height: '20px', accentColor: '#10b981', cursor: 'pointer' }}
                        id={`cart-item-select-${item.id}`}
                      />
                      <label htmlFor={`cart-item-select-${item.id}`} style={{ fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', color: isSelected ? '#10b981' : '#6b7280' }}>
                        {isSelected ? '✓ Selected for Booking' : 'Click to select this item'}
                      </label>
                    </div>

                    <div style={{ display: 'flex', padding: '16px', gap: '16px' }}>
                      {item.image_url && (
                        <img src={item.image_url} alt={item.title} className="cart-item-img" loading="lazy" />
                      )}
                      <div className="cart-item-details" style={{ flex: 1 }}>
                        <div className="cart-item-header">
                          <div>
                            <span className="cart-item-cat">{item.category}</span>
                            <h3 className="cart-item-name">{item.title}</h3>
                            <p className="cart-item-owner">Owner: {item.owner_name}</p>
                          </div>
                          <button 
                            className="cart-remove-btn" 
                            onClick={() => handleRemove(item.id)}
                            aria-label="Remove item"
                          >
                            Remove
                          </button>
                        </div>

                        {/* Date selectors */}
                        <div className="cart-date-selectors">
                          <div className="form-group">
                            <label className="form-label">Start Date</label>
                            <input 
                              type="date"
                              className="form-input"
                              min={todayStr}
                              value={formattedStartDate}
                              onChange={(e) => handleDateChange(item.id, e.target.value, formattedEndDate)}
                              disabled={updatingId === item.id}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">End Date</label>
                            <input 
                              type="date"
                              className="form-input"
                              min={formattedStartDate}
                              value={formattedEndDate}
                              onChange={(e) => handleDateChange(item.id, formattedStartDate, e.target.value)}
                              disabled={updatingId === item.id}
                            />
                          </div>
                        </div>

                        {/* Delivery option */}
                        {item.delivery_available && (
                          <div className="cart-delivery-option">
                            <label className="cart-checkbox-label">
                              <input 
                                type="checkbox"
                                checked={deliveryOptions[item.id] || false}
                                onChange={() => toggleDelivery(item.id)}
                                disabled={!isSelected}
                              />
                              <span>Opt for delivery (+{formatCurrency(item.delivery_charge)})</span>
                            </label>
                          </div>
                        )}

                        {/* Pricing row */}
                        <div className="cart-pricing-row">
                          <div className="pricing-col">
                            <span className="col-label">Duration</span>
                            <span className="col-value">{item.days} Day{item.days > 1 ? 's' : ''}</span>
                          </div>
                          <div className="pricing-col">
                            <span className="col-label">Rate</span>
                            <span className="col-value">{formatCurrency(item.price_per_day)}/day</span>
                          </div>
                          <div className="pricing-col">
                            <span className="col-label">Security Deposit</span>
                            <span className="col-value">{formatCurrency(item.deposit)}</span>
                          </div>
                          <div className="pricing-col subtotal-col">
                            <span className="col-label">Subtotal</span>
                            <span className="col-value">{formatCurrency(item.subtotal)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right side: Summary panel */}
            <div className="cart-summary-panel">
              <div className="cart-summary-card">
                <h3>Order Summary</h3>
                <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #bbf7d0', fontSize: '0.85rem', color: '#166534' }}>
                  📦 <strong>{selectedCount}</strong> item{selectedCount === 1 ? '' : 's'} selected for checkout
                </div>

                <div className="summary-rows">
                  <div className="srow">
                    <span>Selected Items</span>
                    <span>{selectedCount} item{selectedCount === 1 ? '' : 's'}</span>
                  </div>
                  <div className="srow">
                    <span>Rental Subtotal</span>
                    <span>{formatCurrency(rentalTotal)}</span>
                  </div>
                  <div className="srow">
                    <span>Platform Fee</span>
                    <span>{formatCurrency(platformFee)}</span>
                  </div>
                  <div className="srow">
                    <span>Delivery Fees</span>
                    <span>{formatCurrency(deliveryTotal)}</span>
                  </div>
                  <div className="srow highlight">
                    <span>Booking Total</span>
                    <span>{formatCurrency(bookingTotal)}</span>
                  </div>
                  <hr className="divider" />
                  <div className="srow">
                    <span>Security Deposit (Refundable)</span>
                    <span>{formatCurrency(depositTotal)}</span>
                  </div>
                  <div className="srow" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingTop: '6px' }}>
                    <span>📍 Distance</span>
                    <span>Campus Pickup (~0.5 km)</span>
                  </div>
                  <div className="srow" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span>⏱️ Pickup ETA</span>
                    <span>5 - 10 mins Pickup</span>
                  </div>
                  <hr className="divider" />
                  <div className="srow grand-total">
                    <span>Amount to Pay Now</span>
                    <span>{formatCurrency(bookingTotal)}</span>
                  </div>
                </div>

                <button 
                  className="cart-checkout-btn" 
                  onClick={handleCheckout}
                  disabled={selectedCount === 0}
                  style={{ opacity: selectedCount === 0 ? 0.5 : 1, cursor: selectedCount === 0 ? 'not-allowed' : 'pointer' }}
                >
                  {selectedCount === 0 ? 'Select items to checkout' : `Proceed to Checkout (${selectedCount})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
