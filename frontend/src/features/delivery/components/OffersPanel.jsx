import { Clock3, IndianRupee, Route, Sparkles } from "lucide-react";
import { motion } from "motion/react";
export default function OffersPanel({ offers, onAccept, onDecline, online }) {
  return (
    <section className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Ranked for your route</span>
          <h2 className="mt-1 font-extrabold">Delivery offers</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-mesh-900/10 bg-white/80 px-3 py-1 text-xs font-bold text-mesh-700">{offers.length}</span>
      </div>
      <div className="space-y-3">
        {offers.map((offer) => (
          <motion.article
            layout
            key={offer.id}
            className="rounded-2xl border border-ink/10 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <b className="text-sm">
                  {offer.item_description ||
                    offer.task_type?.replaceAll("_", " ")}
                </b>
                <p className="mt-1 text-xs text-ink/45">
                  {offer.pickup_location} → {offer.drop_location}
                </p>
              </div>
              <span className="rounded-full bg-mesh-100 px-2.5 py-1 text-xs font-extrabold text-mesh-800">
                {Number(offer.match_score).toFixed(0)}% match
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-ink/55">
              <span className="flex items-center gap-1">
                <Route size={13} />
                {offer.score_breakdown?.detourMeters ||
                  offer.detour_meters ||
                  0}{" "}
                m
              </span>
              <span className="flex items-center gap-1">
                <Clock3 size={13} />
                {offer.estimated_time || "8 min"}
              </span>
              <span className="flex items-center gap-1">
                <IndianRupee size={13} />
                {offer.courier_earning || offer.delivery_fee || 0}
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onAccept(offer)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 h-9 flex-1"
              >
                Accept
              </button>
              <button
                onClick={() => onDecline(offer)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-mesh-500 hover:bg-mesh-50 h-9"
              >
                Skip
              </button>
            </div>
          </motion.article>
        ))}
        {!offers.length && (
          <div className="py-10 text-center">
            <Sparkles className="mx-auto text-ink/20" />
            <p className="mt-3 text-sm font-bold">
              {online
                ? "Watching for route matches"
                : "Go online to receive offers"}
            </p>
            <p className="mt-1 text-xs text-ink/40">
              Offers show overlap, detour, ETA, earnings, and expiry.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
