import { Clock3, IndianRupee, MapPin, Package, Route, Sparkles, UserRound } from "lucide-react";
import { motion } from "motion/react";

const human = (value) => String(value || "Delivery request").replaceAll("_", " ").toLowerCase();
const money = (value) => `₹${Number(value || 0).toFixed(0)}`;

export default function OffersPanel({ offers, onAccept, onDecline, online, busyId }) {
  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_12px_45px_rgba(35,58,40,.07)]">
      <div className="border-b border-ink/10 bg-[linear-gradient(135deg,#f3f8ee,white)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Courier queue</span>
            <h2 className="mt-1 text-xl font-extrabold">Available deliveries</h2>
            <p className="mt-1 text-xs leading-5 text-ink/50">Matched to your saved route and visible only while you are online.</p>
          </div>
          <span className="grid size-9 place-items-center rounded-full bg-white text-sm font-extrabold text-mesh-700 shadow-sm">{offers.length}</span>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {offers.map((offer) => {
          const match = Math.round(Number(offer.offer_match_score ?? offer.match_score ?? 0));
          const title = offer.listing_title || offer.item_description || human(offer.task_type);
          return (
            <motion.article layout key={offer.offer_id || offer.id || offer.delivery_id} className="rounded-2xl border border-ink/10 bg-white p-4 transition hover:border-mesh-300 hover:shadow-[0_8px_24px_rgba(35,58,40,.08)]">
              <div className="flex items-start gap-3">
                {offer.listing_image ? <img src={offer.listing_image} alt="" className="size-12 shrink-0 rounded-xl object-cover" /> : <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-mesh-50 text-mesh-700"><Package size={20} /></span>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <b className="truncate text-sm">{title}</b>
                    <span className="shrink-0 rounded-full bg-mesh-100 px-2 py-1 text-[10px] font-extrabold text-mesh-800">{match}% match</span>
                  </div>
                  <p className="mt-1 flex items-start gap-1 text-xs leading-5 text-ink/50"><MapPin size={13} className="mt-0.5 shrink-0" /> <span>{offer.pickup_location} <span className="px-1 text-mesh-600">→</span> {offer.drop_location}</span></p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-paper p-3 text-[11px] text-ink/60">
                <span className="flex min-w-0 items-center gap-1.5"><UserRound size={13} className="shrink-0 text-mesh-600" /> Owner: <b className="truncate text-ink">{offer.seller_name || "Listing owner"}</b></span>
                <span className="flex min-w-0 items-center gap-1.5"><UserRound size={13} className="shrink-0 text-mesh-600" /> Renter: <b className="truncate text-ink">{offer.customer_name || "Renter"}</b></span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-ink/55">
                <span className="flex items-center gap-1"><Route size={13} /> {match}% route</span>
                <span className="flex items-center gap-1"><Clock3 size={13} /> {offer.estimated_time || "Updating"}</span>
                <span className="flex items-center gap-1"><IndianRupee size={13} /> {money(offer.courier_earning || offer.delivery_fee)}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => onAccept(offer)} disabled={busyId === offer.delivery_id} className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-mesh-600 px-4 text-xs font-bold text-white transition hover:bg-mesh-700 disabled:opacity-50">{busyId === offer.delivery_id ? "Accepting…" : "Accept delivery"}</button>
                <button onClick={() => onDecline(offer)} disabled={busyId === offer.delivery_id} className="inline-flex h-10 items-center justify-center rounded-xl border border-mesh-900/15 bg-white px-4 text-xs font-bold text-ink transition hover:border-mesh-500 hover:bg-mesh-50 disabled:opacity-50">Skip</button>
              </div>
            </motion.article>
          );
        })}
        {!offers.length && (
          <div className="py-10 text-center">
            <Sparkles className="mx-auto text-ink/20" />
            <p className="mt-3 text-sm font-bold">{online ? "Watching for route matches" : "Go online to receive deliveries"}</p>
            <p className="mx-auto mt-1 max-w-[14rem] text-xs leading-5 text-ink/40">Requests appear here only when your route is active and a renter needs this trip.</p>
          </div>
        )}
      </div>
    </section>
  );
}
