import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bookmark,
  Box,
  LogOut,
  PackageOpen,
  Printer,
  Route,
  ShoppingBag,
} from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../../context/AuthContext";

const links = [
  ["/marketplace", "Marketplace", PackageOpen],
  ["/account/rentals", "My rentals", Box],
  ["/account/saved", "Saved", Bookmark],
  ["/delivery", "Deliver", Route],
  ["/xerox", "Xerox", Printer],
  ["/cart", "Cart", ShoppingBag],
];
export default function AppNavbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const landing = location.pathname === "/";
  const authPage = [
    "/login",
    "/signup",
    "/verify-email",
    "/forgot-password",
  ].includes(location.pathname);
  const logoTo = user && !landing ? "/choose-mode" : "/";

  if (authPage) return null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-mesh-900/10 bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-7 lg:px-10 flex h-17 items-center gap-7">
          <Link
            to={logoTo}
            className="mr-auto text-lg font-extrabold tracking-[-.05em]"
          >
            Campus<span className="text-mesh-600">Mesh</span>
          </Link>
          {!landing && user && (
            <nav className="hidden items-center gap-1 lg:flex">
              {links.map(([to, label, Icon]) => {
                const active = location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? "text-mesh-700" : "text-ink/60 hover:bg-mesh-50 hover:text-ink"}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 -z-10 rounded-xl bg-mesh-100"
                      />
                    )}
                    <Icon size={15} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          )}
          {landing && !user && (
            <div className="flex items-center gap-2">
              <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-mesh-900/15 bg-white px-5 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:border-mesh-500 hover:bg-mesh-50 h-9 px-4" to="/login">
                Log in
              </Link>
              <Link className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-mesh-600 px-5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-mesh-700 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 h-9 px-4" to="/signup">
                Join CampusMesh
              </Link>
            </div>
          )}
          {user && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/account/settings")}
                className="grid size-9 place-items-center rounded-full bg-mesh-600 text-xs font-extrabold text-white"
              >
                {user.name
                  ?.split(" ")
                  .map((x) => x[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "CM"}
              </button>
              {!landing && (
                <button
                  onClick={logout}
                  className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-ink/60 hover:bg-red-50 hover:text-red-700 sm:flex"
                >
                  <LogOut size={15} /> Log out
                </button>
              )}
            </div>
          )}
        </div>
      </header>
      {!landing && user && (
        <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-ink/10 bg-white/95 p-1.5 shadow-xl backdrop-blur lg:hidden">
          {links
            .filter(([, label]) => label !== "Saved")
            .map(([to, label, Icon]) => {
              const active = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-extrabold ${active ? "bg-mesh-100 text-mesh-800" : "text-ink/45"}`}
                >
                  <Icon size={17} />
                  {label.replace("My ", "")}
                </Link>
              );
            })}
        </nav>
      )}
    </>
  );
}
