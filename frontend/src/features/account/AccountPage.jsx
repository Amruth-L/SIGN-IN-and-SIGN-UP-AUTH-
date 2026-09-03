import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Bookmark,
  Check,
  ChevronRight,
  CirclePlus,
  Clock3,
  ListChecks,
  Package,
  Pencil,
  Settings,
  Trash2,
  UserRound,
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { listingFallback } from "../../lib/assets";

const tabs = [
  ["rentals", "My rentals", Package],
  ["listings", "My listings", ListChecks],
  ["saved", "Saved", Bookmark],
  ["settings", "Settings", Settings],
];
const statusStyle = (status) =>
  ({
    BOOKING_PAYMENT_PENDING: "bg-amber-50 text-amber-700",
    BOOKING_REQUESTED: "bg-blue-50 text-blue-700",
    RENTAL_PAYMENT_COMPLETED: "bg-blue-50 text-blue-700",
    OWNER_PENDING: "bg-amber-50 text-amber-700",
    DEPOSIT_PENDING: "bg-amber-50 text-amber-700",
    ACTIVE: "bg-mesh-50 text-mesh-700",
    COMPLETED: "bg-slate-100 text-slate-700",
    CANCELLED: "bg-red-50 text-red-700",
  })[status] || "bg-violet-50 text-violet-700";
const friendlyStatus = (status) =>
  String(status || "Requested")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());

function Empty({ icon: Icon, title, copy, action }) {
  return (
    <div className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] grid min-h-64 place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-mesh-50 text-mesh-700">
          <Icon />
        </span>
        <h2 className="mt-4 text-lg font-extrabold">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-ink/50">{copy}</p>
        {action}
      </div>
    </div>
  );
}

function RentalsTab({ rentals }) {
  const [filter, setFilter] = useState("All");
  const filtered =
    filter === "All"
      ? rentals
      : rentals.filter((item) => friendlyStatus(item.status).includes(filter));
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {["All", "Requested", "Active", "Completed"].map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-full px-4 py-2 text-xs font-extrabold ${filter === item ? "bg-ink text-white" : "border border-ink/10 bg-white text-ink/55"}`}
          >
            {item}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Empty
          icon={Clock3}
          title="No rentals in this view"
          copy="Your rentals appear here."
          action={
            <Link to="/marketplace" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 mt-5">
              Browse marketplace
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((rental) => (
            <motion.article
              layout
              key={rental.id}
              className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] overflow-hidden"
            >
              <div className="grid gap-5 p-5 md:grid-cols-[92px_1fr_auto]">
                <img
                  className="size-23 rounded-2xl object-cover"
                  src={
                    rental.image_url || rental.listing_image || listingFallback
                  }
                  alt=""
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-extrabold">
                      {rental.listing_title || rental.title || "Campus rental"}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${statusStyle(rental.status)}`}
                    >
                      {friendlyStatus(rental.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink/50">
                    {rental.start_date?.slice(0, 10)} →{" "}
                    {rental.end_date?.slice(0, 10)} · Owner:{" "}
                    {rental.owner_name || "Verified student"}
                  </p>
                  <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${["PAID", "RENTAL_PAID", "FULLY_PAID"].includes(String(rental.payment_status || "").toUpperCase()) ? "bg-mesh-50 text-mesh-700" : "bg-amber-50 text-amber-700"}`}>
                    {["PAID", "RENTAL_PAID", "FULLY_PAID"].includes(String(rental.payment_status || "").toUpperCase()) ? "Payment received" : "Payment pending"}
                  </span>
                  <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-ink/55">
                    <span className="size-2 rounded-full bg-mesh-500" />
                    Request <span className="h-px w-8 bg-ink/15" />
                    <span className="size-2 rounded-full bg-mesh-500" />
                    Handover <span className="h-px w-8 bg-ink/15" />
                    <span className="size-2 rounded-full bg-ink/15" />
                    Return
                  </div>
                </div>
                <div className="flex items-center gap-2 md:flex-col md:items-end">
                  <strong className="text-mesh-700">
                    ₹
                    {Number(
                      rental.booking_amount || rental.total_price || 0,
                    ).toLocaleString("en-IN")}
                  </strong>
                  <Link
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-mesh-500 hover:bg-mesh-50 h-9 px-3"
                    to={`/rent-details/${rental.id}`}
                  >
                    Details <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
              {rental.delivery_id && (
                <div className="flex items-center justify-between border-t border-ink/10 bg-mesh-50/55 px-5 py-3 text-xs">
                  <span className="font-bold text-mesh-800">
                    Courier tracking available
                  </span>
                  <Link
                    to={`/delivery/${rental.delivery_id}/track`}
                    className="font-extrabold text-mesh-700"
                  >
                    Track delivery →
                  </Link>
                </div>
              )}
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}

function ListingsTab({ listings, onDelete, onToggle }) {
  return (
    <div>
      {listings.length === 0 ? (
        <Empty
          icon={CirclePlus}
          title="List your first item"
          copy="Share something useful."
          action={
            <Link to="/add-listing" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 mt-5">
              Create listing
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {listings.map((item) => (
            <article className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] flex gap-4 p-4" key={item.id}>
              <img
                className="size-24 rounded-2xl object-cover"
                src={item.image_url || listingFallback}
                alt=""
              />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <div>
                    <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">{item.category}</span>
                    <h2 className="truncate font-extrabold">{item.title}</h2>
                  </div>
                  <span
                    className={`h-fit rounded-full px-2 py-1 text-[10px] font-extrabold ${item.is_active === false ? "bg-slate-100 text-slate-600" : "bg-mesh-50 text-mesh-700"}`}
                  >
                    {item.is_active === false ? "Paused" : "Active"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink/50">
                  ₹{Number(item.rent_price || item.price || 0)}/day ·{" "}
                  {item.request_count || 0} requests
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    to={`/edit-listing/${item.id}`}
                    className="rounded-lg border border-ink/10 p-2 hover:bg-mesh-50"
                  >
                    <Pencil size={15} />
                  </Link>
                  <button
                    onClick={() => onToggle(item)}
                    className="rounded-lg border border-ink/10 px-3 text-xs font-bold hover:bg-mesh-50"
                  >
                    {item.is_active === false ? "Activate" : "Pause"}
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="ml-auto rounded-lg p-2 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function SavedTab({ items, onRemove, onRent }) {
  return items.length === 0 ? (
    <Empty
      icon={Bookmark}
      title="Nothing saved yet"
      copy="Saved items appear here."
      action={
        <Link to="/marketplace" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 mt-5">
          Explore items
        </Link>
      }
    />
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] overflow-hidden">
          <img
            className="aspect-[16/9] w-full object-cover"
            src={item.image_url || listingFallback}
            alt=""
          />
          <div className="p-4">
            <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600">{item.category}</span>
            <h2 className="mt-1 font-extrabold">{item.title}</h2>
            <p className="mt-1 text-sm text-ink/50">
              ₹{Number(item.rent_price || item.price || 0)}/day
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onRent(item)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 flex-1"
              >
                Rent now
              </button>
              <button
                onClick={() => onRemove(item.id)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-mesh-500 hover:bg-mesh-50 px-3"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function SettingsTab({ user, save }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    username: user?.username || "",
    email: user?.email || "",
    phone_number: user?.phone_number || "",
    department: user?.department || "",
    hostel: user?.hostel || "",
    bio: user?.bio || "",
  });
  const [state, setState] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setState("Your name is required.");
    setState("saving");
    try {
      await save(form);
      setState("saved");
      setTimeout(() => setState(""), 1800);
    } catch (error) {
      setState(error.response?.data?.error || "Could not save your profile.");
    }
  };
  return (
    <form onSubmit={submit} className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] max-w-3xl p-6 sm:p-8">
      <div className="mb-7 flex items-center gap-4">
        <span className="grid size-13 place-items-center rounded-full bg-mesh-600 font-extrabold text-white">
          {user?.name?.slice(0, 1) || "C"}
        </span>
        <div>
          <h2 className="font-extrabold">Profile</h2>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[
          ["name", "Full name"],
          ["username", "Username"],
          ["email", "Campus email"],
          ["phone_number", "Phone number"],
          ["department", "Department"],
          ["hostel", "Hostel / block"],
        ].map(([name, label]) => (
          <label key={name}>
            <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600 mb-1.5 block">{label}</span>
            <input
              className="h-11 w-full rounded-xl border border-mesh-900/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100"
              value={form[name]}
              type={name === "email" ? "email" : "text"}
              onChange={(e) => setForm({ ...form, [name]: e.target.value })}
            />
          </label>
        ))}
        <label className="sm:col-span-2">
          <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600 mb-1.5 block">Short bio</span>
          <textarea
            rows="4"
            className="h-11 w-full rounded-xl border border-mesh-900/15 bg-white px-3 text-sm outline-none transition focus:border-mesh-500 focus:ring-4 focus:ring-mesh-100 resize-none"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </label>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50" disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save changes"}
        </button>
        {state === "saved" && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1 text-sm font-bold text-mesh-700"
          >
            <Check size={16} /> Saved
          </motion.span>
        )}
        {state && !["saving", "saved"].includes(state) && (
          <span className="text-sm font-semibold text-red-600">{state}</span>
        )}
      </div>
    </form>
  );
}

export default function AccountPage() {
  const { tab = "rentals" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, api, updateProfile } = useAuth();
  const active = tabs.some(([id]) => id === tab) ? tab : "rentals";
  const paymentConfirmation = location.state?.paymentConfirmation;
  const [data, setData] = useState({ rentals: [], listings: [], saved: [] });
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const [rentals, listings, saved] = await Promise.allSettled([
      api.get("/api/rentals/my-rentals"),
      api.get("/listings/mine"),
      api.get("/api/wishlist"),
    ]);
    setData({
      rentals: rentals.status === "fulfilled" ? rentals.value.data : [],
      listings: listings.status === "fulfilled" ? listings.value.data : [],
      saved: saved.status === "fulfilled" ? saved.value.data : [],
    });
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [api]);
  const removeSaved = async (id) => {
    await api.delete(`/api/wishlist/${id}`);
    setData((old) => ({
      ...old,
      saved: old.saved.filter((item) => item.id !== id),
    }));
  };
  const deleteListing = async (id) => {
    if (!window.confirm("Delete this listing?")) return;
    await api.delete(`/listings/${id}`);
    setData((old) => ({
      ...old,
      listings: old.listings.filter((item) => item.id !== id),
    }));
  };
  const toggleListing = async (item) => {
    const updated = { ...item, is_active: item.is_active === false };
    await api.put(`/listings/${item.id}`, { is_active: updated.is_active });
    setData((old) => ({
      ...old,
      listings: old.listings.map((row) => (row.id === item.id ? updated : row)),
    }));
  };
  const content = useMemo(
    () =>
      ({
        rentals: <RentalsTab rentals={data.rentals} />,
        listings: (
          <ListingsTab
            listings={data.listings}
            onDelete={deleteListing}
            onToggle={toggleListing}
          />
        ),
        saved: (
          <SavedTab
            items={data.saved}
            onRemove={removeSaved}
            onRent={(item) => navigate(`/marketplace?rent=${item.id}`)}
          />
        ),
        settings: <SettingsTab user={user} save={updateProfile} />,
      })[active],
    [active, data, user],
  );
  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 py-8 sm:py-12">
        <div className="mb-7">
          <span className="text-[.68rem] font-extrabold uppercase tracking-[.16em] text-mesh-600 flex items-center gap-1"><UserRound size={14} /> Account</span>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Your CampusMesh.
          </h1>
        </div>
        {paymentConfirmation && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-start gap-3 rounded-2xl border border-mesh-200 bg-mesh-50 p-4 text-sm"
            role="status"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mesh-600 text-white"><Check size={17} /></span>
            <div>
              <p className="font-extrabold text-mesh-800">Payment received</p>
              <p className="mt-1 text-mesh-700">{paymentConfirmation.message || "Your rental request is now visible below."}</p>
            </div>
          </motion.div>
        )}
        <div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-[1.6rem] border border-mesh-900/10 bg-white shadow-[0_10px_40px_rgba(35,58,40,.06)] p-2">
            <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
              {tabs.map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => navigate(`/account/${id}`)}
                  className={`relative flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-bold ${active === id ? "text-mesh-800" : "text-ink/50 hover:bg-mesh-50"}`}
                >
                  {active === id && (
                    <motion.span
                      layoutId="account-tab"
                      className="absolute inset-0 -z-10 rounded-xl bg-mesh-100"
                    />
                  )}
                  <Icon size={17} />
                  {label}
                </button>
              ))}
            </nav>
          </aside>
          <section>
            {loading ? (
              <div className="grid gap-4">
                <div className="h-36 animate-pulse rounded-3xl bg-ink/5" />
                <div className="h-36 animate-pulse rounded-3xl bg-ink/5" />
              </div>
            ) : (
              content
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
