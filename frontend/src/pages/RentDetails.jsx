import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';
import { mockProducts } from '../data/mockData';
import QRCode from 'qrcode';
import HandoverCredential from '../components/HandoverCredential';

const API_BASE = API_BASE_URL;
const formatCurrency = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

const STATUS_CONFIG = {
  BOOKING_PAYMENT_PENDING: { label: 'Payment Pending', color: '#f59e0b', icon: '⏳' },
  RENTAL_PAYMENT_COMPLETED: { label: 'Awaiting Owner', color: '#3b82f6', icon: '👀' },
  OWNER_PENDING:           { label: 'Awaiting Owner', color: '#3b82f6', icon: '👀' },
  DEPOSIT_PENDING:         { label: 'Deposit Required', color: '#f59e0b', icon: '🔒' },
  QR_GENERATED:            { label: 'QR Ready', color: '#10b981', icon: '✅' },
  COURIER_PICKUP:          { label: 'Courier Pickup', color: '#3b82f6', icon: '🚚' },
  MATCHING_COURIER:         { label: 'Finding a courier', color: '#3b82f6', icon: '🔎' },
  COURIER_ASSIGNED:        { label: 'Courier Assigned', color: '#3b82f6', icon: '🚚' },
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
    <div className={`flex items-center [gap:10px] [background:#ffffff] [border:1px_solid_#e5e7eb] [border-radius:12px] [padding:10px_16px] [width:fit-content] ${isUrgent ? '[border-color:rgba(239,_68,_68,_0.4)] [background:rgba(239,_68,_68,_0.05)] [animation:timer-pulse_1s_ease-in-out_infinite]' : ''}`}>
      <span className="[font-size:1.1rem]">⏳</span>
      <span className="[font-family:'Courier_New',_monospace] [font-size:1.6rem] font-bold [color:#15803d] [letter-spacing:2px]">{m}:{s}</span>
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
      <div className="flex flex-col items-center justify-center [min-height:80vh] [gap:20px] [color:#22c55e]">
        <div className="[width:48px] [height:48px] [border:4px_solid_rgba(34,_197,_94,_0.2)] [border-top-color:#22c55e] [border-radius:50%] animate-spin" />
        <p>Loading rental details…</p>
      </div>
    );
  }

  if (error && !rental) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 py-16 text-center text-lg text-red-600">
        <span className="mb-4 block text-4xl">⚠️</span>
        <h3 className="mb-2 text-xl text-red-700">Rental unavailable.</h3>
        <p className="mb-6 text-ink/50">Refresh or return to your rentals.</p>
        <button onClick={() => navigate('/account/rentals')} className="inline-flex h-11 items-center justify-center rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white">My rentals</button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[rental.status] || { label: rental.status, color: '#6b7280', icon: '•' };
  const currentStep = STEPS.findIndex(s => s.key === rental.status || (s.key === 'OWNER_PENDING' && rental.status === 'RENTAL_PAYMENT_COMPLETED'));

  const isBorrower = rental.borrower_id === user?.id;
  const isOwner = rental.owner_id === user?.id;

  return (
    <div className="space-y-4">
      <div className="[max-width:1100px] [margin:0_auto]">
        {/* Header */}
        <div className="space-y-4">
          <button className="[background:#ffffff] [border:1px_solid_#e5e7eb] [color:#4b5563] [padding:8px_20px] [border-radius:8px] cursor-pointer [font-size:0.9rem] font-medium [transition:all_0.2s] [margin-bottom:16px] [box-shadow:0_1px_2px_rgba(0,0,0,0.05)] hover:[background:#f3f4f6] hover:[transform:translateX(-2px)]" onClick={() => navigate(-1)}>← Back</button>
          <div className="flex justify-between items-start flex-wrap [gap:16px]">
            <div>
              <h1 className="[font-size:2rem] font-extrabold [color:#111827] [margin:0_0_4px]">Rental Status</h1>
              <p className="[font-size:0.78rem] [color:#6b7280] [font-family:monospace] m-0">ID: {rentalId}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-green-500 bg-green-50 px-4 py-2.5 text-sm font-bold text-green-700">
              <span>{statusCfg.icon}</span>
              <span>{statusCfg.label}</span>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="space-y-4">
          {STEPS.map((step, i) => (
            <div
              key={step.key}
              className={`flex flex-col items-center [gap:8px] relative flex-1 [min-width:60px] ${i < currentStep ? '' : ''} ${i === currentStep ? '' : ''}`}
            >
              <div className="[width:36px] [height:36px] [border-radius:50%] [background:#f3f4f6] [border:2px_solid_#d1d5db] flex items-center justify-center [font-size:0.85rem] font-bold [color:#6b7280] [transition:all_0.3s] [z-index:2]">
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span className="[font-size:0.72rem] [color:#6b7280] text-center font-medium">{step.label}</span>
              {i < STEPS.length - 1 && <div className={`absolute [top:18px] [left:calc(50%_+_18px)] [width:calc(100%_-_36px)] [height:2px] [background:#e5e7eb] [z-index:1] ${i < currentStep ? '[background:#10b981]' : ''}`} />}
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="[grid-template-columns:1fr]">
          <div className="space-y-4">
            {/* Listing Info */}
            <div className="[background:#ffffff] [border:1px_solid_#e5e7eb] [border-radius:16px] [padding:24px] [box-shadow:0_4px_6px_-1px_rgba(0,0,0,0.05),_0_2px_4px_-1px_rgba(0,0,0,0.03)] [margin-bottom:20px]">
              <div className="flex [gap:18px] items-start [margin-bottom:20px]">
                {rental.listing_image && (
                  <img src={rental.listing_image} alt={rental.listing_title} className="[width:90px] [height:80px] [border-radius:12px] object-cover shrink-0 [border:1px_solid_#e5e7eb]" />
                )}
                <div>
                  <p className="[font-size:0.75rem] [color:#16a34a] uppercase [letter-spacing:0.5px] [margin:0_0_4px] font-semibold">{rental.listing_category}</p>
                  <h2 className="[font-size:1.15rem] font-bold [color:#1f2937] [margin:0_0_4px]">{rental.listing_title}</h2>
                  <p className="[font-size:0.83rem] [color:#6b7280] m-0">📍 {rental.listing_location}</p>
                </div>
              </div>
              <div className="flex [gap:20px] items-center flex-wrap [padding-top:16px] [border-top:1px_solid_#e5e7eb]">
                <div><span className="[font-size:0.72rem] [color:#9ca3af] uppercase [letter-spacing:0.5px]">Start</span><span className="[font-size:0.9rem] font-semibold [color:#1f2937]">{new Date(rental.start_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span></div>
                <div className="[font-size:1.2rem] [color:#9ca3af] [padding-top:10px]">→</div>
                <div><span className="[font-size:0.72rem] [color:#9ca3af] uppercase [letter-spacing:0.5px]">End</span><span className="[font-size:0.9rem] font-semibold [color:#1f2937]">{new Date(rental.end_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span></div>
                <div><span className="[font-size:0.72rem] [color:#9ca3af] uppercase [letter-spacing:0.5px]">Duration</span><span className="[font-size:0.9rem] font-semibold [color:#1f2937]">{rental.rental_days} day{rental.rental_days > 1 ? 's' : ''}</span></div>
              </div>
            </div>

            {/* Deposit Warning Banner */}
            {rental.status === 'DEPOSIT_PENDING' && isBorrower && (
              <div className="space-y-4">
                <div className="space-y-4">
                  <strong>Booking accepted</strong>
                  <p>Pay the deposit before the timer ends.</p>
                </div>
                {rental.deposit_deadline && (
                  <CountdownTimer
                    deadline={rental.deposit_deadline}
                    onExpired={() => setTimeout(fetchStatus, 1000)}
                  />
                )}
                <button
                  className="[background:#22c55e] [color:white] border-0 [padding:16px] [border-radius:12px] [font-size:1rem] font-bold cursor-pointer [transition:all_0.2s] [box-shadow:0_4px_10px_rgba(34,_197,_94,_0.2)] disabled:[opacity:0.55] disabled:[cursor:not-allowed]"
                  onClick={() => navigate(`/deposit-payment/${rentalId}`)}
                >
                  Pay Security Deposit {formatCurrency(rental.deposit_amount)}
                </button>
              </div>
            )}

            {/* QR Code Handover */}
            {rental.status === 'QR_GENERATED' && (
              <div className="space-y-4">
                <h3 className="[font-size:1rem] font-bold [color:#059669] [margin:0_0_6px]">Handover QR</h3>
                <p className="[font-size:0.83rem] [color:#6b7280] [margin:0_0_20px]">Show this at pickup.</p>
                <canvas ref={canvasRef} className="[border-radius:12px] [padding:12px] [background:#ffffff] [border:1px_solid_rgba(16,_185,_129,_0.2)] block [margin:0_auto_12px]" />
                <p className="[font-size:0.72rem] [font-family:monospace] [color:#9ca3af] m-0">Hash: {rental.qr_code_hash?.slice(0, 20)}…</p>
              </div>
            )}

            {/* Delivery Courier Status */}
            {deliveryInfo && deliveryInfo.has_delivery && (
              <div className="mt-4 space-y-4 rounded-lg border border-ink/10 bg-mesh-50 p-4">
                <h4 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
                  🚚 Delivery Status
                </h4>
                {deliveryInfo.status === 'AVAILABLE' && (
                  <p className="text-xs text-ink/50">Finding a courier…</p>
                )}
                {deliveryInfo.status !== 'AVAILABLE' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <div className="text-[.65rem] font-semibold uppercase text-ink/50">Status</div>
                      <div className={`text-sm font-bold ${deliveryInfo.status === 'DELIVERED' ? 'text-green-600' : 'text-blue-600'}`}>
                        {{
                          MATCHING_COURIER: '🔎 Finding a Courier',
                          COURIER_ASSIGNED: '✅ Courier Assigned',
                          ACCEPTED: '✅ Courier Assigned',
                          GOING_TO_PICKUP: '🚶 Heading to Seller',
                          ARRIVING_FOR_PICKUP: '🚶 Heading to Seller',
                          PICKUP_VERIFIED: '📋 Pickup Verified',
                          ORDER_COLLECTED: '📋 Item Picked Up',
                          PICKED_UP: '📋 Item Picked Up',
                          GOING_TO_DESTINATION: '🚚 On the Way',
                          IN_TRANSIT: '🚚 On the Way',
                          ARRIVED_AT_DESTINATION: '📍 Courier Arrived',
                          ARRIVED: '📍 Courier Arrived',
                          DELIVERED: '🎉 Delivered!',
                        }[deliveryInfo.status] || deliveryInfo.status}
                      </div>
                    </div>
                    {deliveryInfo.courier_name && (
                      <div>
                        <div className="text-[.65rem] font-semibold uppercase text-ink/50">Courier</div>
                        <div className="text-sm font-semibold">{deliveryInfo.courier_name}</div>
                      </div>
                    )}
                  </div>
                )}
                {deliveryInfo.delivery_id && (
                  <Link to={"/delivery/" + deliveryInfo.delivery_id + "/track"} className="inline-flex items-center rounded-xl bg-white px-3 py-2 text-xs font-bold text-mesh-700 shadow-sm hover:bg-mesh-100">
                    Open live tracking →
                  </Link>
                )}
                {/* Customer's Delivery Token — shown when courier needs to verify delivery */}
                {isBorrower && deliveryInfo.delivery_token && ['PICKED_UP','IN_TRANSIT','ARRIVED'].includes(deliveryInfo.status) && (
                  <div className="mt-3 rounded-xl bg-ink p-5 text-center">
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-white/60">Your Delivery Token</div>
                    <div className="select-all font-mono text-3xl font-black tracking-[.25em] text-white">
                      {deliveryInfo.delivery_token}
                    </div>
                    <div className="mt-1.5 text-[.65rem] text-white/50">Show at delivery.</div>
                  </div>
                )}
                {isBorrower && deliveryInfo.delivery_id && ['PICKUP_VERIFIED','IN_TRANSIT','ARRIVED_AT_DESTINATION','ARRIVED','RETURN_COURIER_ASSIGNED','RETURN_IN_TRANSIT','COURIER_ASSIGNED'].includes(deliveryInfo.status) && (
                  <HandoverCredential deliveryId={deliveryInfo.delivery_id} stage={deliveryInfo.task_type === 'RENTAL_RETURN' ? 'RETURN_PICKUP' : 'DELIVERY'} title={deliveryInfo.task_type === 'RENTAL_RETURN' ? 'Return pickup handover' : 'Delivery handover'} />
                )}
              </div>
            )}

            {/* Status-specific messages */}
            {(rental.status === 'OWNER_PENDING' || rental.status === 'RENTAL_PAYMENT_COMPLETED') && isBorrower && (
              <div className=" [background:rgba(59,_130,_246,_0.05)] [border:1px_solid_rgba(59,_130,_246,_0.2)] [color:#1e40af]">
                <span>👀</span>
                <div className="flex-1">
                  <strong>Waiting for owner</strong>
                  <p>Payment received.</p>
                </div>
              </div>
            )}

            {rental.status === 'CANCELLED' && (
              <div className=" [background:rgba(239,_68,_68,_0.05)] [border:1px_solid_rgba(239,_68,_68,_0.2)] [color:#991b1b]">
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
              <div className="[margin-bottom:20px]">
                <button
                  className="[background:rgba(249,_115,_22,_0.05)] [border:1px_solid_rgba(249,_115,_22,_0.25)] [color:#c2410c] [padding:14px_28px] [border-radius:12px] [font-size:0.95rem] font-semibold cursor-pointer [transition:all_0.2s] w-full hover:[background:rgba(249,_115,_22,_0.1)] hover:[transform:translateY(-1px)]"
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      const response = await fetch(`${API_BASE}/api/rentals/${rentalId}/return-request`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
                      const data = await response.json();
                      if (!response.ok) throw new Error(data.error || 'Could not request return.');
                      await fetchStatus();
                    } catch (returnError) { setError(returnError.message); }
                  }}
                >
                  ↩️ Request Courier Return
                </button>
              </div>
            )}

            {error && <div className="[background:rgba(239,_68,_68,_0.05)] [border:1px_solid_rgba(239,_68,_68,_0.2)] [color:#991b1b] [padding:12px_16px] [border-radius:12px] [font-size:0.88rem] [margin-bottom:16px]">⚠️ {error}</div>}
          </div>

          {/* Right — Payment Summary */}
          <div className="space-y-4">
            <div className="[background:#ffffff] [border:1px_solid_#e5e7eb] [border-radius:16px] [padding:24px] [box-shadow:0_4px_6px_-1px_rgba(0,0,0,0.05),_0_2px_4px_-1px_rgba(0,0,0,0.03)]">
              <h3 className="[font-size:0.95rem] font-bold [color:#1f2937] [margin:0_0_18px]">💳 Payment Summary</h3>
              <div className="flex flex-col [gap:10px]">
                <div className="flex justify-between [font-size:0.88rem] [color:#4b5563]"><span>Rental Fee</span><span>{formatCurrency(rental.rental_fee)}</span></div>
                <div className="flex justify-between [font-size:0.88rem] [color:#4b5563]"><span>Delivery Fee</span><span>{formatCurrency(rental.delivery_fee)}</span></div>
                <div className="flex justify-between [font-size:0.88rem] [color:#4b5563]"><span>Platform Fee</span><span>{formatCurrency(rental.platform_fee)}</span></div>
                <div className="border-0 [border-top:1px_solid_#e5e7eb] [margin:4px_0]" />
                <div className="flex justify-between [font-size:0.88rem] [color:#4b5563] [font-size:1rem] font-bold [color:#111827]"><span>Booking Amount</span><span>{formatCurrency(rental.booking_amount)}</span></div>
                <div className="flex justify-between [font-size:0.88rem] [color:#4b5563] ">
                  <span>Security Deposit</span>
                  <span className={` ${rental.deposit_status === 'PAID' ? 'text-mesh-700' : ''}`}>
                    {rental.deposit_status === 'PAID' ? '✅ Paid' : `${formatCurrency(rental.deposit_amount)}`}
                  </span>
                </div>
              </div>

              {/* People */}
              <div className="[margin-top:20px] [padding-top:16px] [border-top:1px_solid_#e5e7eb] flex flex-col [gap:10px]">
                <div className="flex items-center [gap:8px]">
                  <span className="[font-size:0.75rem] [color:#9ca3af] [width:60px]">Owner</span>
                  <span className="[font-size:0.9rem] [color:#374151] font-medium flex-1">{rental.owner_name}</span>
                  {isOwner && <span className="[background:rgba(34,_197,_94,_0.1)] [color:#16a34a] [font-size:0.7rem] font-bold [padding:2px_8px] [border-radius:99px] [border:1px_solid_rgba(34,_197,_94,_0.2)]">You</span>}
                </div>
                <div className="flex items-center [gap:8px]">
                  <span className="[font-size:0.75rem] [color:#9ca3af] [width:60px]">Renter</span>
                  <span className="[font-size:0.9rem] [color:#374151] font-medium flex-1">{rental.borrower_name}</span>
                  {isBorrower && <span className="[background:rgba(34,_197,_94,_0.1)] [color:#16a34a] [font-size:0.7rem] font-bold [padding:2px_8px] [border-radius:99px] [border:1px_solid_rgba(34,_197,_94,_0.2)]">You</span>}
                </div>
              </div>
            </div>

            {/* Payment History */}
            {payments.length > 0 && (
              <div className="[background:#ffffff] [border:1px_solid_#e5e7eb] [border-radius:16px] [padding:20px] [box-shadow:0_4px_6px_-1px_rgba(0,0,0,0.05)]">
                <h4>📜 Transactions</h4>
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between items-center [padding:10px_0] [border-bottom:1px_solid_#e5e7eb] [font-size:0.83rem]">
                    <div className="[color:#4b5563] capitalize flex-1">{p.payment_type.replace('_', ' ')}</div>
                    <div className="font-semibold [color:#111827]">{formatCurrency(p.amount)}</div>
                    <div className={`ml-2 rounded-full px-2 py-0.5 text-xs ${p.status === 'PAID' ? 'bg-mesh-50 text-mesh-700' : 'bg-amber-50 text-amber-700'}`}>{p.status}</div>
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
