import { useState } from 'react';
import { CalendarDays, ChevronLeft, LockKeyhole, MapPin, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listingFallback } from '../../lib/assets';
import { openRazorpayCheckout } from '../../utils/RazorpayService';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, api } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const checkout = location.state;

  if (!checkout?.cartItems?.length) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-5 py-20 text-center sm:px-7 lg:px-10">
        <h1 className="font-display text-4xl">Nothing to check out.</h1>
        <p className="mt-2 text-ink/45">Return to your cart and select at least one rental.</p>
        <button
          onClick={() => navigate('/cart')}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white transition hover:bg-mesh-700"
        >
          Go to cart
        </button>
      </main>
    );
  }

  const { cartItems, breakdown, selected_item_ids } = checkout;

  const goToRentalStatus = rentals => {
    window.dispatchEvent(new Event('cart-updated'));
    navigate('/account/rentals', {
      replace: true,
      state: {
        paymentConfirmation: {
          count: rentals.length,
          message: 'Your payment was received. The owner will review your rental request next.',
        },
      },
    });
  };

  const pay = async () => {
    setSubmitting(true);
    setNotice('');

    try {
      const delivery_opted = Object.fromEntries(
        cartItems.map(item => [item.item_id || item.id, Boolean(item.delivery_requested || item.deliveryOpted)]),
      );
      const { data: order } = await api.post('/api/payment/create-checkout-order', {
        delivery_opted,
        selected_item_ids: selected_item_ids || cartItems.map(item => item.item_id || item.id),
      });

      if (order.simulated) {
        const { data } = await api.post('/api/payment/verify-checkout', {
          gateway_order_id: order.order_id,
          gateway_payment_id: "sim_checkout_" + Math.random().toString(36).slice(2, 11),
          gateway_signature: 'sim_sig',
        });
        goToRentalStatus(data?.rentals || []);
        return;
      }

      await openRazorpayCheckout({
        key: order.razorpay_key,
        amount: order.totalAmount || order.amount,
        currency: order.currency || 'INR',
        name: 'CampusMesh',
        description: 'Campus rental booking',
        order_id: order.order_id,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone_number },
        handler: async response => {
          try {
            const { data } = await api.post('/api/payment/verify-checkout', {
              gateway_order_id: response.gateway_order_id || order.order_id,
              gateway_payment_id: response.gateway_payment_id,
              gateway_signature: response.gateway_signature,
            });
            goToRentalStatus(data?.rentals || []);
          } catch (error) {
            setNotice(error.response?.data?.error || 'Payment verification failed. Please try again.');
            setSubmitting(false);
          }
        },
        modalDismissHandler: () => setSubmitting(false),
      });
    } catch (error) {
      setNotice(error.response?.data?.error || 'Could not initialize payment.');
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-paper pb-20">
      <header className="border-b border-ink/10">
        <div className="mx-auto w-full max-w-[1240px] px-5 py-9 sm:px-7 lg:px-10">
          <button onClick={() => navigate('/cart')} className="mb-5 flex items-center gap-1 text-xs font-extrabold text-ink/45">
            <ChevronLeft size={15} /> Back to cart
          </button>
          <span className="flex items-center gap-1 text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">
            <LockKeyhole size={13} /> Secure checkout
          </span>
          <h1 className="mt-3 font-display text-5xl font-semibold">Review and pay.</h1>
          <p className="mt-3 text-sm text-ink/50">Only booking charges are collected now. Refundable deposits follow owner approval.</p>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1240px] items-start gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_360px] lg:px-10">
        <section className="space-y-4">
          {cartItems.map(item => (
            <article key={item.id} className="grid gap-4 rounded-[1.6rem] border border-mesh-900/10 bg-white p-4 shadow-[0_10px_40px_rgba(35,58,40,.06)] sm:grid-cols-[110px_1fr]">
              <img className="aspect-square w-full rounded-2xl object-cover" src={item.image_url || listingFallback} alt="" />
              <div>
                <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">{item.category || 'Campus rental'}</span>
                <h2 className="mt-1 font-extrabold">{item.title}</h2>
                <p className="mt-3 flex items-center gap-1 text-xs text-ink/50">
                  <CalendarDays size={14} />
                  {new Date(item.start_date).toLocaleDateString('en-IN')} → {new Date(item.end_date).toLocaleDateString('en-IN')} · {item.days} days
                </p>
                <p className="mt-2 flex items-center gap-1 text-xs text-ink/50">
                  <MapPin size={14} /> {item.delivery_requested || item.deliveryOpted ? 'Campus delivery' : 'Self pickup'}
                </p>
                <div className="mt-4 flex justify-between border-t border-ink/10 pt-3 text-sm">
                  <span>Rental <b>{money(item.subtotal)}</b></span>
                  <span className="text-ink/45">Deposit later: {money(item.deposit)}</span>
                </div>
              </div>
            </article>
          ))}
        </section>

        <aside className="sticky top-24 rounded-[1.6rem] border border-mesh-900/10 bg-white p-6 shadow-[0_10px_40px_rgba(35,58,40,.06)]">
          <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Payment summary</span>
          <h2 className="mt-1 text-xl font-extrabold">{cartItems.length} rental{cartItems.length === 1 ? '' : 's'}</h2>
          <div className="mt-6 space-y-3 text-sm">
            {[['Rental total', breakdown.rentalTotal], ['Platform fee', breakdown.platformFee], ['Delivery total', breakdown.deliveryTotal]].map(([label, value]) => (
              <p className="flex justify-between text-ink/55" key={label}><span>{label}</span><b className="text-ink">{money(value)}</b></p>
            ))}
            <p className="flex justify-between border-t border-ink/10 pt-4 text-xl font-extrabold"><span>Pay now</span><span>{money(breakdown.bookingTotal)}</span></p>
            <div className="rounded-xl bg-mesh-50 p-4 text-xs leading-5">
              <ShieldCheck className="mb-2 text-mesh-700" size={18} />
              <b>{money(breakdown.depositTotal)} refundable deposits</b>
              <p className="text-ink/45">Not charged today. Each owner must accept first.</p>
            </div>
          </div>
          {notice && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{notice}</p>}
          <button
            disabled={submitting}
            onClick={pay}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? 'Processing…' : `Pay ${money(breakdown.bookingTotal)}`}
          </button>
          <p className="mt-3 text-center text-[10px] font-bold text-ink/35">Razorpay simulation remains enabled by default.</p>
        </aside>
      </div>
    </main>
  );
}
