import { useEffect } from "react";
import { CheckCircle2, LockKeyhole, MapPin, Navigation, ScanLine, ShieldCheck, UserRound } from "lucide-react";

const human = (value) => String(value || "").replaceAll("_", " ").toLowerCase();
const outboundFlow = [
  ["COURIER_ASSIGNED", "Accepted"],
  ["GOING_TO_PICKUP", "To pickup"],
  ["ARRIVED_AT_PICKUP", "Pickup QR"],
  ["IN_TRANSIT", "In transit"],
  ["ARRIVED_AT_DESTINATION", "Delivery QR"],
  ["COMPLETED", "Completed"],
];
const returnFlow = [
  ["RETURN_COURIER_ASSIGNED", "Accepted"],
  ["GOING_TO_PICKUP", "To pickup"],
  ["ARRIVED_AT_PICKUP", "Pickup QR"],
  ["RETURN_IN_TRANSIT", "In transit"],
  ["COMPLETED", "Completed"],
];
const flowFor = (task) => task?.task_type === "RENTAL_RETURN" ? returnFlow : outboundFlow;
const pickupStage = (task) => task.task_type === "XEROX_DELIVERY" ? "XEROX_PICKUP" : task.task_type === "RENTAL_RETURN" ? "RETURN_PICKUP" : "PICKUP";
const deliveryStage = (task) => task.task_type === "RENTAL_RETURN" ? "RETURN_RECEIVED" : "DELIVERY";

export default function ActiveTask({ task, route, verify, setVerify, onVerify, onAdvance, onCheckpoint, onScan }) {
  const secureStage = task?.status === "ARRIVED_AT_PICKUP" ? pickupStage(task) : task?.status === "RETURN_IN_TRANSIT" && task?.task_type === "RENTAL_RETURN" ? "RETURN_RECEIVED" : task?.status === "ARRIVED_AT_DESTINATION" ? deliveryStage(task) : null;
  useEffect(() => {
    if (secureStage && verify.stage !== secureStage) setVerify((current) => ({ ...current, stage: secureStage, value: "" }));
  }, [secureStage, setVerify, verify.stage]);

  if (!task) return (
    <section className="rounded-[1.6rem] border border-mesh-900/10 bg-white p-7 text-center shadow-[0_12px_45px_rgba(35,58,40,.07)]">
      <Navigation className="mx-auto text-ink/20" />
      <h2 className="mt-3 font-extrabold">No active delivery</h2>
      <p className="mt-1 text-sm leading-5 text-ink/45">Accept a request to start a guided campus handover.</p>
    </section>
  );

  const flow = flowFor(task);
  const currentIndex = Math.max(0, flow.findIndex(([key]) => key === task.status));
  const action = ["COURIER_ASSIGNED", "RETURN_COURIER_ASSIGNED"].includes(task.status)
    ? ["GOING_TO_PICKUP", "Start pickup route"]
    : task.status === "GOING_TO_PICKUP"
      ? ["ARRIVED_AT_PICKUP", "I’m at pickup"]
      : task.status === "IN_TRANSIT"
        ? ["ARRIVED_AT_DESTINATION", "I’m at drop-off"]
        : null;
  const isWaitingForQr = Boolean(secureStage);
  const qrHelp = secureStage === pickupStage(task)
    ? `Show ${task.seller_name || "the owner"} the item and pickup location before scanning their QR.`
    : secureStage === deliveryStage(task)
      ? `Confirm ${task.customer_name || "the receiver"} is present before scanning their delivery QR.`
      : task.status === "IN_TRANSIT"
        ? "Delivery QR unlocks when you arrive at the destination."
        : "Pickup QR unlocks when you arrive at the owner’s pickup point.";

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_12px_45px_rgba(35,58,40,.07)]">
      <div className="border-b border-ink/10 bg-ink p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[.65rem] font-extrabold uppercase tracking-[.16em] text-mesh-200">Active delivery</span>
            <h2 className="mt-1 text-xl font-extrabold">{task.listing_title || task.item_description || human(task.task_type)}</h2>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-mesh-100">{human(task.status)}</span>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-white/60"><MapPin size={14} className="mt-0.5 shrink-0" /> {task.pickup_location} <span className="text-mesh-300">→</span> {task.drop_location}</p>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-3 gap-2">
          {[["Route", `${route?.distanceMeters || task.distance || 0} m`], ["ETA", route?.etaMinutes ? `${route.etaMinutes} min` : task.estimated_time || "Updating"], ["Earn", `₹${Number(task.courier_earning || task.delivery_fee || 0).toFixed(0)}`]].map(([label, value]) => <div key={label} className="rounded-xl bg-mesh-50 p-3"><span className="text-[.62rem] font-extrabold uppercase tracking-[.14em] text-mesh-600">{label}</span><b className="mt-1 block truncate text-sm">{value}</b></div>)}
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {flow.map(([key, label], index) => <div key={key} className="min-w-0 text-center"><span className={`mx-auto grid size-7 place-items-center rounded-full text-[10px] font-extrabold ${index < currentIndex ? "bg-mesh-600 text-white" : index === currentIndex ? "bg-ink text-white" : "bg-ink/5 text-ink/35"}`}>{index < currentIndex ? "✓" : index + 1}</span><span className={`mt-1 block truncate text-[9px] font-bold ${index <= currentIndex ? "text-ink" : "text-ink/35"}`}>{label}</span></div>)}
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-ink/10 bg-paper p-3 text-xs">
          <span className="flex min-w-0 items-center gap-1.5 text-ink/55"><UserRound size={14} className="text-mesh-600" /> Owner <b className="truncate text-ink">{task.seller_name || "Listing owner"}</b></span>
          <span className="flex min-w-0 items-center gap-1.5 text-ink/55"><UserRound size={14} className="text-mesh-600" /> Renter <b className="truncate text-ink">{task.customer_name || "Renter"}</b></span>
        </div>
        {route?.instructions?.[0] && <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-800">{route.instructions[0]}</p>}
        <div className="grid grid-cols-2 gap-2">
          {task.status === "GOING_TO_PICKUP" && <button onClick={() => onCheckpoint("pickup")} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 text-xs font-bold text-ink hover:bg-mesh-50"><MapPin size={14} /> Share pickup location</button>}
          {task.status === "IN_TRANSIT" && <button onClick={() => onCheckpoint("destination")} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 text-xs font-bold text-ink hover:bg-mesh-50"><Navigation size={14} /> Share live location</button>}
          {action && <button onClick={() => onAdvance(action[0])} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-4 text-sm font-bold text-white transition hover:bg-mesh-700"><CheckCircle2 size={16} /> {action[1]}</button>}
        </div>
        <div className={`rounded-2xl border p-4 ${isWaitingForQr ? "border-mesh-300 bg-mesh-50" : "border-ink/10 bg-paper"}`}>
          <div className="flex items-center gap-2"><ShieldCheck size={18} className={isWaitingForQr ? "text-mesh-700" : "text-ink/35"} /><b className="text-sm">3-way QR handshake</b>{!isWaitingForQr && <LockKeyhole size={14} className="ml-auto text-ink/30" />}</div>
          <p className="mt-1 text-xs leading-5 text-ink/55">{qrHelp}</p>
          {isWaitingForQr ? <div className="mt-3 space-y-2"><div className="grid grid-cols-[1fr_auto] gap-2"><select className="h-10 rounded-xl border border-mesh-900/15 bg-white px-3 text-xs font-bold" value={verify.method} onChange={(event) => setVerify({ ...verify, method: event.target.value })}><option>OTP</option><option>QR</option></select><button onClick={onScan} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-3 text-xs font-bold"><ScanLine size={15} /> Scan QR</button></div><input className="h-10 w-full rounded-xl border border-mesh-900/15 bg-white px-3 text-sm outline-none focus:border-mesh-500" placeholder={verify.method === "OTP" ? "Enter the 6-digit participant OTP" : "Scan or paste the QR payload"} value={verify.value} onChange={(event) => setVerify({ ...verify, value: event.target.value })} /><button onClick={onVerify} disabled={!verify.value.trim()} className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-ink px-4 text-xs font-bold text-white disabled:opacity-40">Verify {secureStage === pickupStage(task) ? "pickup" : "delivery"} handover</button></div> : <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-ink/45"><LockKeyhole size={14} /> {task.status === "COMPLETED" ? "Both participant handovers are verified." : "The next QR step unlocks after the correct route checkpoint."}</div>}
        </div>
      </div>
    </section>
  );
}
