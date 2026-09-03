import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../lib/api';
import HandoverCredential from '../components/HandoverCredential';

const API_BASE = API_BASE_URL;
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
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [responding, setResponding] = useState({});
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [deliveryStatuses, setDeliveryStatuses] = useState({});
  const [connection, setConnection] = useState('reconnecting');

  const fetchRequests = useCallback(async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE}/api/rentals/my-listings-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load requests');
      setRequests(data);
      setConnection('live');
    } catch (e) {
      setConnection('offline');
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    const socket = io(API_BASE, { auth: { token: localStorage.getItem('token') }, reconnectionAttempts: 5 });
    socket.on('connect', () => setConnection('live'));
    socket.on('disconnect', () => setConnection('reconnecting'));
    socket.on('connect_error', () => setConnection('offline'));
    const refresh = () => fetchRequests();
    ['rental:request', 'rental:status', 'delivery:created', 'delivery:assigned', 'delivery:status', 'delivery:completed'].forEach((event) => socket.on(event, refresh));
    return () => socket.close();
  }, [fetchRequests]);
  useEffect(() => {
    const interval = setInterval(fetchRequests, connection === 'live' ? 15000 : 5000);
    return () => clearInterval(interval);
  }, [connection, fetchRequests]);

  // Fetch delivery statuses for all rentals that have delivery_fee > 0
  const fetchDeliveryStatuses = useCallback(async () => {
    const token = localStorage.getItem('token');
    for (const rental of requests) {
      if (parseFloat(rental.delivery_fee) > 0) {
        try {
          const res = await fetch(`${API_BASE}/api/delivery/rental/${rental.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setDeliveryStatuses(prev => ({ ...prev, [rental.id]: data }));
          }
        } catch {}
      }
    }
  }, [requests]);

  useEffect(() => {
    if (requests.length > 0) fetchDeliveryStatuses();
  }, [requests, fetchDeliveryStatuses]);

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
      <div className="flex flex-col items-center justify-center [min-height:80vh] [gap:20px] [color:#a78bfa]">
        <div className="[width:48px] [height:48px] [border:4px_solid_rgba(139,_92,_246,_0.2)] [border-top-color:#8b5cf6] [border-radius:50%] animate-spin" />
        <p>Loading dashboard…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-5 py-10 text-ink sm:px-7">
      <div className="mx-auto max-w-[1100px] space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold">Owner dashboard</h1>
            <p className="mt-1 text-sm text-ink/45">Rental requests</p>
          </div>
          <span className={connection === 'live' ? 'rounded-full border border-mesh-200 bg-mesh-50 px-3 py-2 text-xs font-bold text-mesh-800' : connection === 'reconnecting' ? 'rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800' : 'rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700'}>
            <i className={'mr-2 inline-block size-2 rounded-full ' + (connection === 'live' ? 'bg-mesh-500' : connection === 'reconnecting' ? 'bg-amber-500' : 'bg-red-500')} />
            {connection === 'live' ? 'Live updates' : connection === 'reconnecting' ? 'Reconnecting' : 'Backend disconnected'}
          </span>
          {pendingCount > 0 && (
            <div className="animate-pulse rounded-full border border-mesh-200 bg-mesh-50 px-4 py-2 text-sm font-bold text-mesh-700">
              🔔 {pendingCount} Request{pendingCount > 1 ? 's' : ''} Need Response
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="flex flex-col gap-1 rounded-2xl border border-ink/10 bg-white p-5 text-center">
            <span className="text-2xl font-extrabold">{requests.length}</span>
            <span className="text-xs text-ink/45">Total</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-ink/10 bg-white p-5 text-center">
            <span className="text-2xl font-extrabold text-amber-600">{pendingCount}</span>
            <span className="text-xs text-ink/45">Pending</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-ink/10 bg-white p-5 text-center">
            <span className="text-2xl font-extrabold text-mesh-700">
              {requests.filter((r) => ['RENTAL_ACTIVE', 'QR_GENERATED', 'DEPOSIT_PENDING'].includes(r.status)).length}
            </span>
            <span className="text-xs text-ink/45">Active</span>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-ink/10 bg-white p-5 text-center">
            <span className="text-2xl font-extrabold text-ink/45">
              {requests.filter((r) => ['COMPLETED', 'DEPOSIT_REFUNDED'].includes(r.status)).length}
            </span>
            <span className="text-xs text-ink/45">Completed</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`flex items-center gap-1 rounded-full border px-4 py-2 text-xs font-bold ${filterStatus === f ? 'border-mesh-600 bg-mesh-600 text-white' : 'border-ink/10 bg-white text-ink/55'}`}
              onClick={() => setFilterStatus(f)}
            >
              {f === 'ALL' ? 'All' : STATUS_LABELS[f]?.label || f}
              {f === 'OWNER_PENDING' && pendingCount > 0 && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {error && <div className="[background:rgba(239,_68,_68,_0.1)] [border:1px_solid_rgba(239,_68,_68,_0.3)] [color:#fca5a5] [padding:12px_16px] [border-radius:12px] [margin-bottom:20px] [font-size:0.88rem]">{error}</div>}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center [gap:12px] [padding:64px_0] [color:#6b7280] [font-size:1rem]">
            <span>📋</span>
            <p>{filterStatus === 'ALL' ? 'No rental requests yet.' : `No requests with status "${filterStatus}".`}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((rental) => {
              const statusCfg = STATUS_LABELS[rental.status] || { label: rental.status, color: '#6b7280' };
              const isActionable = rental.status === 'OWNER_PENDING' || rental.status === 'RENTAL_PAYMENT_COMPLETED';
              return (
                <div key={rental.id} className={`relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 ${isActionable ? 'border-mesh-300 shadow-lg' : 'border-ink/10'}`}>
                  {isActionable && <div className="absolute [top:14px] [right:-28px] [background:#7c3aed] [color:white] [font-size:0.7rem] font-bold [padding:4px_36px] [transform:rotate(40deg)] uppercase [letter-spacing:0.5px]">Action Required</div>}
                  <div className="flex [gap:14px] items-start">
                    {rental.listing_image && (
                      <img src={rental.listing_image} alt={rental.listing_title} className="[width:72px] [height:64px] [border-radius:12px] object-cover shrink-0" />
                    )}
                    <div className="flex flex-col [gap:6px]">
                      <span className="[font-size:0.72rem] [color:#a78bfa] uppercase [letter-spacing:0.5px]">{rental.listing_category}</span>
                      <h3 className="m-0 text-sm font-bold text-ink">{rental.listing_title}</h3>
                      <div className="flex flex-wrap gap-2"><span className="w-fit rounded-full border border-mesh-200 bg-mesh-50 px-2.5 py-1 text-xs font-semibold text-mesh-700">{statusCfg.label}</span>{rental.delivery_requested && <span className="w-fit rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">Delivery requested</span>}</div>
                    </div>
                  </div>

                  <div className="flex items-center [gap:8px] [font-size:0.83rem] [padding:10px_0] [border-top:1px_solid_rgba(255,_255,_255,_0.05)]">
                    <span className="[color:#6b7280]">Renter</span>
                    <span className="text-ink/60 font-medium">{rental.borrower_name}</span>
                    <span className="[color:#6b7280] [font-size:0.76rem] [margin-left:auto]">{rental.borrower_email}</span>
                  </div>

                  <div className="flex [gap:16px] flex-wrap">
                    <div className="flex flex-col [gap:2px]">
                      <span className="[color:#6b7280]">Start</span>
                      <span className="text-ink/60 font-medium">{new Date(rental.start_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>
                    </div>
                    <div className="flex flex-col [gap:2px]">
                      <span className="[color:#6b7280]">End</span>
                      <span className="text-ink/60 font-medium">{new Date(rental.end_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>
                    </div>
                    <div className="flex flex-col [gap:2px]">
                      <span className="[color:#6b7280]">Duration</span>
                      <span className="text-ink/60 font-medium">{rental.rental_days} day{rental.rental_days > 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="flex [gap:20px] [padding:12px_0] [border-top:1px_solid_rgba(255,_255,_255,_0.05)]">
                    <div className="flex flex-col [gap:2px]"><span>Booking</span><strong>{formatCurrency(rental.booking_amount)}</strong></div>
                    <div className="flex flex-col [gap:2px]"><span>Deposit</span><strong>{formatCurrency(rental.deposit_amount)}</strong></div>
                  </div>

                  {isActionable && (
                    <div className="space-y-4">
                      <button
                        className="flex-1 [padding:12px] [border-radius:12px] [font-size:0.88rem] font-bold cursor-pointer [transition:all_0.2s] border-0 disabled:[opacity:0.55] disabled:[cursor:not-allowed] [background:linear-gradient(135deg,_#059669,_#10b981)] [color:white] [box-shadow:0_4px_16px_rgba(16,_185,_129,_0.3)]"
                        onClick={() => handleRespond(rental.id, 'ACCEPTED')}
                        disabled={!!responding[rental.id]}
                      >
                        {responding[rental.id] === 'ACCEPTED' ? '⏳ Accepting…' : '✓ Accept Booking'}
                      </button>
                      <button
                        className="flex-1 [padding:12px] [border-radius:12px] [font-size:0.88rem] font-bold cursor-pointer [transition:all_0.2s] border-0 disabled:[opacity:0.55] disabled:[cursor:not-allowed] [background:rgba(239,_68,_68,_0.12)] [border:1px_solid_rgba(239,_68,_68,_0.35)] [color:#fca5a5]"
                        onClick={() => handleRespond(rental.id, 'REJECTED')}
                        disabled={!!responding[rental.id]}
                      >
                        {responding[rental.id] === 'REJECTED' ? '⏳ Rejecting…' : '✕ Reject'}
                      </button>
                    </div>
                  )}

                  {rental.status === 'RETURN_REQUESTED' && (
                    <div className="space-y-4">
                      <button
                        className="flex-1 [padding:12px] [border-radius:12px] [font-size:0.88rem] font-bold cursor-pointer [transition:all_0.2s] border-0 disabled:[opacity:0.55] disabled:[cursor:not-allowed] [background:rgba(251,_191,_36,_0.12)] [border:1px_solid_rgba(251,_191,_36,_0.35)] [color:#fde68a] w-full hover:[background:rgba(251,_191,_36,_0.2)]"
                        onClick={() => navigate(`/rental-return/${rental.id}`)}
                      >
                        🔍 Inspect & Process Return
                      </button>
                    </div>
                  )}

                  <button
                    className="[background:none] border-0 [color:#7c3aed] [font-size:0.82rem] font-semibold cursor-pointer text-left p-0 [transition:color_0.2s] hover:[color:#a78bfa]"
                    onClick={() => navigate(`/rent-details/${rental.id}`)}
                  >
                    View Full Details →
                  </button>

                  {/* Delivery Status & Seller Pickup Token */}
                  {deliveryStatuses[rental.id] && deliveryStatuses[rental.id].has_delivery && (() => {
                    const ds = deliveryStatuses[rental.id];
                    return (
                      <div className="mt-2 rounded-lg border border-ink/10 bg-mesh-50 p-3">
                        <div className="mb-2 flex items-center gap-1 text-xs font-bold">
                          🚚 Delivery
                          <span className={`ml-auto rounded-full px-2 py-0.5 text-[.65rem] font-bold ${ds.status === 'DELIVERED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {{
                              WAITING_FOR_DEPOSIT: 'Deposit required',
                              MATCHING_COURIER: 'Finding courier',
                              NO_COURIER_AVAILABLE: 'Waiting for route',
                              COURIER_ASSIGNED: 'Courier assigned',
                              GOING_TO_PICKUP: 'Courier coming',
                              ARRIVED_AT_PICKUP: 'At pickup',
                              IN_TRANSIT: 'In transit',
                              ARRIVED_AT_DESTINATION: 'At destination',
                              COMPLETED: 'Delivered',
                            }[ds.status] || ds.status}
                          </span>
                        </div>
                        {ds.courier_name && (
                          <div className="mb-2 text-xs text-ink/50">
                            Courier: <strong className="text-ink">{ds.courier_name}</strong>
                          </div>
                        )}
                        {ds.delivery_id && ((ds.task_type === 'RENTAL_RETURN' && ds.status === 'RETURN_IN_TRANSIT') || (ds.task_type !== 'RENTAL_RETURN' && ds.status === 'ARRIVED_AT_PICKUP')) && (
                          <HandoverCredential deliveryId={ds.delivery_id} stage={ds.task_type === 'RENTAL_RETURN' ? 'RETURN_RECEIVED' : 'PICKUP'} title={ds.task_type === 'RENTAL_RETURN' ? 'Confirm returned item' : 'Owner pickup handover'} />
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
