import {
  CheckCircle2,
  MapPin,
  Navigation,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
export default function ActiveTask({
  task,
  route,
  verify,
  setVerify,
  onVerify,
  onAdvance,
  onCheckpoint,
  onScan,
}) {
  if (!task)
    return (
      <section className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] p-7 text-center">
        <Navigation className="mx-auto text-ink/20" />
        <h2 className="mt-3 font-extrabold">No active delivery</h2>
        <p className="mt-1 text-sm text-ink/45">
          Accept a ranked offer to start guided navigation.
        </p>
      </section>
    );
  const stages =
    task.task_type === "RENTAL_RETURN"
      ? ["RETURN_PICKUP", "RETURN_RECEIVED"]
      : task.task_type === "XEROX_DELIVERY"
        ? ["XEROX_PICKUP", "DELIVERY"]
        : ["PICKUP", "DELIVERY"];
  return (
    <section className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] overflow-hidden">
      <div className="border-b border-ink/10 p-5">
        <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">
          Active task · {task.status?.replaceAll("_", " ")}
        </span>
        <h2 className="mt-1 text-xl font-extrabold">
          {task.item_description || task.listing_title || task.task_type}
        </h2>
        <p className="mt-2 text-sm text-ink/50">
          {task.pickup_location} → {task.drop_location}
        </p>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Distance", `${route?.distanceMeters || task.distance || 0} m`],
            ["ETA", `${route?.etaMinutes || task.estimated_time || "—"} min`],
            ["Earning", `₹${task.courier_earning || task.delivery_fee || 0}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-mesh-50 p-3">
              <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">{label}</span>
              <b className="mt-1 block text-sm">{value}</b>
            </div>
          ))}
        </div>
        {route?.instructions && (
          <ol className="mt-5 space-y-2">
            {route.instructions.map((step, index) => (
              <li key={step} className="flex gap-2 text-xs text-ink/55">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-blue-50 font-extrabold text-blue-700">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => onCheckpoint("pickup")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-mesh-500 hover:bg-mesh-50"
          >
            <MapPin size={15} /> At pickup
          </button>
          <button
            onClick={() => onCheckpoint("destination")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-mesh-500 hover:bg-mesh-50"
          >
            <Navigation size={15} /> At drop-off
          </button>
          {onAdvance && (
            <button onClick={onAdvance} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 col-span-2">
              <CheckCircle2 size={16} /> Advance current stage
            </button>
          )}
        </div>
        <div className="mt-6 rounded-2xl border border-mesh-200 bg-mesh-50 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-mesh-700" />
            <b className="text-sm">Three-party secure handover</b>
          </div>
          <p className="mt-1 text-xs leading-5 text-ink/50">
            Only the assigned courier can verify the role-bound, expiring
            credential shown by the correct participant.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <select
              className="h-11 w-full rounded-xl border border-mesh-900/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
              value={verify.stage}
              onChange={(e) => setVerify({ ...verify, stage: e.target.value })}
            >
              {stages.map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </select>
            <select
              className="h-11 w-full rounded-xl border border-mesh-900/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100 sm:w-24"
              value={verify.method}
              onChange={(e) => setVerify({ ...verify, method: e.target.value })}
            >
              <option>OTP</option>
              <option>QR</option>
            </select>
            <input
              className="h-11 w-full rounded-xl border border-mesh-900/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
              placeholder={
                verify.method === "OTP"
                  ? "Enter 6-digit OTP"
                  : "Scan or paste QR token"
              }
              value={verify.value}
              onChange={(e) => setVerify({ ...verify, value: e.target.value })}
            />
            <button onClick={onScan} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-mesh-500 hover:bg-mesh-50">
              <ScanLine size={16} /> Scan
            </button>
            <button onClick={onVerify} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 sm:col-span-2">
              Verify handover
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
