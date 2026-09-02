import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Heart,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { listingFallback } from "../../lib/assets";
import RentalDialog from "./RentalDialog";

const categories = [
  "All",
  "Books",
  "Electronics",
  "Stationery",
  "Lab Equipment",
  "Sports",
  "Hostel Essentials",
];
const price = (listing) =>
  Number(listing.rent_price ?? listing.rentPrice ?? listing.price ?? 0);

export default function MarketplacePage() {
  const { api } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [saved, setSaved] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    Promise.allSettled([api.get("/listings"), api.get("/api/wishlist")]).then(
      ([items, wishlist]) => {
        if (items.status === "fulfilled") setListings(items.value.data);
        if (wishlist.status === "fulfilled")
          setSaved(wishlist.value.data.map((item) => String(item.id)));
        setLoading(false);
      },
    );
  }, [api]);
  useEffect(() => {
    const rentId = searchParams.get("rent");
    if (!rentId || !listings.length) return;
    const listing = listings.find((item) => String(item.id) === rentId);
    if (listing) {
      setSelected(listing);
      setSearchParams({}, { replace: true });
    }
  }, [listings, searchParams, setSearchParams]);
  const visible = useMemo(
    () =>
      listings
        .filter(
          (item) =>
            (category === "All" || item.category === category) &&
            `${item.title} ${item.description}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "price-low"
            ? price(a) - price(b)
            : sort === "price-high"
              ? price(b) - price(a)
              : Number(b.id) - Number(a.id),
        ),
    [category, listings, query, sort],
  );
  const toggleSaved = async (id) => {
    try {
      const { data } = await api.post("/api/wishlist/toggle", { item_id: id });
      setSaved((items) =>
        data.saved
          ? [...new Set([...items, String(id)])]
          : items.filter((item) => item !== String(id)),
      );
      setNotice(data.saved ? "Saved for later" : "Removed from saved");
      setTimeout(() => setNotice(""), 1800);
    } catch (error) {
      setNotice(error.response?.data?.error || "Could not update saved items");
    }
  };
  return (
    <main className="min-h-screen bg-paper pb-20">
      <section className="border-b border-ink/10 bg-[radial-gradient(circle_at_85%_10%,rgba(55,179,116,.13),transparent_28%)]">
        <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 py-10 sm:py-14">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600 flex items-center gap-1.5">
                <Sparkles size={14} /> Campus marketplace
              </span>
              <h1 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                Marketplace.
              </h1>
            </div>
            <Link to="/add-listing" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 w-fit">
              <Plus size={17} /> List an item
            </Link>
          </div>
        </div>
      </section>
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 py-7">
        <div className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] mb-7 grid gap-3 p-3 md:grid-cols-[1fr_auto_auto]">
          <label className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35"
              size={18}
            />
            <input
              className="h-11 w-full rounded-xl border border-mesh-900/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100 pl-11"
              placeholder="Search items"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            className="h-11 w-full rounded-xl border border-mesh-900/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100 md:w-48"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <label className="relative">
            <SlidersHorizontal
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35"
              size={16}
            />
            <select
              className="h-11 w-full rounded-xl border border-mesh-900/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100 pl-9 md:w-44"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest</option>
              <option value="price-low">Price: low first</option>
              <option value="price-high">Price: high first</option>
            </select>
          </label>
        </div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold">
            {visible.length} available item{visible.length === 1 ? "" : "s"}
          </p>
        </div>
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="h-96 animate-pulse rounded-3xl bg-ink/5"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] py-20 text-center">
            <Search className="mx-auto mb-3 text-ink/25" />
            <h2 className="text-xl font-extrabold">No matching items</h2>
            <p className="mt-1 text-sm text-ink/50">
              Try another search or category.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((item, index) => (
              <motion.article
                key={item.id}
                className="group overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-sm"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.035, 0.28) }}
                whileHover={{ y: -5 }}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-mesh-50">
                  <img
                    src={item.image_url || listingFallback}
                    alt=""
                    className="size-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <button
                    onClick={() => toggleSaved(item.id)}
                    className={`absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow-sm backdrop-blur ${saved.includes(String(item.id)) ? "text-red-500" : "text-ink/55"}`}
                  >
                    <Heart
                      size={17}
                      fill={
                        saved.includes(String(item.id))
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">{item.category}</span>
                      <h2 className="mt-1 line-clamp-1 font-extrabold">
                        {item.title}
                      </h2>
                    </div>
                    <p className="whitespace-nowrap font-extrabold text-mesh-700">
                      ₹{price(item)}
                      <small className="font-medium text-ink/40">/day</small>
                    </p>
                  </div>
                  <p className="mt-3 flex items-center gap-1 text-xs text-ink/45">
                    <MapPin size={13} />
                    {item.location || "Campus pickup"} ·{" "}
                    {item.condition || "Good"}
                  </p>
                  <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                    <button
                      onClick={() => setSelected(item)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
                    >
                      Rent now
                    </button>
                    <Link
                      to={`/item/${item.id}`}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-mesh-500 hover:bg-mesh-50 px-3"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white shadow-xl"
        >
          {notice}
        </motion.div>
      )}
      {selected && (
        <RentalDialog listing={selected} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}
