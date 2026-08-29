import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './DeliveryDashboard.css';

const API_BASE = 'http://localhost:3003';
const formatCurrency = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

const DELIVERY_STEPS = [
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'ARRIVING_FOR_PICKUP', label: 'Heading to Seller' },
  { key: 'PICKED_UP', label: 'Picked Up' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'ARRIVED', label: 'Arrived' },
  { key: 'DELIVERED', label: 'Delivered' },
];

const STATUS_LABELS = {
  AVAILABLE: { label: 'Available', color: '#6366f1', icon: '📦' },
  ACCEPTED: { label: 'Accepted', color: '#3b82f6', icon: '✅' },
  ARRIVING_FOR_PICKUP: { label: 'Heading to Pickup', color: '#f59e0b', icon: '🚶' },
  PICKED_UP: { label: 'Picked Up', color: '#8b5cf6', icon: '📋' },
  IN_TRANSIT: { label: 'In Transit', color: '#6366f1', icon: '🚚' },
  ARRIVED: { label: 'Arrived at Drop', color: '#10b981', icon: '📍' },
  DELIVERED: { label: 'Delivered', color: '#22c55e', icon: '🎉' },
};

export default function DeliveryDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('available');
  const [stats, setStats] = useState({ available: 0, active: 0, completed: 0, totalEarned: 0 });
  const [available, setAvailable] = useState([]);
  const [myDeliveries, setMyDeliveries] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [tokenInput, setTokenInput] = useState({});
  const [tokenError, setTokenError] = useState({});
  const [confirmModal, setConfirmModal] = useState(null);

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/delivery/stats`, { headers });
      if (res.ok) setStats(await res.json());
    } catch {}
  }, [token]);

  const fetchAvailable = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/delivery/available`, { headers });
      if (res.ok) setAvailable(await res.json());
    } catch {}
  }, [token]);

  const fetchMyDeliveries = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/delivery/my-deliveries`, { headers });
      if (res.ok) setMyDeliveries(await res.json());
    } catch {}
  }, [token]);

  const fetchEarnings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/delivery/earnings`, { headers });
      if (res.ok) setEarnings(await res.json());
    } catch {}
  }, [token]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchAvailable(), fetchMyDeliveries(), fetchEarnings()]);
    setLoading(false);
  }, [fetchStats, fetchAvailable, fetchMyDeliveries, fetchEarnings]);

  useEffect(() => { fetchAll(); }, []);

  // Poll every 20s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      if (activeTab === 'available') fetchAvailable();
      if (activeTab === 'my-deliveries') fetchMyDeliveries();
      if (activeTab === 'earnings') fetchEarnings();
    }, 20000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // ── Actions ──
  const doAction = async (deliveryId, endpoint, method = 'POST', body = null) => {
    setActionLoading(prev => ({ ...prev, [deliveryId]: endpoint }));
    try {
      const res = await fetch(`${API_BASE}/api/delivery/${deliveryId}/${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchAll();
      return data;
    } catch (err) {
      alert(err.message);
      return null;
    } finally {
      setActionLoading(prev => ({ ...prev, [deliveryId]: null }));
    }
  };

  const handleAccept = (d) => {
    setConfirmModal({
      title: 'Accept Delivery?',
      text: `You'll deliver "${d.listing_title}" from ${d.pickup_location} to ${d.drop_location}. You'll earn ${formatCurrency(d.courier_earning)}.`,
      onConfirm: async () => {
        setConfirmModal(null);
        await doAction(d.id, 'accept');
        setActiveTab('my-deliveries');
      },
    });
  };

  const handleDeny = async (d) => {
    await doAction(d.id, 'deny');
  };

  const handleVerifyToken = async (deliveryId, type) => {
    const key = `${deliveryId}_${type}`;
    const inputToken = tokenInput[key];
    if (!inputToken || inputToken.trim().length === 0) {
      setTokenError(prev => ({ ...prev, [key]: 'Please enter the token.' }));
      return;
    }
    setTokenError(prev => ({ ...prev, [key]: '' }));

    const endpoint = type === 'pickup' ? 'verify-pickup' : 'verify-delivery';
    const result = await doAction(deliveryId, endpoint, 'POST', { token: inputToken.trim() });
    if (!result) {
      setTokenError(prev => ({ ...prev, [key]: 'Invalid token. Please try again.' }));
    } else {
      setTokenInput(prev => ({ ...prev, [key]: '' }));
    }
  };

  // ── Delivery step index helper ──
  const getStepIndex = (status) => {
    const idx = DELIVERY_STEPS.findIndex(s => s.key === status);
    return idx >= 0 ? idx : -1;
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="dd-loading">
        <div className="dd-spinner" />
        <p>Loading Delivery Dashboard…</p>
      </div>
    );
  }

  const activeDeliveries = myDeliveries.filter(d => d.status !== 'DELIVERED');
  const completedDeliveries = myDeliveries.filter(d => d.status === 'DELIVERED');

  return (
    <div className="dd-page">
      <div className="dd-container">

        {/* Header */}
        <div className="dd-header">
          <div className="dd-header-top">
            <div className="dd-brand">
              <div className="dd-brand-icon">🚚</div>
              <div>
                <h1 className="dd-title">CampusMesh Delivery</h1>
                <p className="dd-subtitle">Earn by delivering items while you're already travelling around campus.</p>
              </div>
            </div>
            <button className="dd-refresh-btn" onClick={fetchAll}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="dd-stats">
          <div className="dd-stat-card stat-available">
            <span className="dd-stat-label">Available Requests</span>
            <span className="dd-stat-value">{stats.available}</span>
          </div>
          <div className="dd-stat-card stat-active">
            <span className="dd-stat-label">Active Delivery</span>
            <span className="dd-stat-value">{stats.active}</span>
          </div>
          <div className="dd-stat-card stat-completed">
            <span className="dd-stat-label">Completed</span>
            <span className="dd-stat-value">{stats.completed}</span>
          </div>
          <div className="dd-stat-card stat-earnings">
            <span className="dd-stat-label">Total Earned</span>
            <span className="dd-stat-value">{formatCurrency(stats.totalEarned)}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="dd-tabs">
          <button className={`dd-tab ${activeTab === 'available' ? 'dd-tab-active' : ''}`} onClick={() => setActiveTab('available')}>
            Available
            {stats.available > 0 && <span className="dd-tab-badge">{stats.available}</span>}
          </button>
          <button className={`dd-tab ${activeTab === 'my-deliveries' ? 'dd-tab-active' : ''}`} onClick={() => setActiveTab('my-deliveries')}>
            My Deliveries
            {stats.active > 0 && <span className="dd-tab-badge">{stats.active}</span>}
          </button>
          <button className={`dd-tab ${activeTab === 'earnings' ? 'dd-tab-active' : ''}`} onClick={() => setActiveTab('earnings')}>
            Earnings
          </button>
        </div>

        {/* ── Tab: Available Requests ── */}
        {activeTab === 'available' && (
          available.length === 0 ? (
            <div className="dd-empty">
              <div className="dd-empty-icon">📭</div>
              <div className="dd-empty-text">No delivery requests right now</div>
              <div className="dd-empty-sub">Check back later or refresh to see new requests.</div>
              <button className="dd-btn dd-btn-outline" onClick={fetchAll}>🔄 Refresh Requests</button>
            </div>
          ) : (
            <div className="dd-grid">
              {available.map(d => (
                <div className="dd-card" key={d.id}>
                  <div className="dd-card-header">
                    {d.listing_image && (
                      <img src={d.listing_image} alt={d.listing_title} className="dd-card-img" />
                    )}
                    <div className="dd-card-info">
                      <h3 className="dd-card-title">{d.listing_title || 'Item'}</h3>
                      <div className="dd-card-seller">Seller: {d.seller_name || 'Unknown'}</div>
                    </div>
                  </div>
                  <div className="dd-card-body">
                    <div className="dd-detail">
                      <span className="dd-detail-label">Pickup</span>
                      <span className="dd-detail-value">📍 {d.pickup_location}</span>
                    </div>
                    <div className="dd-detail">
                      <span className="dd-detail-label">Drop</span>
                      <span className="dd-detail-value">🏠 {d.drop_location}</span>
                    </div>
                    <div className="dd-detail">
                      <span className="dd-detail-label">Distance</span>
                      <span className="dd-detail-value">{parseFloat(d.distance).toFixed(1)} km</span>
                    </div>
                    <div className="dd-detail">
                      <span className="dd-detail-label">Est. Time</span>
                      <span className="dd-detail-value">⏱ {d.estimated_time}</span>
                    </div>
                    <div className="dd-detail">
                      <span className="dd-detail-label">Delivery Earning</span>
                      <span className="dd-detail-value earning">{formatCurrency(d.courier_earning)}</span>
                    </div>
                    <div className="dd-detail">
                      <span className="dd-detail-label">Requested</span>
                      <span className="dd-detail-value">{new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="dd-card-footer">
                    <button
                      className="dd-btn dd-btn-danger"
                      onClick={() => handleDeny(d)}
                      disabled={!!actionLoading[d.id]}
                    >
                      ✕ Deny
                    </button>
                    <button
                      className="dd-btn dd-btn-primary"
                      onClick={() => handleAccept(d)}
                      disabled={!!actionLoading[d.id]}
                    >
                      {actionLoading[d.id] === 'accept' ? '...' : '✓ Accept'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Tab: My Deliveries ── */}
        {activeTab === 'my-deliveries' && (
          <>
            {activeDeliveries.length === 0 && completedDeliveries.length === 0 ? (
              <div className="dd-empty">
                <div className="dd-empty-icon">🚚</div>
                <div className="dd-empty-text">No deliveries yet</div>
                <div className="dd-empty-sub">Accept a delivery request from the Available tab to get started.</div>
              </div>
            ) : (
              <>
                {/* Active Deliveries */}
                {activeDeliveries.map(d => {
                  const currentStep = getStepIndex(d.status);
                  const statusCfg = STATUS_LABELS[d.status] || { label: d.status, color: '#6b7280', icon: '📦' };

                  return (
                    <div className="dd-active-card" key={d.id}>
                      <div className="dd-active-header">
                        {d.listing_image && (
                          <img src={d.listing_image} alt={d.listing_title} className="dd-card-img" />
                        )}
                        <div className="dd-card-info">
                          <h3 className="dd-card-title">{d.listing_title || 'Item'}</h3>
                          <div className="dd-card-seller">
                            {d.pickup_location} → {d.drop_location}
                          </div>
                        </div>
                        <div className="dd-status-badge" style={{ '--badge-color': statusCfg.color }}>
                          <span>{statusCfg.icon}</span>
                          <span>{statusCfg.label}</span>
                        </div>
                      </div>

                      <div className="dd-active-content">
                        {/* Step Tracker */}
                        <div className="dd-tracker">
                          {DELIVERY_STEPS.map((step, i) => (
                            <div
                              key={step.key}
                              className={`dd-tracker-step ${i < currentStep ? 'step-done' : ''} ${i === currentStep ? 'step-active' : ''}`}
                            >
                              <div className="dd-tracker-dot">
                                {i < currentStep ? '✓' : i + 1}
                              </div>
                              <span className="dd-tracker-label">{step.label}</span>
                              {i < DELIVERY_STEPS.length - 1 && (
                                <div className="dd-tracker-line" />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Info Grid */}
                        <div className="dd-card-body" style={{ padding: '0.5rem 0' }}>
                          <div className="dd-detail">
                            <span className="dd-detail-label">Seller</span>
                            <span className="dd-detail-value">{d.seller_name}</span>
                          </div>
                          <div className="dd-detail">
                            <span className="dd-detail-label">Customer</span>
                            <span className="dd-detail-value">{d.customer_name}</span>
                          </div>
                          <div className="dd-detail">
                            <span className="dd-detail-label">Distance</span>
                            <span className="dd-detail-value">{parseFloat(d.distance).toFixed(1)} km</span>
                          </div>
                          <div className="dd-detail">
                            <span className="dd-detail-label">Your Earning</span>
                            <span className="dd-detail-value earning">{formatCurrency(d.courier_earning)}</span>
                          </div>
                        </div>

                        {/* Action Buttons based on status */}
                        <div className="dd-card-footer" style={{ borderTop: 'none', paddingLeft: 0, paddingRight: 0 }}>
                          {d.status === 'ACCEPTED' && (
                            <button
                              className="dd-btn dd-btn-amber"
                              onClick={() => doAction(d.id, 'start-pickup')}
                              disabled={!!actionLoading[d.id]}
                            >
                              {actionLoading[d.id] ? '...' : '🚶 Start Pickup'}
                            </button>
                          )}

                          {d.status === 'ARRIVING_FOR_PICKUP' && (
                            <div style={{ width: '100%' }}>
                              <div className="dd-verify-section">
                                <h4 className="dd-verify-title">🔑 Enter Seller's Pickup Token</h4>
                                <div className="dd-verify-input-row">
                                  <input
                                    type="text"
                                    className="dd-verify-input"
                                    placeholder="Enter 6-char token"
                                    maxLength={6}
                                    value={tokenInput[`${d.id}_pickup`] || ''}
                                    onChange={(e) => setTokenInput(prev => ({ ...prev, [`${d.id}_pickup`]: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyToken(d.id, 'pickup')}
                                  />
                                  <button
                                    className="dd-btn dd-btn-success"
                                    onClick={() => handleVerifyToken(d.id, 'pickup')}
                                    disabled={!!actionLoading[d.id]}
                                    style={{ flex: 'none', width: 'auto', padding: '0.55rem 1rem' }}
                                  >
                                    {actionLoading[d.id] ? '...' : '✓ Verify'}
                                  </button>
                                </div>
                                {tokenError[`${d.id}_pickup`] && (
                                  <p className="dd-verify-error">{tokenError[`${d.id}_pickup`]}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {d.status === 'PICKED_UP' && (
                            <button
                              className="dd-btn dd-btn-primary"
                              onClick={() => doAction(d.id, 'start-delivery')}
                              disabled={!!actionLoading[d.id]}
                            >
                              {actionLoading[d.id] ? '...' : '🚚 Start Delivery'}
                            </button>
                          )}

                          {d.status === 'IN_TRANSIT' && (
                            <button
                              className="dd-btn dd-btn-amber"
                              onClick={() => doAction(d.id, 'arrive')}
                              disabled={!!actionLoading[d.id]}
                            >
                              {actionLoading[d.id] ? '...' : '📍 Arrived at Drop'}
                            </button>
                          )}

                          {(d.status === 'ARRIVED' || d.status === 'IN_TRANSIT') && (
                            <div style={{ width: '100%', marginTop: d.status === 'IN_TRANSIT' ? '0.75rem' : 0 }}>
                              {d.status === 'ARRIVED' && (
                                <div className="dd-verify-section">
                                  <h4 className="dd-verify-title">🔑 Enter Customer's Delivery Token</h4>
                                  <div className="dd-verify-input-row">
                                    <input
                                      type="text"
                                      className="dd-verify-input"
                                      placeholder="Enter 6-char token"
                                      maxLength={6}
                                      value={tokenInput[`${d.id}_delivery`] || ''}
                                      onChange={(e) => setTokenInput(prev => ({ ...prev, [`${d.id}_delivery`]: e.target.value }))}
                                      onKeyDown={(e) => e.key === 'Enter' && handleVerifyToken(d.id, 'delivery')}
                                    />
                                    <button
                                      className="dd-btn dd-btn-success"
                                      onClick={() => handleVerifyToken(d.id, 'delivery')}
                                      disabled={!!actionLoading[d.id]}
                                      style={{ flex: 'none', width: 'auto', padding: '0.55rem 1rem' }}
                                    >
                                      {actionLoading[d.id] ? '...' : '✓ Complete'}
                                    </button>
                                  </div>
                                  {tokenError[`${d.id}_delivery`] && (
                                    <p className="dd-verify-error">{tokenError[`${d.id}_delivery`]}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Completed Deliveries */}
                {completedDeliveries.length > 0 && (
                  <>
                    <h3 style={{ margin: '1.5rem 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      ✅ Completed ({completedDeliveries.length})
                    </h3>
                    <div className="dd-grid">
                      {completedDeliveries.map(d => (
                        <div className="dd-card" key={d.id} style={{ opacity: 0.85 }}>
                          <div className="dd-card-header">
                            {d.listing_image && (
                              <img src={d.listing_image} alt={d.listing_title} className="dd-card-img" />
                            )}
                            <div className="dd-card-info">
                              <h3 className="dd-card-title">{d.listing_title || 'Item'}</h3>
                              <div className="dd-card-seller">{d.pickup_location} → {d.drop_location}</div>
                            </div>
                            <div className="dd-status-badge" style={{ '--badge-color': '#22c55e' }}>
                              <span>🎉</span>
                              <span>Delivered</span>
                            </div>
                          </div>
                          <div className="dd-card-body">
                            <div className="dd-detail">
                              <span className="dd-detail-label">Earned</span>
                              <span className="dd-detail-value earning">{formatCurrency(d.courier_earning)}</span>
                            </div>
                            <div className="dd-detail">
                              <span className="dd-detail-label">Delivered At</span>
                              <span className="dd-detail-value">
                                {d.delivered_at ? new Date(d.delivered_at).toLocaleDateString() : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── Tab: Earnings ── */}
        {activeTab === 'earnings' && earnings && (
          <>
            <div className="dd-earnings-grid">
              <div className="dd-earning-card">
                <span className="dd-stat-label">Today's Earnings</span>
                <span className="dd-stat-value">{formatCurrency(earnings.todayEarned)}</span>
                <span className="dd-stat-label" style={{ marginTop: '0.25rem' }}>{earnings.todayCount} deliveries today</span>
              </div>
              <div className="dd-earning-card">
                <span className="dd-stat-label">Total Deliveries</span>
                <span className="dd-stat-value" style={{ color: 'var(--color-text)' }}>{earnings.completedCount}</span>
              </div>
              <div className="dd-earning-card">
                <span className="dd-stat-label">Total Earned</span>
                <span className="dd-stat-value">{formatCurrency(earnings.totalEarned)}</span>
              </div>
            </div>

            {/* Transaction History */}
            {earnings.transactions && earnings.transactions.length > 0 ? (
              <div className="dd-transactions">
                <h3 className="dd-transactions-title">Recent Transactions</h3>
                {earnings.transactions.map(tx => (
                  <div className="dd-tx-item" key={tx.id}>
                    {tx.listing_image && (
                      <img src={tx.listing_image} alt={tx.listing_title} className="dd-tx-img" />
                    )}
                    <div className="dd-tx-info">
                      <div className="dd-tx-title">{tx.listing_title || 'Item'}</div>
                      <div className="dd-tx-route">{tx.pickup_location} → {tx.drop_location}</div>
                    </div>
                    <span className="dd-tx-earning">+{formatCurrency(tx.courier_earning)}</span>
                    <span className="dd-tx-date">
                      {tx.delivered_at ? new Date(tx.delivered_at).toLocaleDateString() : '-'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dd-empty">
                <div className="dd-empty-icon">💰</div>
                <div className="dd-empty-text">No earnings yet</div>
                <div className="dd-empty-sub">Complete your first delivery to start earning.</div>
              </div>
            )}
          </>
        )}

        {/* ── Confirmation Modal ── */}
        {confirmModal && (
          <div className="dd-modal-overlay" onClick={() => setConfirmModal(null)}>
            <div className="dd-modal" onClick={e => e.stopPropagation()}>
              <h3 className="dd-modal-title">{confirmModal.title}</h3>
              <p className="dd-modal-text">{confirmModal.text}</p>
              <div className="dd-modal-actions">
                <button className="dd-btn dd-btn-outline" onClick={() => setConfirmModal(null)}>Cancel</button>
                <button className="dd-btn dd-btn-primary" onClick={confirmModal.onConfirm}>Accept Delivery</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
