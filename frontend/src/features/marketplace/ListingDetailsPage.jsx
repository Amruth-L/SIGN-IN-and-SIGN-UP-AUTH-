import { useEffect, useState } from "react";
import { ArrowLeft, Heart, MapPin, ShieldCheck, Truck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { listingImage } from "../../lib/assets";
import RentalDialog from "./RentalDialog";

export default function ListingDetailsPage() {
  const { id } = useParams();
  const { api } = useAuth();
  const [item, setItem] = useState(null);
  const [rent, setRent] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .get(`/listings/${id}`)
      .then(({ data }) => {
        setItem(data);
        api.post(`/listings/${id}/view`).catch(() => {});
      })
      .catch((error) =>
        setError(error.response?.data?.error || "This listing is unavailable."),
      );
  }, [api, id]);
  if (error)
    return (
      <main className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 py-20 text-center">
        <h1 className="font-display text-4xl">Listing unavailable</h1>
        <p className="mt-3 text-ink/50">{error}</p>
        <Link to="/marketplace" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 mt-6">
          Return to marketplace
        </Link>
      </main>
    );
  if (!item)
    return (
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 py-14">
        <div className="h-[32rem] animate-pulse rounded-[2rem] bg-ink/5" />
      </div>
    );
  return (
    <main className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 py-8 sm:py-12">
      <Link
        className="mb-6 inline-flex items-center gap-1 text-sm font-bold text-ink/50 hover:text-mesh-700"
        to="/marketplace"
      >
        <ArrowLeft size={16} /> Marketplace
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <div className="overflow-hidden rounded-[2rem] bg-mesh-50">
          <img
            className="aspect-[4/3] size-full object-cover"
            src={listingImage(item)}
            alt={item.title}
          />
        </div>
        <div className="flex flex-col justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-mesh-900/10 bg-white/80 px-3 py-1 text-xs font-bold text-mesh-700 w-fit">{item.category}</span>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-none">
            {item.title}
          </h1>
          <p className="mt-5 leading-7 text-ink/55">{item.description}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] p-4">
              <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Daily rental</span>
              <p className="mt-1 text-2xl font-extrabold text-mesh-700">
                ₹{Number(item.rent_price || item.price || 0)}
              </p>
            </div>
            <div className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] p-4">
              <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">Refundable deposit</span>
              <p className="mt-1 text-2xl font-extrabold">
                ₹{Number(item.deposit || 0)}
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-2 text-sm text-ink/55">
            <p className="flex items-center gap-2">
              <MapPin size={17} className="text-mesh-600" />
              {item.location || "Campus pickup"}
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-mesh-600" />
              Listed by {item.owner_name || "a verified student"}
            </p>
            {item.delivery_available && (
              <p className="flex items-center gap-2">
                <Truck size={17} className="text-mesh-600" />
                Campus delivery available
              </p>
            )}
          </div>
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => setRent(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 flex-1"
            >
              Rent now
            </button>
            <button
              onClick={() =>
                api.post("/api/wishlist/toggle", { item_id: item.id })
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-mesh-500 hover:bg-mesh-50 px-4"
            >
              <Heart size={17} />
            </button>
          </div>
        </div>
      </div>
      {rent && <RentalDialog listing={item} onClose={() => setRent(false)} />}
    </main>
  );
}
