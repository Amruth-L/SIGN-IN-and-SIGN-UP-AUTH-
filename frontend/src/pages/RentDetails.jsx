import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { ArrowLeft, Check, Clock3, Copy, CreditCard, House, Info, MapPin, Package, Radio, ShieldCheck, Truck, UserRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../lib/api";
import QRCode from "qrcode";
import HandoverCredential from "../components/HandoverCredential";

const API_BASE = API_BASE_URL;
const money = (value) => "₹" + Number(value || 0).toFixed(2);
const dateLabel = (value) => value
  ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  : "—";
const statusLabel = (value) => String(value || "").replaceAll("_", " ").toLowerCase();

const RENTAL_STATUS = {
  BOOKING_PAYMENT_PENDING: { label: "Payment pending", tone: "amber" },
  RENTAL_PAYMENT_COMPLETED: { label: "Awaiting owner", tone: "blue" },
  OWNER_PENDING: { label: "Awaiting owner", tone: "blue" },
  DEPOSIT_PENDING: { label: "Deposit required", tone: "amber" },
  MATCHING_COURIER: { label: "Finding a courier", tone: "blue" },
  QR_GENERATED: { label: "Ready for pickup", tone: "green" },
  COURIER_ASSIGNED: { label: "Courier assigned", tone: "blue" },
  RENTAL_ACTIVE: { label: "Rental active", tone: "green" },
  COMPLETED: { label: "Completed", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "red" },
};

const DELIVERY_STATUS = {
  WAITING_FOR_DEPOSIT: { label: "Waiting for deposit", tone: "amber" },
  MATCHING_COURIER: { label: "Finding a courier", tone: "blue" },
  NO_COURIER_AVAILABLE: { label: "Waiting for route match", tone: "amber" },
  COURIER_ASSIGNED: { label: "Courier assigned", tone: "blue" },
  GOING_TO_PICKUP: { label: "Courier heading to pickup", tone: "blue" },
  ARRIVED_AT_PICKUP: { label: "At pickup", tone: "green" },
  IN_TRANSIT: { label: "In transit", tone: "blue" },
  ARRIVED_AT_DESTINATION: { label: "At destination", tone: "green" },
  COMPLETED: { label: "Delivered", tone: "green" },
};

const DELIVERY_STEPS = [
  { key: "owner", label: "Owner approval" },
  { key: "deposit", label: "Deposit" },
  { key: "matching", label: "Find courier" },
  { key: "pickup", label: "Pickup QR" },
  { key: "transit", label: "In transit" },
  { key: "delivered", label: "Delivered" },
];

const toneClasses = {
  green: "border-mesh-200 bg-mesh-50 text-mesh-800",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-700",
};

function ConnectionPill({ state }) {
  const copy = state === "live" ? "Live updates" : state === "reconnecting" ? "Reconnecting" : "Backend disconnected";
  const color = state === "live" ? "bg-mesh-500" : state === "reconnecting" ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-bold text-ink/60">
      <i className={"size-2 rounded-full " + color} />
      {copy}
    </span>
  );
}

function Stepper({ rental, delivery }) {
  const status = delivery?.status;
  const ownerDone = !["BOOKING_PAYMENT_PENDING", "OWNER_PENDING", "RENTAL_PAYMENT_COMPLETED"].includes(rental?.status);
  const depositDone = ["MATCHING_COURIER", "COURIER_ASSIGNED", "RENTAL_ACTIVE", "COMPLETED"].includes(rental?.status)
    || ["MATCHING_COURIER", "NO_COURIER_AVAILABLE", "COURIER_ASSIGNED", "GOING_TO_PICKUP", "ARRIVED_AT_PICKUP", "IN_TRANSIT", "ARRIVED_AT_DESTINATION", "COMPLETED"].includes(status);
  const matchingDone = ["COURIER_ASSIGNED", "GOING_TO_PICKUP", "ARRIVED_AT_PICKUP", "IN_TRANSIT", "ARRIVED_AT_DESTINATION", "COMPLETED"].includes(status);
  const pickupDone = ["IN_TRANSIT", "ARRIVED_AT_DESTINATION", "COMPLETED"].includes(status);
  const transitDone = ["ARRIVED_AT_DESTINATION", "COMPLETED"].includes(status);
  const deliveredDone = status === "COMPLETED" || rental?.status === "RENTAL_ACTIVE" || rental?.status === "COMPLETED";
  const done = [ownerDone, depositDone, matchingDone, pickupDone, transitDone, deliveredDone];
  const current = done.findIndex((item) => !item);
  const activeIndex = current === -1 ? done.length - 1 : current;

  return (
    <div className="overflow-x-auto rounded-[1.4rem] border border-ink/10 bg-white p-4 shadow-[0_10px_35px_rgba(35,58,40,.06)]">
      <div className="grid min-w-[610px] grid-cols-6">
        {DELIVERY_STEPS.map((step, index) => (
          <div key={step.key} className="relative flex flex-col items-center gap-2 text-center">
            {index < DELIVERY_STEPS.length - 1 && (
              <span className={"absolute left-1/2 right-[-50%] top-4 h-px " + (index < activeIndex ? "bg-mesh-500" : "bg-ink/10")} />
            )}
            <span className={"relative z-10 grid size-8 place-items-center rounded-full border-2 text-xs font-black " + (
              done[index]
                ? "border-mesh-500 bg-mesh-500 text-white"
                : index === activeIndex
                  ? "border-mesh-500 bg-white text-mesh-700"
                  : "border-ink/15 bg-paper text-ink/35"
            )}>
              {done[index] ? <Check size={14} /> : index + 1}
            </span>
            <span className={"text-[10px] font-extrabold uppercase tracking-[.08em] " + (index === activeIndex ? "text-mesh-700" : "text-ink/45")}>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CountdownTimer({ deadline }) {
  const [seconds, setSeconds] = useState(null);
  useEffect(() => {
    if (!deadline) return undefined;
    const calculate = () => Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
    setSeconds(calculate());
    const timer = setInterval(() => setSeconds(calculate()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  if (seconds === null) return null;
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return <span className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-sm font-black text-amber-800"><Clock3 size={15} /> {minutes}:{remainder}</span>;
}

export default function RentDetails() {
  const { rentalId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rental, setRental] = useState(null);
  const [payments, setPayments] = useState([]);
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState("reconnecting");
  const [error, setError] = useState("");
  const [payingDeposit, setPayingDeposit] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const [rentalResponse, deliveryResponse] = await Promise.all([
        fetch(API_BASE + "/api/rentals/" + rentalId + "/status", { headers: { Authorization: "Bearer " + token } }),
        fetch(API_BASE + "/api/delivery/rental/" + rentalId, { headers: { Authorization: "Bearer " + token } }),
      ]);
      const rentalData = await rentalResponse.json();
      const deliveryData = await deliveryResponse.json();
      if (!rentalResponse.ok) throw new Error(rentalData.error || "Rental unavailable.");
      setRental(rentalData.rental);
      setPayments(rentalData.payments || []);
      if (deliveryResponse.ok) setDelivery(deliveryData);
      setError(deliveryResponse.ok ? "" : (deliveryData.error || ""));
    } catch (loadError) {
      setError(loadError.message || "Could not refresh this rental.");
    } finally {
      setLoading(false);
    }
  }, [rentalId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const socket = io(API_BASE, { auth: { token: localStorage.getItem("token") }, reconnectionAttempts: 5 });
    socket.on("connect", () => setConnection("live"));
    socket.on("disconnect", () => setConnection("reconnecting"));
    socket.on("connect_error", () => setConnection("offline"));
    const refresh = () => load();
    ["rental:request", "rental:status", "delivery:created", "delivery:assigned", "delivery:status", "delivery:location", "delivery:completed"].forEach((event) => socket.on(event, refresh));
    if (delivery?.delivery_id) socket.emit("delivery:join", delivery.delivery_id);
    return () => socket.close();
  }, [delivery?.delivery_id, load]);

  useEffect(() => {
    const fast = ["DEPOSIT_PENDING", "MATCHING_COURIER", "NO_COURIER_AVAILABLE", "COURIER_ASSIGNED", "GOING_TO_PICKUP", "ARRIVED_AT_PICKUP", "IN_TRANSIT", "ARRIVED_AT_DESTINATION"].includes(delivery?.status) || ["OWNER_PENDING", "RENTAL_PAYMENT_COMPLETED", "DEPOSIT_PENDING", "MATCHING_COURIER"].includes(rental?.status);
    const timer = setInterval(load, fast ? 5000 : 15000);
    return () => clearInterval(timer);
  }, [delivery?.status, rental?.status, load]);

  const payDeposit = async () => {
    setPayingDeposit(true);
    setError("");
    const token = localStorage.getItem("token");
    try {
      const orderResponse = await fetch(API_BASE + "/api/payment/create-deposit-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ rental_id: rentalId }),
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error || "Could not create deposit order.");
      if (order.simulated) {
        const verifyResponse = await fetch(API_BASE + "/api/payment/verify-deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({
            rental_id: rentalId,
            gateway_order_id: order.order_id,
            gateway_payment_id: "sim_dep_" + Date.now(),
            gateway_signature: "sim_sig",
          }),
        });
        const verified = await verifyResponse.json();
        if (!verifyResponse.ok) throw new Error(verified.error || "Deposit verification failed.");
        await load();
      } else {
        const options = {
          key: order.razorpay_key,
          amount: Math.round(Number(rental.deposit_amount) * 100),
          currency: "INR",
          name: "CampusMesh security deposit",
          description: "Deposit for " + rental.listing_title,
          order_id: order.order_id,
          handler: async (response) => {
            const verifyResponse = await fetch(API_BASE + "/api/payment/verify-deposit", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
              body: JSON.stringify({
                rental_id: rentalId,
                gateway_order_id: response.razorpay_order_id,
                gateway_payment_id: response.razorpay_payment_id,
                gateway_signature: response.razorpay_signature,
              }),
            });
            if (!verifyResponse.ok) setError("Deposit verification failed. Please try again.");
            await load();
          },
          prefill: { name: user?.name, email: user?.email },
          theme: { color: "#2b7044" },
        };
        new window.Razorpay(options).open();
      }
    } catch (payError) {
      setError(payError.message || "Could not complete deposit payment.");
    } finally {
      setPayingDeposit(false);
    }
  };

  useEffect(() => {
    if (!rental || rental.delivery_requested || rental.status !== "QR_GENERATED" || !rental.qr_code_hash) return;
    const target = document.getElementById("self-pickup-qr");
    if (target) QRCode.toCanvas(target, "campusmesh:rental:" + rental.id + ":" + rental.qr_code_hash, { width: 180, color: { dark: "#ffffff", light: "#163225" } }).catch(() => {});
  }, [rental]);

  const isBorrower = rental?.borrower_id === user?.id;
  const isOwner = rental?.owner_id === user?.id;
  const isDelivery = Boolean(rental?.delivery_requested || Number(rental?.delivery_fee) > 0);
  const rentalConfig = RENTAL_STATUS[rental?.status] || { label: statusLabel(rental?.status), tone: "blue" };
  const deliveryConfig = DELIVERY_STATUS[delivery?.status];
  const displayConfig = isDelivery && deliveryConfig && delivery?.status !== "WAITING_FOR_DEPOSIT"
    ? deliveryConfig
    : rentalConfig;

  const blockedCopy = useMemo(() => {
    if (!rental) return null;
    if (["OWNER_PENDING", "RENTAL_PAYMENT_COMPLETED"].includes(rental.status)) {
      return { title: "Waiting for the listing owner", body: "Your booking payment is complete. Courier matching starts after the owner accepts and you pay the security deposit.", action: null, tone: "blue" };
    }
    if (rental.status === "DEPOSIT_PENDING") {
      return { title: "Deposit required to release delivery", body: "The owner accepted your rental. Pay the refundable deposit before an online courier can accept this request.", action: isBorrower ? "Pay security deposit" : null, tone: "amber" };
    }
    if (delivery?.status === "WAITING_FOR_DEPOSIT") {
      return { title: "Delivery is queued", body: "The delivery request is saved with the real owner, renter, item, pickup, and destination. It will be offered after deposit payment.", action: null, tone: "amber" };
    }
    if (delivery?.status === "NO_COURIER_AVAILABLE") {
      return { title: "Waiting for a matching courier", body: "No online courier currently has a route that covers this pickup and destination. The request will be retried automatically.", action: null, tone: "amber" };
    }
    if (delivery?.status === "MATCHING_COURIER") {
      return { title: "Searching for an online courier", body: "Eligible couriers are being matched by their saved campus route. This page will update automatically.", action: null, tone: "blue" };
    }
    if (delivery?.status === "COURIER_ASSIGNED") {
      return { title: "Courier accepted the request", body: (delivery.courier_name || "Your courier") + " will collect the item from " + delivery.pickup_location + ".", action: null, tone: "green" };
    }
    if (delivery?.status === "IN_TRANSIT") {
      return { title: "Your item is on the way", body: "The pickup QR was verified. Watch the courier’s progress until they reach " + delivery.drop_location + ".", action: null, tone: "blue" };
    }
    if (delivery?.status === "ARRIVED_AT_DESTINATION") {
      return { title: "Confirm delivery", body: "The courier has arrived. Show the delivery QR or OTP to complete the handover.", action: null, tone: "green" };
    }
    if (delivery?.status === "COMPLETED") {
      return { title: "Delivery completed", body: "The item handover is complete and your rental is active.", action: null, tone: "green" };
    }
    return null;
  }, [delivery, isBorrower, rental]);

  const copyId = async () => {
    await navigator.clipboard?.writeText(rentalId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  if (loading) return <div className="grid min-h-[70vh] place-items-center bg-paper text-sm text-ink/50">Loading rental workspace…</div>;
  if (!rental) return <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center bg-paper px-6 text-center"><div><p className="text-4xl">⚠️</p><h1 className="mt-3 font-display text-3xl">Rental unavailable</h1><p className="mt-2 text-sm text-ink/50">{error || "Refresh or return to your rentals."}</p></div></div>;

  return (
    <main className="min-h-screen bg-paper pb-16 text-ink">
      <div className="mx-auto max-w-[1180px] space-y-5 px-5 py-6 sm:px-7 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm font-bold text-ink/65 transition hover:-translate-x-0.5 hover:border-mesh-300"><ArrowLeft size={16} /> Back</button>
          <div className="flex items-center gap-2"><ConnectionPill state={connection} /><span className={"rounded-full border px-3 py-1.5 text-xs font-extrabold " + toneClasses[displayConfig.tone]}>{displayConfig.label}</span></div>
        </div>

        <section className="flex flex-col justify-between gap-5 rounded-[1.7rem] border border-mesh-900/10 bg-[radial-gradient(circle_at_100%_0%,rgba(76,145,82,.18),transparent_35%),white] p-6 shadow-[0_15px_50px_rgba(35,58,40,.07)] md:flex-row md:items-end">
          <div className="flex items-start gap-4">
            {rental.listing_image ? <img src={rental.listing_image} alt="" className="size-20 shrink-0 rounded-2xl object-cover" /> : <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-mesh-50 text-mesh-700"><Package /></span>}
            <div><span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">{rental.listing_category || "Rental"}</span><h1 className="mt-2 max-w-[38rem] font-display text-4xl font-semibold leading-tight sm:text-5xl">{rental.listing_title}</h1><p className="mt-2 flex items-center gap-1.5 text-sm text-ink/50"><House size={14} /> {rental.listing_location || "Campus pickup"}</p></div>
          </div>
          <button onClick={copyId} className="inline-flex items-center gap-2 self-start rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs font-bold text-ink/50 md:self-end"><Copy size={14} /> {copied ? "Copied booking ID" : "Copy booking ID"}</button>
        </section>

        {isDelivery && <Stepper rental={rental} delivery={delivery} />}

        {error && <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><Info size={17} className="mt-0.5 shrink-0" /> {error}</div>}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            {blockedCopy && (
              <section className={"rounded-[1.5rem] border p-5 shadow-sm " + toneClasses[blockedCopy.tone]}>
                <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/80">{blockedCopy.tone === "amber" ? <ShieldCheck size={19} /> : blockedCopy.tone === "green" ? <Check size={19} /> : <Radio size={19} />}</span><div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold">{blockedCopy.title}</h2><p className="mt-1 max-w-2xl text-sm leading-6 opacity-75">{blockedCopy.body}</p>{rental.deposit_deadline && rental.status === "DEPOSIT_PENDING" && <div className="mt-3 flex flex-wrap items-center gap-3"><CountdownTimer deadline={rental.deposit_deadline} /><span className="text-xs font-semibold opacity-70">Refundable deposit: {money(rental.deposit_amount)}</span></div>}{blockedCopy.action && <button onClick={payDeposit} disabled={payingDeposit} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-mesh-700 disabled:opacity-50"><CreditCard size={16} /> {payingDeposit ? "Opening payment…" : blockedCopy.action}</button>}</div></div>
              </section>
            )}

            {isDelivery && delivery?.has_delivery && (
              <section className="rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-[0_10px_35px_rgba(35,58,40,.05)]">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Delivery handoff</span><h2 className="mt-1 text-xl font-extrabold">A real person is moving this item</h2></div><span className={"rounded-full border px-3 py-1.5 text-xs font-extrabold " + toneClasses[(DELIVERY_STATUS[delivery.status] || { tone: "blue" }).tone]}>{(DELIVERY_STATUS[delivery.status] || { label: statusLabel(delivery.status) }).label}</span></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-paper p-4"><span className="text-[.65rem] font-extrabold uppercase tracking-[.14em] text-ink/40">Pickup</span><p className="mt-2 flex items-start gap-2 text-sm font-bold"><MapPin size={16} className="mt-0.5 shrink-0 text-mesh-600" /> {delivery.pickup_location}</p><span className="mt-1 block text-xs text-ink/45">Owner: {delivery.owner_name || "Listing owner"}</span></div><div className="rounded-2xl bg-paper p-4"><span className="text-[.65rem] font-extrabold uppercase tracking-[.14em] text-ink/40">Drop-off</span><p className="mt-2 flex items-start gap-2 text-sm font-bold"><MapPin size={16} className="mt-0.5 shrink-0 text-mesh-600" /> {delivery.drop_location}</p><span className="mt-1 block text-xs text-ink/45">Renter: {delivery.renter_name || "Renter"}</span></div></div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">{delivery.courier ? <div className="rounded-2xl border border-mesh-200 bg-mesh-50 p-4"><span className="text-[.65rem] font-extrabold uppercase tracking-[.14em] text-mesh-700">Accepted courier</span><p className="mt-2 flex items-center gap-2 text-sm font-extrabold"><UserRound size={16} /> {delivery.courier.name}</p><p className="mt-1 text-xs text-mesh-800/70">{delivery.courier.phone || "Contact available in the delivery workspace"}</p></div> : <div className="rounded-2xl border border-dashed border-ink/15 p-4"><span className="text-[.65rem] font-extrabold uppercase tracking-[.14em] text-ink/40">Courier</span><p className="mt-2 text-sm font-bold">{delivery.next_action || "Waiting for a courier to accept."}</p></div>}<div className="rounded-2xl border border-ink/10 p-4"><span className="text-[.65rem] font-extrabold uppercase tracking-[.14em] text-ink/40">Next action</span><p className="mt-2 text-sm font-bold">{delivery.next_action || "No action needed right now."}</p></div></div>
                {delivery.delivery_id && delivery.courier && <Link to={"/delivery/" + delivery.delivery_id + "/track"} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white transition hover:bg-mesh-800"><Truck size={15} /> Open live tracking</Link>}
              </section>
            )}

            {isDelivery && delivery?.has_delivery && isOwner && delivery.status === "ARRIVED_AT_PICKUP" && <HandoverCredential deliveryId={delivery.delivery_id} stage="PICKUP" title="Show pickup QR to the courier" />}
            {isDelivery && delivery?.has_delivery && isBorrower && delivery.status === "ARRIVED_AT_DESTINATION" && <HandoverCredential deliveryId={delivery.delivery_id} stage="DELIVERY" title="Show delivery QR to the courier" />}

            {!isDelivery && rental.status === "QR_GENERATED" && (
              <section className="rounded-[1.5rem] border border-mesh-200 bg-ink p-5 text-white"><div className="flex items-center gap-2 text-mesh-200"><ShieldCheck size={18} /><span className="text-[.68rem] font-extrabold uppercase tracking-[.16em]">Self-pickup verification</span></div><h2 className="mt-2 text-xl font-extrabold">Show this QR at the rental counter</h2><canvas id="self-pickup-qr" className="mx-auto mt-5 rounded-2xl bg-white p-3" /><p className="mt-3 text-center text-xs text-white/55">This legacy QR is used only for self-pickup rentals.</p></section>
            )}

            <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-ink/10 bg-white p-4"><span className="text-[.65rem] font-extrabold uppercase tracking-[.14em] text-ink/40">Rental period</span><p className="mt-2 text-sm font-extrabold">{dateLabel(rental.start_date)} → {dateLabel(rental.end_date)}</p></div><div className="rounded-2xl border border-ink/10 bg-white p-4"><span className="text-[.65rem] font-extrabold uppercase tracking-[.14em] text-ink/40">Duration</span><p className="mt-2 text-sm font-extrabold">{rental.rental_days} day{Number(rental.rental_days) === 1 ? "" : "s"}</p></div><div className="rounded-2xl border border-ink/10 bg-white p-4"><span className="text-[.65rem] font-extrabold uppercase tracking-[.14em] text-ink/40">People</span><p className="mt-2 text-sm font-extrabold">{rental.owner_name} · {rental.borrower_name}</p></div></section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-5">
            <section className="rounded-[1.5rem] border border-ink/10 bg-white p-5 shadow-[0_10px_35px_rgba(35,58,40,.05)]"><div className="flex items-center gap-2"><CreditCard size={17} className="text-mesh-600" /><h2 className="text-base font-extrabold">Payment summary</h2></div><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between text-ink/55"><span>Rental fee</span><b className="text-ink">{money(rental.rental_fee)}</b></div><div className="flex justify-between text-ink/55"><span>Delivery fee</span><b className="text-ink">{money(rental.delivery_fee)}</b></div><div className="flex justify-between text-ink/55"><span>Platform fee</span><b className="text-ink">{money(rental.platform_fee)}</b></div><div className="border-t border-ink/10 pt-3"><div className="flex justify-between font-extrabold"><span>Booking amount</span><span>{money(rental.booking_amount)}</span></div><div className="mt-3 flex justify-between text-ink/55"><span>Security deposit</span><b className={rental.deposit_status === "HELD" || rental.deposit_status === "PAID" ? "text-mesh-700" : "text-ink"}>{rental.deposit_status === "HELD" || rental.deposit_status === "PAID" ? "Held safely" : money(rental.deposit_amount)}</b></div></div></div></section>
            <section className="rounded-[1.5rem] border border-ink/10 bg-white p-5"><div className="flex items-center gap-2"><UserRound size={17} className="text-mesh-600" /><h2 className="text-base font-extrabold">People on this rental</h2></div><div className="mt-4 space-y-3"><div className="flex items-center justify-between gap-3 rounded-xl bg-paper p-3"><div><span className="block text-[.65rem] font-extrabold uppercase tracking-[.12em] text-ink/40">Owner</span><b className="mt-1 block text-sm">{rental.owner_name}</b></div>{isOwner && <span className="rounded-full bg-mesh-100 px-2 py-1 text-[10px] font-bold text-mesh-800">You</span>}</div><div className="flex items-center justify-between gap-3 rounded-xl bg-paper p-3"><div><span className="block text-[.65rem] font-extrabold uppercase tracking-[.12em] text-ink/40">Renter</span><b className="mt-1 block text-sm">{rental.borrower_name}</b></div>{isBorrower && <span className="rounded-full bg-mesh-100 px-2 py-1 text-[10px] font-bold text-mesh-800">You</span>}</div></div></section>
            {payments.length > 0 && <section className="rounded-[1.5rem] border border-ink/10 bg-white p-5"><h2 className="text-base font-extrabold">Transactions</h2><div className="mt-3 space-y-2">{payments.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 border-b border-ink/5 py-2 text-xs"><span className="capitalize text-ink/55">{String(payment.payment_type).replaceAll("_", " ").toLowerCase()}</span><span className="font-bold">{money(payment.amount)}</span><span className={"rounded-full px-2 py-1 font-bold " + (payment.status === "PAID" ? "bg-mesh-50 text-mesh-700" : "bg-amber-50 text-amber-700")}>{payment.status}</span></div>)}</div></section>}
          </aside>
        </div>
      </div>
    </main>
  );
}
