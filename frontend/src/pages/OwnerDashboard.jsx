import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './OwnerDashboard.css';

const API_BASE = 'http://localhost:3003';
const formatCurrency = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

const STATUS_LABELS = {
  BOOKING_PAYMENT_PENDING: { label: 'Payment Pending', color: '#f59e0b' },
  RENTAL_PAYMENT_COMPLETED: { label: 'Needs Response', color: '#8b5cf6', highlight: true },
  OWNER_PENDING:           { label: 'Needs Response', color: '#8b5cf6', highlight: true },
  DEPOSIT_PENDING:         { label: 'Deposit Pending', color: '#3b82f6' },
  QR_GENERATED:            { label: 'QR Generated', color: '#10b981' },
  RENTAL_ACTIVE:           { label: 'Rental Active', color: '#34d399' },
  RETURN_REQUESTED:        { label: 'Return Requested', color: '#f97316' },
  RETURNED:                { label: 'Returned', color: '#a78bfa' },
  OWNER_INSPECTION:        { label: 'Inspection', color: '#fbbf24' },
  DEPOSIT_REFUNDED:        { label: 'Refunded', color: '#34d399' },
  COMPLETED:               { label: 'Completed', color: '#6b7280' },
  CANCELLED:               { label: 'Cancelled', color: '#ef4444' },
};

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [responding, setResponding] = useState({});
  const [filterStatus, setFilterStatus] = useState('ALL');

  const fetchRequests = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/rentals/my-listings-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load requests');
      setRequests(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleRespond = async (rental_id, response) => {
    setResponding((prev) => ({ ...prev, [rental_id]: response }));
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/rentals/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rental_id, response }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchRequests();
    } catch (e) {
      alert(e.message);
    } finally {
      setResponding((prev) => ({ ...prev, [rental_id]: null }));
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'OWNER_PENDING' || r.status === 'RENTAL_PAYMENT_COMPLETED').length;

  const FILTERS = ['ALL', 'OWNER_PENDING', 'RENTAL_ACTIVE', 'RETURN_REQUESTED', 'COMPLETED', 'CANCELLED'];
  const filtered = filterStatus === 'ALL' 
    ? requests 
    : requests.filter((r) => r.status === filterStatus || (filterStatus === 'OWNER_PENDING' && r.status === 'RENTAL_PAYMENT_COMPLETED'));

  if (loading) {
    return (
      <div className="od-loading">
        <div className="od-spinner" />
        <p>Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="od-page">
      <div className="od-container">
        {/* Header */}
        <div className="od-header">
          <div>
            <h1 className="od-title">Owner Dashboard</h1>
            <p className="od-subtitle">Manage rental requests for your listings</p>
          </div>
          {pendingCount > 0 && (
            <div className="od-alert-badge">
              🔔 {pendingCount} Request{pendingCount > 1 ? 's' : ''} Need Response
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="od-stats">
          <div className="od-stat">
            <span className="od-stat-val">{requests.length}</span>
            <span className="od-stat-label">Total Requests</span>
          </div>
          <div className="od-stat">
            <span className="od-stat-val od-stat-purple">{pendingCount}</span>
            <span className="od-stat-label">Pending</span>
          </div>
          <div className="od-stat">
            <span className="od-stat-val od-stat-green">
              {requests.filter((r) => ['RENTAL_ACTIVE', 'QR_GENERATED', 'DEPOSIT_PENDING'].includes(r.status)).length}
            </span>
            <span className="od-stat-label">Active</span>
          </div>
          <div className="od-stat">
            <span className="od-stat-val od-stat-muted">
              {requests.filter((r) => ['COMPLETED', 'DEPOSIT_REFUNDED'].includes(r.status)).length}
            </span>
            <span className="od-stat-label">Completed</span>
          </div>
        </div>

        {/* Filters */}
        <div className="od-filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`od-filter-btn ${filterStatus === f ? 'od-filter-active' : ''}`}
              onClick={() => setFilterStatus(f)}
            >
              {f === 'ALL' ? 'All' : STATUS_LABELS[f]?.label || f}
              {f === 'OWNER_PENDING' && pendingCount > 0 && (
                <span className="od-filter-count">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {error && <div className="od-error">{error}</div>}

        {filtered.length === 0 ? (
          <div className="od-empty">
            <span>📋</span>
            <p>{filterStatus === 'ALL' ? 'No rental requests yet.' : `No requests with status "${filterStatus}".`}</p>
          </div>
        ) : (
          <div className="od-cards">
            {filtered.map((rental) => {
              const statusCfg = STATUS_LABELS[rental.status] || { label: rental.status, color: '#6b7280' };
              const isActionable = rental.status === 'OWNER_PENDING' || rental.status === 'RENTAL_PAYMENT_COMPLETED';
              return (
                <div key={rental.id} className={`od-card ${isActionable ? 'od-card-highlight' : ''}`}>
                  {isActionable && <div className="od-action-ribbon">Action Required</div>}
                  <div className="od-card-top">
                    {rental.listing_image && (
                      <img src={rental.listing_image} alt={rental.listing_title} className="od-listing-img" />
                    )}
                    <div className="od-card-info">
                      <span className="od-listing-cat">{rental.listing_category}</span>
                      <h3 className="od-listing-title">{rental.listing_title}</h3>
                      <span className="od-status-pill" style={{ '--sc': statusCfg.color }}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>

                  <div className="od-borrower-row">
                    <span className="od-label">Borrower</span>
                    <span className="od-val">{rental.borrower_name}</span>
                    <span className="od-email">{rental.borrower_email}</span>
                  </div>

                  <div className="od-dates-row">
                    <div className="od-date-block">
                      <span className="od-label">Start</span>
                      <span className="od-val">{new Date(rental.start_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>
                    </div>
                    <div className="od-date-block">
                      <span className="od-label">End</span>
                      <span className="od-val">{new Date(rental.end_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>
                    </div>
                    <div className="od-date-block">
                      <span className="od-label">Duration</span>
                      <span className="od-val">{rental.rental_days} day{rental.rental_days > 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="od-amounts-row">
                    <div className="od-amount"><span>Booking</span><strong>{formatCurrency(rental.booking_amount)}</strong></div>
                    <div className="od-amount"><span>Deposit</span><strong>{formatCurrency(rental.deposit_amount)}</strong></div>
                  </div>

                  {isActionable && (
                    <div className="od-action-btns">
                      <button
                        className="od-btn od-btn-accept"
                        onClick={() => handleRespond(rental.id, 'ACCEPTED')}
                        disabled={!!responding[rental.id]}
                      >
                        {responding[rental.id] === 'ACCEPTED' ? '⏳ Accepting…' : '✓ Accept Booking'}
                      </button>
                      <button
                        className="od-btn od-btn-reject"
                        onClick={() => handleRespond(rental.id, 'REJECTED')}
                        disabled={!!responding[rental.id]}
                      >
                        {responding[rental.id] === 'REJECTED' ? '⏳ Rejecting…' : '✕ Reject'}
                      </button>
                    </div>
                  )}

                  {rental.status === 'RETURN_REQUESTED' && (
                    <div className="od-action-btns">
                      <button
                        className="od-btn od-btn-inspect"
                        onClick={() => navigate(`/rental-return/${rental.id}`)}
                      >
                        🔍 Inspect & Process Return
                      </button>
                    </div>
                  )}

                  <button
                    className="od-view-link"
                    onClick={() => navigate(`/rent-details/${rental.id}`)}
                  >
                    View Full Details →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
